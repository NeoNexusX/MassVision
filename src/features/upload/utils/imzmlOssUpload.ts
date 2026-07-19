import OSS from 'ali-oss'
import { ProgressTracker, type ImzmlFilePair, type UnifiedUploadProgress } from './imzmlHelper'
import { prepareUpload, type UploadPreparation } from './imzmlCompress'
import { auth_api } from '@/shared/api/httpClient'
import {
  saveUploadSession,
  loadZipFromOPFS,
  loadUploadSession,
  cleanupResumable,
  resetSessionForReupload,
} from './uploadResume'
import { checkStorageQuota } from './quotaCheck'
import { OSS_UPLOAD } from '@/shared/config'
import { generateDatasetFilename } from './filenameGenerator'

// Module-level refs for external abort
let currentOssClient: OSS | null = null
let currentUploadId: string | null = null
let currentOssPath: string | null = null
let uploadGeneration = 0

/** Invalidate old progress callbacks after user cancellation */
export function invalidateUploadGeneration() {
  uploadGeneration++
}

/** Cancel the in-progress OSS upload and clean up uploaded parts on OSS.
 *  Keeps OPFS ZIP and session data so the user can re-upload with a fresh uploadId. */
export function cancelOssUpload() {
  if (currentUploadId && currentOssPath && currentOssClient) {
    currentOssClient.abortMultipartUpload(currentOssPath, currentUploadId).catch(() => {})
  }
  resetSessionForReupload()
}

// Response from POST /files/upload
export interface OssUploadResponse {
  oss_sts_token: {
    AccessKeyId: string
    AccessKeySecret: string
    SecurityToken: string
    Expiration: string
  }
  oss_bucket: string
  oss_path: string
  oss_region_id: string
}

export interface UploadImzmlOssConfig {
  files?: ImzmlFilePair
  datasetName?: string
  metadata?: Record<string, any>
  signal?: AbortSignal
  onProgress?: (progress: UnifiedUploadProgress) => void
  resume?: boolean
}

/**
 * OSS-based imzML upload pipeline.
 *
 * Phase 1: Hash via Worker → generate filename (pauses before compression).
 * Phase 2: Preflight with original size + hash → file_id.
 *   If reuse: return immediately (no compression / upload needed).
 * Phase 3: Compress to ZIP in OPFS (continue Worker).
 * Phase 4: POST /files/upload with pre_file_id → OSS STS credentials.
 * Phase 5: Upload directly to OSS with callback notification.
 */
export async function uploadImzmlZipFileOSS({
  files,
  datasetName = 'mass_dataset',
  metadata = {},
  signal,
  onProgress,
  resume = false,
}: UploadImzmlOssConfig) {
  if (signal?.aborted) throw new DOMException('User Aborted', 'AbortError')

  const gen = ++uploadGeneration

  let zipFile: File
  let fileHash: string
  let fileId: string
  let ossData: OssUploadResponse
  let normalizedFilename: string
  let prep: UploadPreparation | null = null

  if (resume) {
    // ---------- Resume path: restore from OPFS + localStorage ----------
    const session = loadUploadSession()
    if (!session) throw new Error('No pending upload session to resume')

    if (new Date(session.stsExpiration).getTime() <= Date.now()) {
      cleanupResumable()
      throw new Error('Upload session expired, please start a new upload')
    }

    const storedZip = await loadZipFromOPFS()
    if (!storedZip) {
      cleanupResumable()
      throw new Error('Cached file no longer available, please start a new upload')
    }
    zipFile = storedZip
    fileHash = session.fileHash
    fileId = session.fileId
    normalizedFilename = session.datasetName || String(datasetName || 'mass_dataset')
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
    }
    onProgress?.({ stage: 'uploading', percent: 0, message: 'Resuming upload...' })
  } else {
    // ==================== Normal path ====================
    if (!files) throw new Error('No files provided for upload')

    // -----------------------------------------------------------
    // Phase 1: Hash via Worker (pauses before compression)
    // -----------------------------------------------------------
    onProgress?.({ stage: 'preflight', percent: 0, message: 'Preparing upload...' })
    prep = await prepareUpload(files, {
      signal,
      onProgress: (p) =>
        onProgress?.({ stage: 'preflight', percent: p.percent, message: 'Preparing upload...' }),
    })
    fileHash = prep.fileHash

    // Generate filename: {organism}_{part}_{source}_{pixelX}_{polarity}_{hash6}
    normalizedFilename = generateDatasetFilename(metadata, fileHash)

    // -----------------------------------------------------------
    // Phase 2: Preflight (before compression — reuse avoids compress cost)
    // -----------------------------------------------------------
    onProgress?.({ stage: 'preflight', percent: 100, message: 'Checking server for existing file...' })

    const preflightPayload = {
      filename: normalizedFilename,
      size: files.ibd.size + files.imzml.size,
      file_verify_code: fileHash,
      is_public: metadata.is_public ?? false,
      total_parts: 1,
      ...metadata,
      storage_type: 'oss',
    }
    let preflightData: any
    try {
      const preflightRes = await auth_api.post('/files/preflight', preflightPayload, { signal })
      preflightData = preflightRes.data || preflightRes
      fileId = preflightData.file_id

      if (!fileId) {
        throw new Error('Preflight did not return file_id')
      }

      if (!preflightData.is_reuse) {
        await checkStorageQuota(files)
      }
    } catch (err) {
      // Worker is paused waiting for startCompress; it won't be GC'd on its own
      prep.dispose()
      throw err
    }

    // ── Reuse short-circuit: file already on server ──
    if (preflightData.is_reuse) {
      prep.dispose()
      onProgress?.({
        stage: 'completed',
        percent: 100,
        message: 'File already exists on server, reused.',
      })
      return { upload_id: String(fileId), fileHash, oss_path: '', reused: true, datasetName: normalizedFilename }
    }

    // -----------------------------------------------------------
    // Phase 3: Compress (only if not reused)
    // -----------------------------------------------------------
    onProgress?.({ stage: 'packing', percent: 0, message: 'Building dataset archive...' })
    zipFile = await prep.startCompress(
      {
        imzmlName: `${normalizedFilename}.imzML`,
        ibdName: `${normalizedFilename}.ibd`,
      },
      (p) =>
        onProgress?.({
          stage: 'packing',
          percent: p.percent,
          message: p.phase === 'hashing'
            ? `Preparing ${p.percent.toFixed(1)}%`
            : `Compressing ${p.percent.toFixed(1)}%`,
          speedStr: p.speedStr,
          etaStr: p.etaStr,
        }),
    )

    // -----------------------------------------------------------
    // Phase 4: Get OSS credentials
    // -----------------------------------------------------------
    onProgress?.({ stage: 'preflight', percent: 100, message: 'Fetching upload credentials...' })

    const uploadPayload = new URLSearchParams({
      filename: normalizedFilename,
      pre_file_id: String(fileId),
    })
    const uploadRes = await auth_api.post('/files/upload', uploadPayload)
    ossData = uploadRes.data || uploadRes

    if (!ossData.oss_sts_token || !ossData.oss_bucket || !ossData.oss_path) {
      throw new Error('Backend did not return complete OSS credentials')
    }
  }

  // ================= Phase 5: OSS Upload =================
  onProgress?.({ stage: 'uploading', percent: 0, message: 'Uploading to server...' })

  const region = `oss-${ossData.oss_region_id}`
  const client = new OSS({
    region,
    accessKeyId: ossData.oss_sts_token.AccessKeyId,
    accessKeySecret: ossData.oss_sts_token.AccessKeySecret,
    stsToken: ossData.oss_sts_token.SecurityToken,
    authorizationV4: true,
    bucket: ossData.oss_bucket,
    timeout: OSS_UPLOAD.timeout,
  })
  currentOssClient = client

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
    })
  }

  const tracker = new ProgressTracker()
  let lastPercent = 0
  let lastSaveTime = 0

  // OSS part size: fixed small part for files under threshold, otherwise split into a fixed part count
  const ossPartSize =
    zipFile.size < OSS_UPLOAD.singlePartThreshold
      ? OSS_UPLOAD.smallFilePartSize
      : Math.ceil(zipFile.size / OSS_UPLOAD.largeFilePartCount)

  const putOptions: any = {
    partSize: ossPartSize,
    async progress(percentage: number, cpt: any) {
      if (gen !== uploadGeneration) return
      putOptions.checkpoint = cpt
      if (cpt?.uploadId) {
        currentUploadId = cpt.uploadId
        currentOssPath = ossData.oss_path
      }
      const loaded = percentage * zipFile.size
      const { speedStr, etaStr } = tracker.update(loaded, zipFile.size)
      lastPercent = Math.round(percentage * 10000) / 100
      // Persist checkpoint for cross-session resume (throttled)
      if (cpt?.uploadId && Date.now() - lastSaveTime > OSS_UPLOAD.checkpointSaveIntervalMs) {
        lastSaveTime = Date.now()
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
        })
      }
      onProgress?.({
        stage: 'uploading',
        percent: lastPercent,
        message: 'Uploading to server...',
        speedStr,
        etaStr,
      })
    },
  }

  // Restore checkpoint for resume (skip if session was cancelled)
  if (resume) {
    const session = loadUploadSession()
    if (session?.checkpoint?.uploadId && !session.cancelled) {
      putOptions.checkpoint = session.checkpoint
    }
  }

  // Upload to OSS, retry once on failure
  const maxRetries = 2
  try {
    for (let i = 0; i < maxRetries; i++) {
      if (signal?.aborted) throw new DOMException('User Aborted', 'AbortError')
      try {
        // Race upload against abort signal so cancellation takes effect immediately
        const uploadPromise = client.multipartUpload(ossData.oss_path, zipFile, putOptions)
        if (signal) {
          const abortPromise = new Promise<never>((_, reject) => {
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('User Aborted', 'AbortError')),
              { once: true },
            )
          })
          await Promise.race([uploadPromise, abortPromise])
        } else {
          await uploadPromise
        }
        break
      } catch (e: any) {
        if (signal?.aborted) throw e

        if (i === maxRetries - 1) {
          throw new Error(`OSS upload failed after ${maxRetries} attempts: ${e.message}`)
        }
        onProgress?.({
          stage: 'uploading',
          percent: lastPercent,
          message: `Upload failed, Retrying... (${e.message?.slice(0, 60)})`,
        })
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }

    onProgress?.({ stage: 'completed', percent: 100, message: 'Upload complete.' })

    await cleanupResumable()
    return { upload_id: String(fileId), fileHash, oss_path: ossData.oss_path, reused: false, datasetName: normalizedFilename }
  } finally {
    currentOssClient = null
    currentUploadId = null
    currentOssPath = null
  }
}
