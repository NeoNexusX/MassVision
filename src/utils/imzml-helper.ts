import { createMD5 } from 'hash-wasm';
import { auth_api, formatErrorMessage } from '@/utils/api';
import ZipCompressWorker from '@/workers/zip-compress.worker?worker';

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(1)} B/s`;
  if (bytesPerSec < 1048576) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
}

export function formatETA(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return 'Calculating...';
  if (seconds > 3600) return '>1h';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export class ProgressTracker {
  private lastReportTime = Date.now();
  private lastLoaded = 0;
  private speed = 0;
  
  update(loaded: number, total: number) {
    const now = Date.now();
    const dt = (now - this.lastReportTime) / 1000;
    if (dt >= 0.5) {
      this.speed = (loaded - this.lastLoaded) / dt;
      this.lastReportTime = now;
      this.lastLoaded = loaded;
    }
    const remBytes = total - loaded;
    const eta = this.speed > 0 ? remBytes / this.speed : -1;
    return { speedStr: formatSpeed(this.speed), etaStr: formatETA(eta) };
  }
}

// =========================================================================
// ==================== Phase 1: Large File Upload / Core Archiving API ==================
// =========================================================================

export interface ImzmlFilePair {
  ibd: File;
  imzml: File;
  baseName: string; 
}

export interface ZipProgressEvent {
  loadedBytes: number; 
  totalBytes: number;  
  percent: number;     
  speedStr?: string;
  etaStr?: string;
}

export interface PackageZipOptions {
  onProgress?: (progress: ZipProgressEvent) => void;
  signal?: AbortSignal;      
  outputFileName?: string;   
}

/**
 * Module 1: Verify if uploaded files comply with .ibd + .imzml pairing rules
 */
export function validateImzmlFilePair(files: File[] | FileList): ImzmlFilePair {
  const fileArray = Array.from(files);
  
  if (fileArray.length !== 2) {
    throw new Error(`File count error: Please select exactly 2 files, currently selected ${fileArray.length} .`);
  }

  const ibd = fileArray.find(f => f.name.toLowerCase().endsWith('.ibd'));
  const imzml = fileArray.find(f => f.name.toLowerCase().endsWith('.imzml'));

  if (!ibd || !imzml) {
    throw new Error('File format error: Must contain exactly one .ibd and one .imzml file.');
  }

  const ibdBaseName = ibd.name.replace(/\.[iI][bB][dD]$/, '');
  const imzmlBaseName = imzml.name.replace(/\.[iI][mM][zZ][mM][lL]$/, '');

  return {
    ibd,
    imzml,
    baseName: imzmlBaseName
  };
}

/**
 * Module 2: Compress imzML+ibd into ZIP using a Web Worker.
 * Compression runs in a separate thread; main thread streams data in/out and writes to OPFS.
 */
export async function packageFilesToZip(
  pair: ImzmlFilePair,
  options?: PackageZipOptions
): Promise<File> {
  if (options?.signal?.aborted) {
    throw new DOMException('Aborted by user', 'AbortError');
  }

  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle('pending_upload.zip', { create: true });
  const writable = await fileHandle.createWritable();  // Create a writable stream to the OPFS file, ask AI

  const worker = new ZipCompressWorker(); // Instantiate the Web Worker for ZIP compression,看什么是web worker,为什么要用这个
  const totalBytes = pair.ibd.size + pair.imzml.size;

  const tracker = new ProgressTracker();
  let lastReportTime = 0;

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      if (!settled) {
        settled = true;
        worker.terminate();
        if (options?.signal) {
          options.signal.removeEventListener('abort', handleAbort);
        }
      }
    };

    const handleAbort = () => {
      cleanup();
      writable.close().catch(() => {});
      reject(new DOMException('Aborted by user', 'AbortError'));
    };

    if (options?.signal) {
      options.signal.addEventListener('abort', handleAbort, { once: true });
    }

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case 'data':
          writable.write(new Uint8Array(msg.data)).catch(reject);
          break;

        case 'progress':
          if (options?.onProgress) {
            const now = Date.now();
            if (now - lastReportTime > 100) {
              const { speedStr, etaStr } = tracker.update(msg.loaded, totalBytes);
              options.onProgress({
                loadedBytes: msg.loaded,
                totalBytes,
                percent: Math.min(100, Math.round((msg.loaded / totalBytes) * 100)),
                speedStr,
                etaStr,
              });
              lastReportTime = now;
            }
          }
          break;

        case 'done':
          cleanup();
          writable.close()
            .then(() => fileHandle.getFile())
            .then(file => {
              if (options?.onProgress) {
                options.onProgress({ loadedBytes: totalBytes, totalBytes, percent: 100, speedStr: '', etaStr: '' });
              }
              resolve(file);
            })
            .catch(reject);
          break;

        case 'error':
          cleanup();
          writable.close().catch(() => {});
          reject(new Error(msg.message));
          break;
      }
    };

    worker.onerror = () => {
      cleanup();
      writable.close().catch(() => {});
      reject(new Error('Zip compression worker failed'));
    };

    // Stream files to worker
    (async () => {
      try {
        for (const file of [pair.imzml, pair.ibd]) {
          if (options?.signal?.aborted) return;
          worker.postMessage({ type: 'start', name: file.name });

          const reader = file.stream().getReader();
          try {
            while (true) {
              if (options?.signal?.aborted) return;
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                // Transfer the buffer to avoid copying
                const buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
                worker.postMessage({ type: 'chunk', data: buf }, { transfer: [buf] });
              }
            }
          } finally {
            reader.releaseLock();
          }
          worker.postMessage({ type: 'end_file' });
        }
        worker.postMessage({ type: 'finish' });
      } catch (e) {
        if (!settled) {
          cleanup();
          writable.close().catch(() => {});
          reject(e);
        }
      }
    })();
  });
}

// =========================================================================
// ==================== Phase 2: Large File Upload / Hash & Chunking API ================
// =========================================================================

export interface HashProgressEvent {
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  speedStr?: string;
  etaStr?: string;
}

export interface CalculateHashOptions {
  onProgress?: (progress: HashProgressEvent) => void;
  signal?: AbortSignal;
}

/**
 * Module 3 & 8: Incremental MD5 calculation for given Blob (ZIP or chunk)
 * Efficient streaming calculation using `hash-wasm` and the Web Stream API.
 * Supports interruption via AbortSignal and progress callbacks for large files.
 *
 * @param blob Target Blob to hash (full large file or a single chunk)
 * @param options Options including progress callback and cancel signal
 * @returns Hexadecimal MD5 string
 */
export async function calculateFileMD5(
  blob: Blob,
  options?: CalculateHashOptions
): Promise<string> {
  if (options?.signal?.aborted) {
    throw new DOMException('Aborted by user', 'AbortError');
  }

  const hasher = await createMD5();

  const totalBytes = blob.size;
  let loadedBytes = 0;
  let lastReportTime = 0;
  const tracker = new ProgressTracker();
  let lastYieldTime = Date.now();

  const reportProgress = (force = false) => {
    if (options?.onProgress) {
      const now = Date.now();
      if (force || now - lastReportTime > 100) {
        const { speedStr, etaStr } = tracker.update(loadedBytes, totalBytes);
        options.onProgress({
          loadedBytes,
          totalBytes,
          percent: force ? 100 : Math.min(100, Math.round((loadedBytes / totalBytes) * 100)),
          speedStr,
          etaStr
        });
        lastReportTime = now;
      }
    }
  };

  const stream = blob.stream();
  const reader = stream.getReader() as ReadableStreamDefaultReader<Uint8Array>;

  try {
    while (true) {
      if (options?.signal?.aborted) {
        await reader.cancel();
        throw new DOMException('Aborted by user', 'AbortError');
      }
      
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      if (value) {
        hasher.update(value);
        loadedBytes += value.byteLength;
        reportProgress();
        
        if (Date.now() - lastYieldTime > 30) {
          lastYieldTime = Date.now();
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  reportProgress(true); // Trigger 100% progress upon hash completion
  return hasher.digest('hex');
}

export interface ChunkPlan {
  partNumber: number;      // Chunk part number, starting from 1
  startOffset: number;     // Byte start offset
  endOffset: number;       // Byte end offset (exclusive)
  chunkSize: number;       // Actual size of current chunk
  partFilename: string;    // Standard chunk filename for API usage
}

/**
 * Module 4: Plan logical slices for the composed ZIP file
 * Organize full large file into lightweight tasks (abandon saving Blob.slice, cut on demand)
 * 
 * @param zipFile Packaged full zip product File object
 * @param chunkSize Chunk granularity, default 100MB
 * @returns Chunk plan catalog, available for concurrent queues
 */
export function createFileChunks(
  zipFile: File,
  chunkSize?: number
): ChunkPlan[] {
  const totalSize = zipFile.size;
  // Default 100MB per chunk
  let actualChunkSize = chunkSize || (100 * 1024 * 1024);

  // Logic added: Files < 100MB use 20MB chunks
  if (totalSize < 100 * 1024 * 1024) {
    actualChunkSize = 20 * 1024 * 1024;
  }

  const originalName = zipFile.name || 'dataset.zip';
  
  const chunks: ChunkPlan[] = [];
  const totalParts = Math.ceil(totalSize / actualChunkSize);

  for (let i = 0; i < totalParts; i++) {
    const startOffset = i * actualChunkSize;
    // Ensure the last irregular chunk does not exceed real boundary
    const endOffset = Math.min(startOffset + actualChunkSize, totalSize);
    
    const partNumber = i + 1;
    // Retain legacy zero-padded structures .part001, .part002
    const paddedPartNumber = String(partNumber).padStart(3, '0');
    const partFilename = `${originalName}.part${paddedPartNumber}`;

    chunks.push({
      partNumber,
      startOffset,
      endOffset,
      chunkSize: endOffset - startOffset,
      partFilename
    });
  }

  return chunks;
}

// =========================================================================
// ==================== Phase 3: Preflight and Chunk Collaborative Upload ================
// =========================================================================

// 1. Preflight request parameters
export interface PreflightParams {
  filename: string;
  size: number;
  file_verify_code: string; // MD5 checksum (file verification code)
  is_public?: boolean; // optional flag from user, default false
  total_parts: number;
  [key: string]: any; // Extensible for business logic
}

// 2. Preflight return value
export interface PreflightResponse {
  file_id: string;
}

// 3. Status check return value
export interface ChunkStatusResponse {
  file_hash: string;
  filename: string;
  total_parts: number;
  uploaded_parts: number[];
  total_size: number;
  is_complete: boolean;
}

// 4. Chunk upload JSON description structure
export interface PartDataJson {
  file_hash: string;
  part_number: number;
  part_hash: string;
  part_size: number;
}

// 5. Serial upload control parameters
export interface UploadChunksOptions {
  signal?: AbortSignal;
  totalPartsCount?: number;
  alreadyUploadedPartsCount?: number;
  onProgress?: (progress: { loadedBytes: number; totalBytes: number; percent: number; message?: string; currentUploadedParts?: number; totalParts?: number; speedStr?: string; etaStr?: string }) => void;
}

/**
 * 3.1 Preflight API: Declare intention to upload
 */
export async function preflightFile(params: PreflightParams, signal?: AbortSignal): Promise<string> {
  try {
    const response = await auth_api.post('/files/preflight', params, { signal });
    
    // Try to safely access different variations of ID from backend response
    const data = response.data || response; // Support both direct interceptor and typical Axios return
    if (!data) throw new Error('Preflight request returned empty body');
    
    return data.file_id || data.pre_file_id || data.id;
  } catch (error: any) {
    if (error.response && error.response.status === 400) {
      console.error('Preflight 400 error details:', error.response.data);
      throw new Error(`Preflight failed (400 Invalid param): ${formatErrorMessage(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * 3.2 Status Query API: Get historical breakpoint resumption records
 */
export async function getChunkUploadStatus(fileId: string, signal?: AbortSignal): Promise<ChunkStatusResponse> {
  const response = await auth_api.get(`/files/chunked/${fileId}/status`, { signal });
  return response.data || response;
}

/**
 * 3.2b Validate & Merge API: Manually trigger chunk merge when is_complete is false
 */
export async function validateAndMergeChunks(fileId: string, signal?: AbortSignal): Promise<ChunkStatusResponse> {
  const response = await auth_api.post(`/files/chunked/${fileId}/validate_and_merge`, null, { signal });
  return response.data || response;
}

/**
 * 3.3 Local Filter: Calculate remaining chunk list to upload
 */
export function filterPendingChunks(allChunks: ChunkPlan[], uploadedParts: number[]): ChunkPlan[] {
  const uploadedSet = new Set(uploadedParts);
  return allChunks.filter(chunk => !uploadedSet.has(chunk.partNumber));
}

/**
 * 3.4 Minimal Execution Unit: Retrieve single chunk, hash it, array Form upload
 * Built-in safe Retry with Exponential Backoff
 */
export async function uploadChunk(
  zipFile: File,
  chunk: ChunkPlan,
  fileHash: string,
  uploadId: string,
  signal?: AbortSignal,
  maxRetries: number = 3,
  onUploadProgress?: (loadedBytes: number, errStr?: string) => void
): Promise<void> {
  const chunkBlob = zipFile.slice(chunk.startOffset, chunk.endOffset);
  const partHash = await calculateFileMD5(chunkBlob, { signal });

  // Use actual blob size for declared part_size to avoid metadata mismatch
  const partDataJson: PartDataJson = {
    file_hash: fileHash,
    part_number: chunk.partNumber,
    part_hash: partHash,
    part_size: chunkBlob.size
  };

  const partDataJsonStr = JSON.stringify(partDataJson);


  // Wrap slice in a File to make multipart file metadata explicit and consistent
  const uploadBlob = new File([chunkBlob], chunk.partFilename);

  const formData = new FormData();
  formData.append('part_data_json', partDataJsonStr);
  formData.append('part', uploadBlob, chunk.partFilename);

  // formData prepared for upload

  let attempt = 0;
  while (attempt <= maxRetries) {
    if (signal?.aborted) throw new DOMException('Aborted by user', 'AbortError');
    
    try {
      const response = await auth_api.post('/files/chunked/upload', formData, {
        signal,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.loaded && onUploadProgress) {
            onUploadProgress(progressEvent.loaded);
          }
        }
      });

      // Axios throws error on non-2xx standard status, so if it reaches here, it succeeded
      return; 
    } catch (error: any) {
      if (error.name === 'AbortError') throw error;
      
      let errorDetail = error.message;
      if (error.response && error.response.data) {
        errorDetail = formatErrorMessage(error.response.data);
      }
      
      const errMsg = error.response ? `(${error.response.status}) ${errorDetail}` : errorDetail;
      console.warn(`Chunk ${chunk.partNumber} upload failed on attempt ${attempt}:`, errMsg);
      
      if (onUploadProgress) {
        // Pass fake progress with error message for frontend capture
        onUploadProgress(0, `Retrying chunk ${chunk.partNumber} due to err: ${errMsg}`);
      }

      attempt++;
      if (attempt > maxRetries) {
        throw new Error(`Failed to upload chunk ${chunk.partNumber} after ${maxRetries} retries: ${errMsg}`);
      }
      
      // Exponential backoff: 500ms, 1000ms, 2000ms...
      const backoffMs = 500 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}

/**
 * 3.5 Main Coordinator: Serially upload chunks according to plan
 */
export async function uploadChunks(
  zipFile: File,
  pendingChunks: ChunkPlan[],
  fileHash: string,
  uploadId: string,
  options?: UploadChunksOptions
): Promise<number[]> {
  const totalBytes = zipFile.size;
  
  // Successful uploaded byte base
  const chunkedAlreadyUploadedBytes = totalBytes - pendingChunks.reduce((sum, c) => sum + c.chunkSize, 0);
  let completedBytes = chunkedAlreadyUploadedBytes;
  const tracker = new ProgressTracker();
  
  // Record chunk quantity progress
  const totalParts = options?.totalPartsCount || 0;
  let currentUploadedParts = options?.alreadyUploadedPartsCount || 0;
  
  // Track real-time progress for each uploading chunk
  const inProgressMap = new Map<number, number>();

  const reportProgress = () => {
    let currentInflightTotal = 0;
    inProgressMap.forEach(bytes => { currentInflightTotal += bytes; });
    
    const currentTotal = completedBytes + currentInflightTotal;
    
    if (options?.onProgress) {
      const { speedStr, etaStr } = tracker.update(currentTotal, totalBytes);
      options.onProgress({
        loadedBytes: currentTotal,
        totalBytes,
        percent: Math.min(100, Math.round((currentTotal / totalBytes) * 100)),
        currentUploadedParts,
        totalParts,
        speedStr,
        etaStr
      });
    }
  };

  // Initial report
  reportProgress();

  const concurrency = 4; // Limit concurrency to 4 to balance speed and resource usage; can be adjusted based on testing
  const chunkQueue = [...pendingChunks];

  const failedParts: number[] = [];

  const worker = async () => {
    while (chunkQueue.length > 0) {
      if (options?.signal?.aborted) {
        throw new DOMException('Aborted by user', 'AbortError');
      }
      
      const chunk = chunkQueue.shift();
      if (!chunk) break;

      inProgressMap.set(chunk.partNumber, 0);

      // For the last part, only attempt a single upload and do not retry on failure
      const isLastPart = chunk.partNumber === (options?.totalPartsCount || totalParts || 0);
      const maxRetriesForThisChunk = isLastPart ? 0 : 3;

      try {
        await uploadChunk(
          zipFile,
          chunk,
          fileHash,
          uploadId,
          options?.signal,
          maxRetriesForThisChunk,
          (loadedBytesInChunk, errMsgStr) => {
            inProgressMap.set(chunk.partNumber, loadedBytesInChunk);
            if (options?.onProgress) {
              let currentInflightTotal = 0;
              inProgressMap.forEach(bytes => { currentInflightTotal += bytes; });
              const currentTotal = completedBytes + currentInflightTotal;
              
              const { speedStr, etaStr } = tracker.update(currentTotal, totalBytes);
              options.onProgress({
                loadedBytes: currentTotal,
                totalBytes,
                percent: Math.min(100, Math.round((currentTotal / totalBytes) * 100)),
                message: errMsgStr,
                currentUploadedParts,
                totalParts,
                speedStr,
                etaStr
              });
            }
          }
        );
      } catch (err: any) {
        // If last part fails, record it and continue; otherwise rethrow to abort
        if (isLastPart) {
          console.warn(`Last chunk ${chunk.partNumber} upload failed and will be skipped:`, err?.message || err);
          failedParts.push(chunk.partNumber);
          if (options?.onProgress) {
            options.onProgress({
              loadedBytes: completedBytes,
              totalBytes,
              percent: Math.min(100, Math.round((completedBytes / totalBytes) * 100)),
              message: `Last chunk ${chunk.partNumber} failed and was skipped.`,
              currentUploadedParts,
              totalParts,
            });
          }
          // Clean up inProgress map entry for this chunk
          inProgressMap.delete(chunk.partNumber);
          // Continue with next chunk (if any)
          continue;
        }
        throw err;
      }
  
      // Once completely uploaded, accumulate to completedBytes and remove from inProgressMap
      inProgressMap.delete(chunk.partNumber);
      completedBytes += chunk.chunkSize;
      currentUploadedParts += 1;
      reportProgress();
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, pendingChunks.length) }, 
    () => worker()
  );
  
  await Promise.all(workers);
  return failedParts;
}
  
/**
 * ============================================================================
 * Module 10 (Phase 4): Global Coordination Layer - One-Click Upload API
 * ============================================================================
 */

export interface UnifiedUploadProgress {
  stage: 'packing' | 'hashing' | 'preflight' | 'syncing' | 'uploading' | 'completed';
  percent: number; // 0 - 100 independent stage progress
  message?: string; // Additional display text
  speedStr?: string;
  etaStr?: string;
}

export interface UploadImzmlConfig {
  files: ImzmlFilePair;
  datasetName?: string;
  metadata?: Record<string, any>;
  signal?: AbortSignal;
  onProgress?: (progress: UnifiedUploadProgress) => void;
}

/**
 * Module 10: Direct upload ultimate wrapper (local storage path).
 * 1. ZIP Pack 2. Hash & Slice 3. Auth Token & Breakpoint Check 4. Block & Fire chunks
 *
 * Currently unused — OSS upload (imzml-helper-oss.ts) is the active pipeline.
 * Kept as a fallback for local-storage upload scenarios.
 */
export async function uploadImzmlZipFile({
  files,
  datasetName = 'mass_dataset',
  metadata,
  signal,
  onProgress
}: UploadImzmlConfig) {
  
  if (signal?.aborted) throw new DOMException('User Aborted', 'AbortError');

  // ================= Phase 1: Archiving =================
  onProgress?.({ stage: 'packing', percent: 0, message: 'Building dataset archive...' });
  const zipBlob = await packageFilesToZip(
    files, 
    { 
      signal, 
      onProgress: p => onProgress?.({ stage: 'packing', percent: p.percent, message: `Compressing ${p.percent.toFixed(1)}%`, speedStr: p.speedStr, etaStr: p.etaStr }) 
    }
  );
  
  // ================= Phase 2: Full Hash & Chunk Splitting =================
  const zipFile = new File([zipBlob], `${datasetName}.zip`, { type: 'application/zip' });
  onProgress?.({ stage: 'hashing', percent: 0, message: 'Calculating file hash...' });
  
  const fileHash = await calculateFileMD5(zipFile, {
    signal,
    onProgress: p => onProgress?.({ stage: 'hashing', percent: p.percent, message: `Hashing ${p.percent.toFixed(1)}%`, speedStr: p.speedStr, etaStr: p.etaStr })
  });

  const chunkPlans = createFileChunks(zipFile);

  // ================= Phase 3: Preflight & Token Retrieval =================  
  onProgress?.({ stage: 'preflight', percent: 100, message: 'Requesting upload token...' });
  // Prepare preflight payload: include new `file_verify_code` (MD5) and `is_public` flag
  const normalizedFilename = datasetName && String(datasetName).toLowerCase().endsWith('.zip')
    ? String(datasetName).slice(0, -4)
    : String(datasetName);

  const preflightPayload = {
    filename: normalizedFilename,
    size: zipFile.size,
    file_verify_code: fileHash,
    is_public: metadata?.is_public ?? false,
    total_parts: chunkPlans.length,
    file_type: 'zip',
    experiment_type: 'imzML',
    ...metadata,
    storage_type: 'local',
  };

  // end preflight payload prepared

  const uploadTokenStr = await preflightFile(preflightPayload, signal);
  
  const upload_id = uploadTokenStr; // Adjust to what preflightFile truly returns

  // ================= Phase 4: Breakpoint Analysis & Firing Prep =================  
  onProgress?.({ stage: 'syncing', percent: 100, message: 'Checking for missing chunks...' });
  // backend checks chunk uploads, API says we need an upload_id (which here is technically "fileId / datasetId")
  const uploadedPartsRes = await getChunkUploadStatus(upload_id, signal);
  const alreadyUploadedCount = uploadedPartsRes.uploaded_parts?.length || 0;
  const pendingChunks = filterPendingChunks(chunkPlans, uploadedPartsRes.uploaded_parts || []);

  // ================= Phase 5: Batch Serial Generator =================
  if (pendingChunks.length > 0) {
    onProgress?.({ stage: 'uploading', percent: 0, message: `Preparing to upload ${pendingChunks.length} chunks...` });

    let failedParts: number[] = [];
    try {
      failedParts = await uploadChunks(
        zipFile,
        pendingChunks,
        fileHash,
        upload_id,
        {
          signal,
          totalPartsCount: chunkPlans.length,
          alreadyUploadedPartsCount: alreadyUploadedCount,
          onProgress: (p: any) => onProgress?.({
            stage: 'uploading',
            percent: p.percent,
            message: `Chunks: ${p.currentUploadedParts}/${p.totalParts} | Uploaded: ${(p.loadedBytes / 1048576).toFixed(2)}MB / ${(p.totalBytes / 1048576).toFixed(2)}MB`,
            speedStr: p.speedStr,
            etaStr: p.etaStr
          })
        }
      );
    } catch (err) {
      // Rethrow so caller sees failure and UI doesn't mark upload as completed
      throw err;
    }

    if (failedParts.length > 0) {
      const msg = `Failed to upload parts: ${failedParts.join(',')}`;
      onProgress?.({ stage: 'uploading', percent: 100, message: msg });
      throw new Error(msg);
    }
  }

  // ================= Phase 6: Finalize — check merge status and trigger if needed =================
  onProgress?.({ stage: 'completed', percent: 95, message: 'Verifying chunk merge...' });

  const finalStatus = await getChunkUploadStatus(upload_id, signal);

  if (!finalStatus.is_complete) {
    onProgress?.({ stage: 'completed', percent: 97, message: 'Triggering server-side merge...' });
    await validateAndMergeChunks(upload_id, signal);
  }

  onProgress?.({ stage: 'completed', percent: 100, message: 'Upload complete.' });

  return { upload_id, fileHash };
}

