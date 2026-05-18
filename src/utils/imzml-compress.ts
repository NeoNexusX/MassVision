import ZipCompressWorker from '@/workers/zip-compress.worker?worker';
import { ProgressTracker, type ImzmlFilePair } from './imzml-helper';
import { loadZipFromOPFS } from './upload-resume';

const MIN_CHUNK = 1 * 1024 * 1024;
const FIXED_CHUNK_COUNT = 1000;

export interface CompressProgressEvent {
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  speedStr?: string;
  etaStr?: string;
}

export interface CompressOptions {
  chunkSize?: number;
  onProgress?: (e: CompressProgressEvent) => void;
  signal?: AbortSignal;
}

export interface CompressResult {
  file: File;
  fileHash: string;
}

/**
 * Compress imzML + ibd into a ZIP stored in OPFS.
 * Reading, hashing, and compression all happen inside a Web Worker.
 * The returned hash is the MD5 of the raw imzml+ibd content (in sequence).
 */
export async function compressImzmlToOPFS(
  pair: ImzmlFilePair,
  options?: CompressOptions
): Promise<CompressResult> {
  if (options?.signal?.aborted) {
    throw new DOMException('Aborted by user', 'AbortError');
  }

  const totalBytes = pair.ibd.size + pair.imzml.size;
  const chunkSize = options?.chunkSize
    ?? (totalBytes < 1e9 ? MIN_CHUNK : Math.ceil(totalBytes / FIXED_CHUNK_COUNT));
  const worker = new ZipCompressWorker();
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
      reject(new DOMException('Aborted by user', 'AbortError'));
    };

    if (options?.signal) {
      options.signal.addEventListener('abort', handleAbort, { once: true });
    }

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;

      switch (msg.type) {
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
          loadZipFromOPFS().then(file => {
            if (!file) {
              reject(new Error('Compressed file not found in OPFS'));
              return;
            }
            if (options?.onProgress) {
              options.onProgress({ loadedBytes: totalBytes, totalBytes, percent: 100, speedStr: '', etaStr: '' });
            }
            resolve({ file, fileHash: msg.hash });
          }).catch(reject);
          break;

        case 'error':
          cleanup();
          reject(new Error(msg.message));
          break;
      }
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error('Zip compression worker failed'));
    };

    // Send files to worker (structured clone shares underlying references)
    worker.postMessage({
      type: 'start',
      imzml: pair.imzml,
      ibd: pair.ibd,
      chunkSize,
    });
  });
}
