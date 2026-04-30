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
  oss_region_id?: string;
}

export interface UploadImzmlOssConfig {
  files: ImzmlFilePair;
  datasetName?: string;
  metadata?: Record<string, any>;
  signal?: AbortSignal;
  onProgress?: (progress: UnifiedUploadProgress) => void;
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
}: UploadImzmlOssConfig) {

  if (signal?.aborted) throw new DOMException('User Aborted', 'AbortError');

  // ================= Phase 1: Archiving =================
  onProgress?.({ stage: 'packing', percent: 0, message: 'Building dataset archive...' });
  const zipBlob = await packageFilesToZip(files, {
    signal,
    onProgress: p => onProgress?.({
      stage: 'packing',
      percent: p.percent,
      message: `Compressing ${p.percent.toFixed(1)}%`,
      speedStr: p.speedStr,
      etaStr: p.etaStr,
    }),
  });
  // Phase 1 ZIP done
  const zipFile = new File([zipBlob], `${datasetName}.zip`, { type: 'application/zip' });
  onProgress?.({ stage: 'hashing', percent: 0, message: 'Calculating file hash...' });

  const fileHash = await calculateFileMD5(zipFile, {
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

  const normalizedFilename = datasetName && String(datasetName).toLowerCase().endsWith('.zip')
    ? String(datasetName).slice(0, -4)
    : String(datasetName);

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
  const fileId = preflightData.file_id;

  if (!fileId) {
    throw new Error('Preflight did not return file_id');
  }

  // ================= Phase 3b: Get OSS credentials =================
  onProgress?.({ stage: 'preflight', percent: 100, message: 'Fetching OSS credentials...' });

  const uploadPayload = new URLSearchParams({
    filename: normalizedFilename,
    pre_file_id: String(fileId),
  });
  const uploadRes = await auth_api.post('/files/upload', uploadPayload);
  const ossData: OssUploadResponse = uploadRes.data || uploadRes;

  if (!ossData.oss_sts_token || !ossData.oss_bucket || !ossData.oss_path) {
    throw new Error('Backend did not return complete OSS credentials');
  }

  // ================= Phase 4: OSS Upload =================
  onProgress?.({ stage: 'uploading', percent: 0, message: 'Uploading to OSS...' });

  const region = `oss-${ossData.oss_region_id}`;
  const client = new OSS({
    region,
    accessKeyId: ossData.oss_sts_token.AccessKeyId,
    accessKeySecret: ossData.oss_sts_token.AccessKeySecret,
    stsToken: ossData.oss_sts_token.SecurityToken,
    authorizationV4: true,
    bucket: ossData.oss_bucket,
  });

  const authStore = useAuthStore();
  const currentUsername = authStore.user?.username || 'unknown';
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';

  const tracker = new ProgressTracker();
  const putOptions: any = {
    async progress(percentage: number, cpt: any) {
      putOptions.checkpoint = cpt;
      const loaded = percentage * zipFile.size;
      const { speedStr, etaStr } = tracker.update(loaded, zipFile.size);
      onProgress?.({
        stage: 'uploading',
        percent: Math.round(percentage * 10000) / 100,
        message: 'Uploading to OSS...',
        speedStr,
        etaStr,
      });
    },
    callback: {
      url: `${backendUrl}/files/oss_upload_complete`,
      body: 'fc_request_id=${reqId}&file_id=${x:file_id}&current_username=${x:current_username}',
      contentType: 'application/x-www-form-urlencoded',
      callbackSNI: true,
      customValue: {
        file_id: String(fileId),
        current_username: encodeURIComponent(currentUsername),
      },
    },
  };

  // Upload to OSS with up to 5 retries (checkpoint enables resume)
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    if (signal?.aborted) throw new DOMException('User Aborted', 'AbortError');
    try {
      // Reset checkpoint on retry to avoid resuming a stale multipart upload
      if (i > 0) {
        putOptions.checkpoint = null;
      }
      await client.multipartUpload(ossData.oss_path, zipFile, putOptions);
      break;
    } catch (e: any) {
      if (i === maxRetries - 1) {
        throw new Error(`OSS upload failed after ${maxRetries} attempts: ${e.message}`);
      }
    }
  }

  onProgress?.({ stage: 'completed', percent: 100, message: 'Upload complete.' });

  return { upload_id: String(fileId), fileHash, oss_path: ossData.oss_path };
}
