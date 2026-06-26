import ZipCompressWorker from '@/workers/zip-compress.worker?worker'
import { ProgressTracker, type ImzmlFilePair } from './imzmlHelper'
import { loadZipFromOPFS } from './uploadResume'

function pickChunkSize(totalBytes: number): number {
  const mb = (n: number) => n * 1024 * 1024
  if (totalBytes < 1e9) return mb(4)
  if (totalBytes < 5e9) return mb(8)
  return mb(16)
}

export interface CompressProgressEvent {
  loadedBytes: number
  totalBytes: number
  percent: number
  phase?: 'hashing' | 'compressing'
  speedStr?: string
  etaStr?: string
}

export interface CompressOptions {
  onProgress?: (e: CompressProgressEvent) => void
  signal?: AbortSignal
  /** Generate ZIP entry names from the file hash, e.g. { imzmlName, ibdName } */
  getEntryNames?: (hash: string) => { imzmlName: string; ibdName: string }
}

export interface CompressResult {
  file: File
  fileHash: string
}

/**
 * Compress imzML + ibd into a ZIP stored in OPFS.
 *
 * Two-phase worker protocol:
 * 1. Worker hashes imzml+ibd → sends hash → parent generates entry names
 * 2. Worker compresses with renamed entries → sends done
 */
export async function compressImzmlToOPFS(
  pair: ImzmlFilePair,
  options?: CompressOptions,
): Promise<CompressResult> {
  if (options?.signal?.aborted) {
    throw new DOMException('Aborted by user', 'AbortError')
  }

  const totalBytes = pair.ibd.size + pair.imzml.size
  const chunkSize = pickChunkSize(totalBytes)
  const worker = new ZipCompressWorker()
  const tracker = new ProgressTracker()
  let lastReportTime = 0
  let lastPhase: string | undefined

  return new Promise((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      if (!settled) {
        settled = true
        worker.terminate()
        if (options?.signal) {
          options.signal.removeEventListener('abort', handleAbort)
        }
      }
    }

    const handleAbort = () => {
      cleanup()
      reject(new DOMException('Aborted by user', 'AbortError'))
    }

    if (options?.signal) {
      options.signal.addEventListener('abort', handleAbort, { once: true })
    }

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data

      switch (msg.type) {
        case 'progress':
          if (options?.onProgress) {
            // Reset speed tracker on phase transition so it doesn't bleed
            if (lastPhase && msg.phase !== lastPhase) {
              tracker.reset()
              lastReportTime = 0
            }
            lastPhase = msg.phase
            const now = Date.now()
            if (now - lastReportTime > 100) {
              const { speedStr, etaStr } = tracker.update(msg.loaded, totalBytes)
              options.onProgress({
                loadedBytes: msg.loaded,
                totalBytes,
                percent: Math.min(100, Math.round((msg.loaded / totalBytes) * 100)),
                phase: msg.phase,
                speedStr,
                etaStr,
              })
              lastReportTime = now
            }
          }
          break

        case 'hash-ready': {
          const hash: string = msg.hash
          const names = options?.getEntryNames?.(hash) ?? {
            imzmlName: pair.imzml.name,
            ibdName: pair.ibd.name,
          }
          worker.postMessage({ type: 'rename', ...names })
          break
        }

        case 'done':
          cleanup()
          loadZipFromOPFS()
            .then((file) => {
              if (!file) {
                reject(new Error('Compressed file not found in OPFS'))
                return
              }
              if (options?.onProgress) {
                options.onProgress({
                  loadedBytes: totalBytes,
                  totalBytes,
                  percent: 100,
                  speedStr: '',
                  etaStr: '',
                })
              }
              resolve({ file, fileHash: msg.hash })
            })
            .catch(reject)
          break

        case 'error':
          cleanup()
          reject(new Error(msg.message))
          break
      }
    }

    worker.onerror = () => {
      cleanup()
      reject(new Error('Zip compression worker failed'))
    }

    // Phase 1: send files to worker for hashing (no entry names yet)
    worker.postMessage({
      type: 'start',
      imzml: pair.imzml,
      ibd: pair.ibd,
      chunkSize,
    })
  })
}
