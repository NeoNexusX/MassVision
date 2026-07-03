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
}

export interface CompressResult {
  file: File
  fileHash: string
}

/**
 * Full pipeline: hash → compress (for resume or when hash is not needed early).
 * Kept for backward compatibility with resume flow.
 */
export async function compressImzmlToOPFS(
  pair: ImzmlFilePair,
  options?: CompressOptions & { getEntryNames?: (hash: string) => { imzmlName: string; ibdName: string } },
): Promise<CompressResult> {
  const { fileHash, startCompress } = await prepareUpload(pair, options)
  const names = options?.getEntryNames?.(fileHash) ?? {
    imzmlName: pair.imzml.name,
    ibdName: pair.ibd.name,
  }
  const file = await startCompress(names)
  return { file, fileHash }
}

// ────────────────────────────────────────────────────────────
// Two-phase upload preparation
// ────────────────────────────────────────────────────────────

export interface UploadPreparation {
  fileHash: string
  /** Call after preflight to continue with compression. Skip if preflight returned reuse. */
  startCompress: (
    entryNames: { imzmlName: string; ibdName: string },
    onProgress?: (e: CompressProgressEvent) => void,
  ) => Promise<File>
  /**
   * Terminate the paused worker without compressing (preflight reuse, or a
   * failure before compression starts). Idempotent; a no-op once compression
   * has settled or the preparation was aborted.
   */
  dispose: () => void
}

/**
 * Phase 1: start the worker, wait for hash, then pause before compression.
 * Returns the hash immediately so the caller can preflight.
 *
 * Call `startCompress(entryNames)` to resume compression. If you never call
 * it (e.g. preflight reuse), call `dispose()` — a paused dedicated worker is
 * not garbage-collected on its own.
 */
export function prepareUpload(
  pair: ImzmlFilePair,
  options?: CompressOptions,
): Promise<UploadPreparation> {
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
        case 'progress': {
          if (!options?.onProgress) break
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
          break
        }

        case 'hash-ready': {
          // Hash is ready — expose it to the caller, defer compression
          const fileHash: string = msg.hash

          resolve({
            fileHash,
            dispose: cleanup,
            startCompress: (entryNames, onProgress) => {
              return new Promise<File>((res, rej) => {
                const fail = (err: Error) => {
                  cleanup()
                  rej(err)
                }

                // Listen for abort during compression
                if (options?.signal) {
                  if (options.signal.aborted) {
                    fail(new DOMException('Aborted by user', 'AbortError'))
                    return
                  }
                  options.signal.addEventListener('abort', () => fail(new DOMException('Aborted by user', 'AbortError')), { once: true })
                }

                worker.onerror = () => fail(new Error('Zip compression worker failed'))

                worker.onmessage = (ev: MessageEvent) => {
                  const m = ev.data

                  if (m.type === 'progress' && onProgress) {
                    if (lastPhase && m.phase !== lastPhase) {
                      tracker.reset()
                      lastReportTime = 0
                    }
                    lastPhase = m.phase
                    const now = Date.now()
                    if (now - lastReportTime > 100) {
                      const { speedStr, etaStr } = tracker.update(m.loaded, totalBytes)
                      onProgress({
                        loadedBytes: m.loaded,
                        totalBytes,
                        percent: Math.min(100, Math.round((m.loaded / totalBytes) * 100)),
                        phase: m.phase,
                        speedStr,
                        etaStr,
                      })
                      lastReportTime = now
                    }
                    return
                  }

                  if (m.type === 'done') {
                    cleanup()
                    loadZipFromOPFS()
                      .then((file) => {
                        if (!file) {
                          rej(new Error('Compressed file not found in OPFS'))
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
                        res(file)
                      })
                      .catch(rej)
                    return
                  }

                  if (m.type === 'error') {
                    fail(new Error(m.message))
                    return
                  }
                }

                worker.postMessage({ type: 'rename', ...entryNames })
              })
            },
          })
          break
        }

        case 'done':
          // Shouldn't reach here in two-phase mode (handled in startCompress)
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

    // Start Phase 1: hash
    worker.postMessage({
      type: 'start',
      imzml: pair.imzml,
      ibd: pair.ibd,
      chunkSize,
    })
  })
}
