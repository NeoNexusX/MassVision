import { Zip, ZipDeflate } from 'fflate'
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
  const root = await navigator.storage.getDirectory()
  const fileHandle = await root.getFileHandle('pending_upload.zip', { create: true })
  const writable = await fileHandle.createWritable()

  const zip = new Zip()
  let totalCompressed = 0
  zip.ondata = (err, data, _final) => {
    if (err) throw err
    const chunk = new Uint8Array(data)
    totalCompressed += chunk.length
    writable.write(chunk)
  }

  const entries: Array<{ file: File; zipName: string }> = [
    { file: imzml, zipName: imzmlName },
    { file: ibd, zipName: ibdName },
  ]

  let loadedBytes = 0

  for (const { file, zipName } of entries) {
    const deflate = new ZipDeflate(zipName, { level: 2 })
    ;(deflate as any).mtime = new Date('2026-01-01')
    zip.add(deflate)

    let offset = 0
    while (offset < file.size) {
      const size = Math.min(chunkSize, file.size - offset)
      const buf = await readChunk(file, offset, size)
      deflate.push(new Uint8Array(buf), false)
      offset += size
      loadedBytes += size
      postProgress(loadedBytes, fileBytes, 'compressing')
    }

    deflate.push(new Uint8Array(0), true)
  }

  zip.end()
  await writable.close()
  return totalCompressed
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
