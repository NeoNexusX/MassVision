import { BlobReader, ZipWriter, configure } from '@zip.js/zip.js'
import { createMD5 } from 'hash-wasm'

type StartMessage = {
  type: 'start'
  imzml: File
  ibd: File
  chunkSize: number
}

type RenameMessage = {
  type: 'rename'
  imzmlName: string
  ibdName: string
}

type WorkerMessage = StartMessage | RenameMessage

function readChunk(file: File, offset: number, size: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file.slice(offset, offset + size))
  })
}

function postProgress(loaded: number, total: number, phase: 'hashing' | 'compressing') {
  self.postMessage({ type: 'progress', loaded, total, phase })
}

/**
 * Phase 1: read both files and compute the combined MD5 hash.
 */
async function hashFiles(
  imzml: File,
  ibd: File,
  chunkSize: number,
): Promise<{ hash: string; fileBytes: number }> {
  const hasher = await createMD5()
  const files = [imzml, ibd]
  const fileBytes = imzml.size + ibd.size
  let loadedBytes = 0

  for (const file of files) {
    let offset = 0
    while (offset < file.size) {
      const size = Math.min(chunkSize, file.size - offset)
      const buf = await readChunk(file, offset, size)
      hasher.update(new Uint8Array(buf))
      offset += size
      loadedBytes += size
      postProgress(loadedBytes, fileBytes, 'hashing')
    }
  }

  const hash = hasher.digest()
  return { hash, fileBytes }
}

/**
 * Max bytes buffered between the compressor and OPFS disk writes.
 * Large enough that compression never stalls on disk latency spikes,
 * small enough to bound worker memory.
 */
const WRITE_BUFFER_HIGH_WATER = 256 * 1024 * 1024

/**
 * Wrap an OPFS writable in a WritableStream with backpressure: writes are
 * queued so compression and disk I/O overlap, but once the queued amount
 * reaches WRITE_BUFFER_HIGH_WATER the producer pauses until the queue drains.
 */
function createOpfsSink(writable: FileSystemWritableFileStream): {
  stream: WritableStream<Uint8Array<ArrayBuffer>>
  bytesWritten: () => number
} {
  let buffered = 0
  let written = 0
  let chain: Promise<void> = Promise.resolve()

  const stream = new WritableStream<Uint8Array<ArrayBuffer>>({
    write(chunk) {
      buffered += chunk.byteLength
      chain = chain
        .then(() => writable.write(chunk))
        .then(() => {
          buffered -= chunk.byteLength
          written += chunk.byteLength
        })
      if (buffered >= WRITE_BUFFER_HIGH_WATER) return chain
    },
    async close() {
      await chain
      await writable.close()
    },
    async abort(reason) {
      await writable.abort(reason)
    },
  })

  return { stream, bytesWritten: () => written }
}

/**
 * Phase 2: compress imzml + ibd into a ZIP in OPFS with the given entry names.
 */
async function compressWithNames(
  imzml: File,
  ibd: File,
  chunkSize: number,
  imzmlName: string,
  ibdName: string,
  fileBytes: number,
): Promise<number> {
  // Codecs run inline in this worker (no nested workers). Native
  // CompressionStream is used when available; `level` applies to the JS fallback.
  configure({ useWebWorkers: false, chunkSize })

  const root = await navigator.storage.getDirectory()
  const fileHandle = await root.getFileHandle('pending_upload.zip', { create: true })
  const writable = await fileHandle.createWritable()
  const { stream, bytesWritten } = createOpfsSink(writable)

  // zip64 is forced so size/offset fields stay valid past 4 GiB.
  const zip = new ZipWriter(stream, {
    zip64: true,
    level: 2,
    lastModDate: new Date('2026-01-01'),
  })

  const entries: Array<{ file: File; zipName: string }> = [
    { file: imzml, zipName: imzmlName },
    { file: ibd, zipName: ibdName },
  ]

  try {
    let doneBytes = 0
    for (const { file, zipName } of entries) {
      await zip.add(zipName, new BlobReader(file), {
        onprogress: (progress) => {
          postProgress(doneBytes + progress, fileBytes, 'compressing')
        },
      })
      doneBytes += file.size
    }
    await zip.close()
  } catch (err) {
    try {
      await writable.abort()
    } catch {
      /* already closed or aborted */
    }
    throw err
  }

  return bytesWritten()
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data

  if (msg.type === 'start') {
    const { imzml, ibd, chunkSize } = msg

    try {
      // ── Phase 1: Hash (fast, no progress) ──
      const { hash, fileBytes } = await hashFiles(imzml, ibd, chunkSize)
      self.postMessage({ type: 'hash-ready', hash })

      // ── Wait for rename message with final entry names ──
      self.onmessage = async (ev: MessageEvent<RenameMessage>) => {
        const renameMsg = ev.data
        if (renameMsg.type !== 'rename') return
        const { imzmlName, ibdName } = renameMsg

        try {
          // ── Phase 2: Compress with renamed entries ──
          const totalCompressed = await compressWithNames(
            imzml, ibd, chunkSize,
            imzmlName, ibdName,
            fileBytes,
          )
          self.postMessage({ type: 'done', hash, totalBytes: totalCompressed })
        } catch (err: any) {
          self.postMessage({ type: 'error', message: err?.message || String(err) })
        }
      }
    } catch (err: any) {
      self.postMessage({ type: 'error', message: err?.message || String(err) })
    }
  }
}
