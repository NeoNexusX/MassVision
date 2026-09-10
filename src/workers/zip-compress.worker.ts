import { BlobReader, ZipWriter, configure } from '@zip.js/zip.js'
import { createMD5 } from 'hash-wasm'
import { ZipPartEmitter } from '@/features/upload/utils/zipPartEmitter'

/**
 * ZIP 打包 Worker（流式）。
 *
 * 不在本地落任何完整产物：zip 输出流被切成固定大小的分片交给主线程直传 OSS，
 * 主线程确认一片才允许再产出一片。内存占用上界 = partSize × maxInFlightParts，
 * 与数据集大小无关。
 *
 * 两阶段：
 *   start    → 读两个源文件算 MD5，回 `hash-ready`（供主线程 preflight 秒传判断）
 *   compress → 用最终 entry 名压缩并逐片外发
 */

type StartMessage = {
  type: 'start'
  imzml: File
  ibd: File
  chunkSize: number
}

type CompressMessage = {
  type: 'compress'
  imzmlName: string
  ibdName: string
  partSize: number
  maxInFlightParts: number
  maxPartCount: number
  /** 续传：这些分片号已经在 OSS 上，重新生成但不再外发 */
  donePartNumbers: number[]
  /** 续传：重新生成到这个分片号时回传其 MD5，供主线程校验 zip 字节可复现 */
  verifyPartNo: number | null
}

type PartAckMessage = { type: 'part-ack' }
type PartFailMessage = { type: 'part-fail'; message: string }

type WorkerMessage = StartMessage | CompressMessage | PartAckMessage | PartFailMessage

/**
 * 固定的 entry 时间戳。
 *
 * 这不是随手写的常量：断点续传依赖「同样的输入 → 同样的 zip 字节」，
 * 只要 lastModDate 变成 new Date()，产物就不可复现，续传时已上传的分片
 * 全部作废。改动此值会使旧会话的续传校验失败（会被安全地识别并要求重传）。
 */
const ZIP_EPOCH = new Date('2026-01-01')

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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function md5Of(chunks: Uint8Array[]): Promise<string> {
  const hasher = await createMD5()
  for (const chunk of chunks) hasher.update(chunk)
  return hasher.digest()
}

/**
 * 阶段一：读两个源文件算出合并后的 MD5。
 * 注意哈希算的是**源文件**而不是 zip，所以秒传判断不需要先压缩。
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

  return { hash: hasher.digest(), fileBytes }
}

/** 阶段二：按最终 entry 名压缩，产物逐片外发 */
async function compressToParts(
  imzml: File,
  ibd: File,
  chunkSize: number,
  msg: CompressMessage,
  fileBytes: number,
  emitter: ZipPartEmitter,
): Promise<{ partCount: number; zipBytes: number }> {
  // 编解码在本 worker 内联跑（不再套一层 worker）。有原生 CompressionStream 时
  // 走原生，`level` 只对 JS 回退实现生效。
  configure({ useWebWorkers: false, chunkSize })

  let zipBytes = 0
  const sink = new WritableStream<Uint8Array>({
    async write(chunk) {
      zipBytes += chunk.byteLength
      await emitter.write(chunk)
    },
  })

  // zip64 强制开启，保证 size/offset 字段在 4GiB 以上仍然有效
  const zip = new ZipWriter(sink, { zip64: true, level: 2, lastModDate: ZIP_EPOCH })

  const entries = [
    { file: imzml, zipName: msg.imzmlName },
    { file: ibd, zipName: msg.ibdName },
  ]

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

  return { partCount: await emitter.finish(), zipBytes }
}

// ────────────────────────────────────────────────────────────

let hashed: { imzml: File; ibd: File; chunkSize: number; fileBytes: number } | null = null
let emitter: ZipPartEmitter | null = null

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data

  switch (msg.type) {
    case 'start':
      try {
        const { hash, fileBytes } = await hashFiles(msg.imzml, msg.ibd, msg.chunkSize)
        hashed = { imzml: msg.imzml, ibd: msg.ibd, chunkSize: msg.chunkSize, fileBytes }
        self.postMessage({ type: 'hash-ready', hash })
      } catch (err) {
        self.postMessage({ type: 'error', message: errorMessage(err) })
      }
      return

    case 'part-ack':
      emitter?.ack()
      return

    case 'part-fail':
      emitter?.fail(msg.message)
      return

    case 'compress': {
      if (!hashed) {
        self.postMessage({ type: 'error', message: 'compress requested before start' })
        return
      }
      emitter = new ZipPartEmitter({
        partSize: msg.partSize,
        maxInFlight: msg.maxInFlightParts,
        maxPartCount: msg.maxPartCount,
        donePartNumbers: msg.donePartNumbers,
        verifyPartNo: msg.verifyPartNo,
        emitPart: (partNo, chunks) => {
          self.postMessage({ type: 'part', partNo, blob: new Blob(chunks as BlobPart[]) })
        },
        // 主线程拿这个 MD5 跟存下来的 ETag 比对，确认本次压缩产出的字节和上次一致
        emitVerify: async (partNo, chunks) => {
          self.postMessage({ type: 'part-verify', partNo, md5: await md5Of(chunks) })
        },
      })
      try {
        const { partCount, zipBytes } = await compressToParts(
          hashed.imzml,
          hashed.ibd,
          hashed.chunkSize,
          msg,
          hashed.fileBytes,
          emitter,
        )
        self.postMessage({ type: 'done', partCount, zipBytes })
      } catch (err) {
        self.postMessage({ type: 'error', message: errorMessage(err) })
      }
      return
    }
  }
}
