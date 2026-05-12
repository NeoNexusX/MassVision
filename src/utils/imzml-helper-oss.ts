import OSS from 'ali-oss';
import {
  packageFilesToZip,
  calculateFileMD5,
  ProgressTracker,
  type ImzmlFilePair,
  type UnifiedUploadProgress,
} from './imzml-helper';
import { auth_api } from './api';
import { useAuthStore } from '@/stores/auth';
import {
  saveUploadSession,
  loadZipFromOPFS,
  loadUploadSession,
  cleanupResumable,
  resetSessionForReupload,
} from './upload-resume';
import { checkStorageQuota } from './quota-check';

// Module-level refs for external abort
let currentOssClient: OSS | null = null;
let currentUploadId: string | null = null;
let currentOssPath: string | null = null;
let uploadGeneration = 0;

/** Invalidate old progress callbacks after user cancellation */
export function invalidateUploadGeneration() {
  uploadGeneration++;
}

/** Cancel the in-progress OSS upload and clean up uploaded parts on OSS.
 *  Keeps OPFS ZIP and session data so the user can re-upload with a fresh uploadId. */
export function cancelOssUpload() {
  if (currentUploadId && currentOssPath && currentOssClient) {
    currentOssClient.abortMultipartUpload(currentOssPath, currentUploadId).catch(() => {});
  }
  resetSessionForReupload();
}

// Response from POST /files/upload
export interface OssUploadResponse {
  oss_sts_token: {
    AccessKeyId: string;
    AccessKeySecret: string;
    SecurityToken: string;
    Expiration: string;
  };
  oss_bucket: string;
  oss_path: string;
  oss_region_id: string;
}

export interface UploadImzmlOssConfig {
  files?: ImzmlFilePair;
  datasetName?: string;
  metadata?: Record<string, any>;
  signal?: AbortSignal;
  onProgress?: (progress: UnifiedUploadProgress) => void;
  resume?: boolean;
}

/**
 * OSS-based imzML upload pipeline.
 *
 * Phase 1-2: ZIP + hash (reused from imzml-helper).
 * Phase 3a: Preflight with storage_type=oss → file_id.
 * Phase 3b: POST /files/upload with pre_file_id + filename → OSS STS credentials + fc_request_id.
 * Phase 4:   Upload directly to OSS with callback notification.
 */
export async function uploadImzmlZipFileOSS({
  files,
  datasetName = 'mass_dataset',
  metadata = {},
  signal,
  onProgress,
  resume = false,
}: UploadImzmlOssConfig) {

  if (signal?.aborted) throw new DOMException('User Aborted', 'AbortError');

  const gen = ++uploadGeneration;

  let zipFile: File;
  let fileHash: string;
  let fileId: string;
  let ossData: OssUploadResponse;

  const normalizedFilename = datasetName && String(datasetName).toLowerCase().endsWith('.zip')
    ? String(datasetName).slice(0, -4)
    : String(datasetName);

  if (resume) {
    // ---------- Resume path: restore from OPFS + localStorage ----------
    const session = loadUploadSession();
    if (!session) throw new Error('No pending upload session to resume');

    if (new Date(session.stsExpiration).getTime() <= Date.now()) {
      cleanupResumable();
      throw new Error('Upload session expired, please start a new upload');
    }

    const storedZip = await loadZipFromOPFS();
    if (!storedZip) {
      cleanupResumable();
      throw new Error('Cached file no longer available, please start a new upload');
    }
    zipFile = storedZip;
    fileHash = session.fileHash;
    fileId = session.fileId;
    ossData = {
      oss_sts_token: {
        AccessKeyId: session.accessKeyId,
        AccessKeySecret: session.accessKeySecret,
        SecurityToken: session.stsToken,
        Expiration: session.stsExpiration,
      },
      oss_bucket: session.ossBucket,
      oss_path: session.ossPath,
      oss_region_id: session.ossRegion,
    };
    onProgress?.({ stage: 'uploading', percent: 0, message: 'Resuming upload...' });
  } else {
    // ---------- Normal path: pack → hash → preflight ----------
    if (!files) throw new Error('No files provided for upload');

    // ================= Check storage quota =================
    await checkStorageQuota(files);

    // ================= Phase 1: Archiving =================
    onProgress?.({ stage: 'packing', percent: 0, message: 'Building dataset archive...' });
    const zipFileFromOPFS = await packageFilesToZip(files, {
      signal,
      onProgress: p => onProgress?.({
        stage: 'packing',
        percent: p.percent,
        message: `Compressing ${p.percent.toFixed(1)}%`,
        speedStr: p.speedStr,
        etaStr: p.etaStr,
      }),
    });
    zipFile = zipFileFromOPFS;

    // ================= Phase 2: Hash =================
    onProgress?.({ stage: 'hashing', percent: 0, message: 'Calculating file hash...' });

    fileHash = await calculateFileMD5(zipFile, {
      signal,
      onProgress: p => onProgress?.({
        stage: 'hashing',
        percent: p.percent,
        message: `Hashing ${p.percent.toFixed(1)}%`,
        speedStr: p.speedStr,
        etaStr: p.etaStr,
      }),
    });

    // ================= Phase 3a: Preflight =================
    onProgress?.({ stage: 'preflight', percent: 100, message: 'Requesting upload token...' });

    const preflightPayload = {
      filename: normalizedFilename,
      size: zipFile.size,
      file_verify_code: fileHash,
      is_public: metadata.is_public ?? false,
      total_parts: 1,
      ...metadata,
      storage_type: 'oss',
    };
    const preflightRes = await auth_api.post('/files/preflight', preflightPayload, { signal });
    const preflightData = preflightRes.data || preflightRes;
    fileId = preflightData.file_id;

    if (!fileId) {
      throw new Error('Preflight did not return file_id');
    }

    // ================= Phase 3b: Get OSS credentials =================
    onProgress?.({ stage: 'preflight', percent: 100, message: 'Fetching upload credentials...' });

    const uploadPayload = new URLSearchParams({
      filename: normalizedFilename,
      pre_file_id: String(fileId),
    });
    const uploadRes = await auth_api.post('/files/upload', uploadPayload);
    ossData = uploadRes.data || uploadRes;

    if (!ossData.oss_sts_token || !ossData.oss_bucket || !ossData.oss_path) {
      throw new Error('Backend did not return complete OSS credentials');
    }
  }

  // ================= Phase 4: OSS Upload =================
  onProgress?.({ stage: 'uploading', percent: 0, message: 'Uploading to server...' });

  const region = `oss-${ossData.oss_region_id}`;
  const client = new OSS({
    region,
    accessKeyId: ossData.oss_sts_token.AccessKeyId,
    accessKeySecret: ossData.oss_sts_token.AccessKeySecret,
    stsToken: ossData.oss_sts_token.SecurityToken,
    authorizationV4: true,
    bucket: ossData.oss_bucket,
    timeout: 30000,
  });
  currentOssClient = client;

  // Save session immediately (normal path only) so it's available even if user refreshes before first progress callback
  // Skip for resume: session already loaded with real checkpoint data
  if (!resume) {
    saveUploadSession({
      datasetName: normalizedFilename,
      fileName: zipFile.name,
      fileSize: zipFile.size,
      fileHash,
      fileId,
      ossPath: ossData.oss_path,
      ossBucket: ossData.oss_bucket,
      ossRegion: ossData.oss_region_id || '',
      stsExpiration: ossData.oss_sts_token.Expiration,
      accessKeyId: ossData.oss_sts_token.AccessKeyId,
      accessKeySecret: ossData.oss_sts_token.AccessKeySecret,
      stsToken: ossData.oss_sts_token.SecurityToken,
      checkpoint: { name: '', fileSize: 0, partSize: 0, uploadId: '', doneParts: [] },
    });
  }

  const authStore = useAuthStore();
  const currentUsername = authStore.user?.username || 'unknown';
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const callbackConfig: any = backendUrl && /^https?:\/\//.test(backendUrl)
    ? {
        url: `${backendUrl}/files/oss_upload_complete`,
        body: 'fc_request_id=${reqId}&file_id=${x:file_id}&current_username=${x:current_username}',
        contentType: 'application/x-www-form-urlencoded',
        callbackSNI: true,
        customValue: {
          file_id: String(fileId),
          current_username: encodeURIComponent(currentUsername),
        },
      }
    : undefined;

  const tracker = new ProgressTracker();
  let lastPercent = 0;
  let lastSaveTime = 0;
  const putOptions: any = {
    async progress(percentage: number, cpt: any) {
      if (gen !== uploadGeneration) return;
      putOptions.checkpoint = cpt;
      if (cpt?.uploadId) {
        currentUploadId = cpt.uploadId;
        currentOssPath = ossData.oss_path;
      }
      const loaded = percentage * zipFile.size;
      const { speedStr, etaStr } = tracker.update(loaded, zipFile.size);
      lastPercent = Math.round(percentage * 10000) / 100;
      // Persist checkpoint for cross-session resume (throttled to every 5s)
      if (cpt?.uploadId && Date.now() - lastSaveTime > 5000) {
        lastSaveTime = Date.now();
        saveUploadSession({
          datasetName: normalizedFilename,
          fileName: zipFile.name,
          fileSize: zipFile.size,
          fileHash,
          fileId,
          ossPath: ossData.oss_path,
          ossBucket: ossData.oss_bucket,
          ossRegion: ossData.oss_region_id || '',
          stsExpiration: ossData.oss_sts_token.Expiration,
          accessKeyId: ossData.oss_sts_token.AccessKeyId,
          accessKeySecret: ossData.oss_sts_token.AccessKeySecret,
          stsToken: ossData.oss_sts_token.SecurityToken,
          checkpoint: {
            name: cpt.name,
            fileSize: cpt.fileSize,
            partSize: cpt.partSize,
            uploadId: cpt.uploadId,
            doneParts: cpt.doneParts || [],
          },
        });
      }
      onProgress?.({
        stage: 'uploading',
        percent: lastPercent,
        message: 'Uploading to server...',
        speedStr,
        etaStr,
      });
    },
  };

  if (callbackConfig) putOptions.callback = callbackConfig;

  // Restore checkpoint for resume (skip if session was cancelled)
  if (resume) {
    const session = loadUploadSession();
    if (session?.checkpoint?.uploadId && !session.cancelled) {
      putOptions.checkpoint = session.checkpoint;
    }
  }

  // Upload to OSS, retry once on failure
  const maxRetries = 2;
  try {
    for (let i = 0; i < maxRetries; i++) {
      if (signal?.aborted) throw new DOMException('User Aborted', 'AbortError');
      try {
        // Race upload against abort signal so cancellation takes effect immediately
        const uploadPromise = client.multipartUpload(ossData.oss_path, zipFile, putOptions);
        if (signal) {
          const abortPromise = new Promise<never>((_, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('User Aborted', 'AbortError')), { once: true });
          });
          await Promise.race([uploadPromise, abortPromise]);
        } else {
          await uploadPromise;
        }
        break;
      } catch (e: any) {
        if (signal?.aborted) throw e;

        // Callback may have failed (timeout within 5s), notify backend manually
        onProgress?.({ stage: 'uploading', percent: lastPercent, message: 'Verifying upload...' });
        try {
          await auth_api.post('/files/oss_upload_complete', `file_id=${fileId}&current_username=${currentUsername}`);
          onProgress?.({ stage: 'completed', percent: 100, message: 'Upload complete.' });
          await cleanupResumable();
          return { upload_id: String(fileId), fileHash, oss_path: ossData.oss_path };
        } catch {
          // Manual notification also failed, retry the entire upload
        }

        if (i === maxRetries - 1) {
          throw new Error(`OSS upload failed after ${maxRetries} attempts: ${e.message}`);
        }
        onProgress?.({
          stage: 'uploading',
          percent: lastPercent,
          message: `Upload failed, Retrying... (${e.message?.slice(0, 60)})`,
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    onProgress?.({ stage: 'completed', percent: 100, message: 'Upload complete.' });

    // Notify backend manually in case OSS callback didn't fire (e.g. relative URL)
    if (!callbackConfig) {
      await auth_api.post('/files/oss_upload_complete', `file_id=${fileId}&current_username=${currentUsername}`);
    }

    await cleanupResumable();
    return { upload_id: String(fileId), fileHash, oss_path: ossData.oss_path };
  } finally {
    currentOssClient = null;
    currentUploadId = null;
    currentOssPath = null;
  }
}
