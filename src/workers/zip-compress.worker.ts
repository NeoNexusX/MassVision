import { BlobReader, ZipWriter, configure } from '@zip.js/zip.js'
import { createMD5 } from 'hash-wasm'
import { CreditGate } from '@/features/upload/utils/creditGate'
import { ZipSizeEstimator } from '@/features/upload/utils/zipSizeEstimator'
import { messageOf } from '@/features/upload/utils/uploadAbort'

/**
 * ZIP 打包 Worker（流式）。
 *
 * 不在本地落任何完整产物：zip 输出流被切成固定大小的分片交给主线程直传 OSS。
 * 背压走信用额度 —— worker 初始持有 n 点，每外发一片消耗 1 点，主线程**取走**
 * 分片时归还 1 点（与上传成败无关，见 creditGate.ts）。内存上界因此与数据集
 * 大小无关，某片进入重试也不会冻住整条压缩流水线。
 *
 * 两阶段：
 *   start    → 读两个源文件算 MD5，回 `hash-ready`（供主线程 preflight 秒传判断）
 *   compress → 用最终 entry 名压缩并逐片外发
 */

type StartMessage = {
  type: 'start'
  imzml: File
  ibd: File
  readChunkSize: number
}

type CompressMessage = {
  type: 'compress'
  imzmlName: string
  ibdName: string
  partSize: number
  /** 初始信用额度 = 主线程缓冲区容量（分片数） */
  initialCredits: number
  maxPartCount: number
  /** ibd 是否参与压缩。false → `level: 0` → zip.js 选 STORE，字节直通 */
  compressIbd: boolean
  /** 续传：这些分片号已经在 OSS 上，重新生成但不再外发 */
  donePartNumbers: number[]
  /** 续传：重新生成到这个分片号时回传其 MD5，供主线程校验 zip 字节可复现 */
  verifyPartNo: number | null
}

/** 消费端取走了分片，缓冲区空出位置 */
type CreditMessage = { type: 'credit'; count: number }
/** 消费端失败 / 中止 / zip 字节不可复现 —— 放弃整条流 */
type FailMessage = { type: 'fail'; message: string }

type WorkerMessage = StartMessage | CompressMessage | CreditMessage | FailMessage

/**
 * 固定的 entry 时间戳。不是随手写的常量：续传依赖「同样的输入 → 同样的 zip
 * 字节」，一旦换成 `new Date()` 产物就不可复现，已上传的分片全部作废。
 * 改动此值必须同时递增 `OSS_UPLOAD.zipFormatVersion`。
 */
const ZIP_EPOCH = new Date('2026-01-01')

/**
 * 压缩侧统计的上报间隔（ms）。既是节流上限也是心跳下限。
 *
 * 心跳不能省：被背压卡住时 zip.js 停止读源文件，`onprogress` 随之停发。
 * 只靠它驱动上报的话，主线程在整段停滞里看到的都是过期数据 ——
 * 而「卡住了」恰恰是最该显示出来的状态。
 */
const STATS_REPORT_INTERVAL_MS = 500

async function md5Of(chunks: Uint8Array[]): Promise<string> {
  const hasher = await createMD5()
  for (const chunk of chunks) hasher.update(chunk)
  return hasher.digest()
}

/**
 * 阶段一：读两个源文件算出合并后的 MD5。
 * 哈希算的是**源文件**而不是 zip，所以秒传判断不需要先压缩。
 *
 * 这一阶段要完整读一遍数据集（100GB 要好几分钟），而那时一个分片都还没有，
 * 所以它得有自己的字节进度 —— 上传阶段的「片数/总片数」在这里没有意义。
 */
async function hashFiles(imzml: File, ibd: File, readChunkSize: number): Promise<string> {
  const hasher = await createMD5()
  let loaded = 0

  for (const file of [imzml, ibd]) {
    for (let offset = 0; offset < file.size; offset += readChunkSize) {
      const slice = file.slice(offset, offset + readChunkSize)
      hasher.update(new Uint8Array(await slice.arrayBuffer()))
      loaded += slice.size
      // 只发已读字节：主线程自己按源文件大小算百分比，不需要这边再报一遍总量
      self.postMessage({ type: 'progress', loaded })
    }
  }

  return hasher.digest()
}

/** 阶段二：按最终 entry 名压缩，产物逐片外发 */
async function compressToParts(
  imzml: File,
  ibd: File,
  readChunkSize: number,
  msg: CompressMessage,
  gate: CreditGate,
): Promise<void> {
  // 编解码在本 worker 内联跑（不再套一层 worker）
  configure({ useWebWorkers: false, chunkSize: readChunkSize })

  let zipBytes = 0
  /** 已从源文件读出的字节数，跨越两个 entry 连续累加 */
  let srcDone = 0
  /** ibd entry 已读字节，估算器要单独用它 */
  let ibdDone = 0

  const sink = new WritableStream<Uint8Array>({
    async write(chunk) {
      zipBytes += chunk.byteLength
      await gate.write(chunk, srcDone)
    },
  })

  // zip64 强制开启，保证 size/offset 字段在 4GiB 以上仍然有效。
  //
  // 刻意**不传 level**：zip.js 默认走原生 CompressionStream（C++ zlib），
  // 而原生 API 根本没有等级参数，传了也不生效。想控制等级只能关掉原生流退回
  // JS 实现，但 JS deflate 只有 30~80MB/s，会变成绝对瓶颈，不值得。
  const zip = new ZipWriter(sink, { zip64: true, lastModDate: ZIP_EPOCH })

  const estimator = new ZipSizeEstimator({
    imzmlSize: imzml.size,
    ibdSize: ibd.size,
    compressIbd: msg.compressIbd,
  })
  let lastReportAt = 0
  /**
   * 上报压缩侧统计。三个字段的去向各不相同：
   *   estZipBytes  只用来给消息文案算「第几片 / 共几片」
   *   srcDone      压缩速度的分子
   *   stalledMs    压缩速度的分母要扣掉它（被上传拖住的时间不算压缩慢）
   *
   * `force` 用于阶段边界这类必须立刻反映的时刻，其余走节流。
   */
  const postStats = (force = false) => {
    const now = Date.now()
    if (!force && now - lastReportAt < STATS_REPORT_INTERVAL_MS) return
    lastReportAt = now
    self.postMessage({
      type: 'stats',
      estZipBytes: Math.ceil(estimator.estimate(zipBytes, ibdDone)),
      srcDone,
      stalledMs: gate.stalledMs,
    })
  }

  postStats(true)
  const heartbeat = self.setInterval(() => postStats(true), STATS_REPORT_INTERVAL_MS)

  try {
    // imzML **必须**排第一：估算器要靠它先压完拿到确切的压缩后大小，
    // 剩下的 ibd 压缩率高度均匀、很快就能外推准。
    // 换成 ibd 在前，整个过程都只能靠先验估算。
    await zip.add(msg.imzmlName, new BlobReader(imzml), {
      // imzML 也要报进度。它不一定小，而这一段没有埋点的话，压它的整段时间里
      // 既算不出压缩速度，分片也拿不到源字节跨度，进度条会一直停在 0%。
      onprogress: (progress: number) => {
        srcDone = progress
        postStats()
      },
    })
    // onprogress 不保证报到末尾，补齐到确切值，否则跨度会漏掉最后一段
    srcDone = imzml.size
    estimator.imzmlDone(zipBytes)
    postStats(true)

    await zip.add(msg.ibdName, new BlobReader(ibd), {
      // compressIbd: true（默认）什么都不传，与 imzML 同一条路径。
      // false 时传 level: 0，zip.js 据此选 STORE，字节直通、不进任何 codec；
      // 不必再设 useCompressionStream: false —— STORE 路径上没有 codec 可选。
      ...(msg.compressIbd ? {} : { level: 0 }),
      onprogress: (progress: number) => {
        ibdDone = progress
        srcDone = imzml.size + progress
        postStats()
      },
    })
    ibdDone = ibd.size
    srcDone = imzml.size + ibd.size
    // close() 写中央目录，这几个字节会带着最终的 srcDone 进 gate，
    // 于是尾片的跨度把剩余的源字节全部吸收，总和精确等于源文件大小
    await zip.close()
    postStats(true)

    // 冲刷尾片。返回的总片数没有消费方，这里只要它的副作用
    await gate.finish()
  } finally {
    self.clearInterval(heartbeat)
  }
}

// ────────────────────────────────────────────────────────────

let hashed: { imzml: File; ibd: File; readChunkSize: number } | null = null
let gate: CreditGate | null = null

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data

  switch (msg.type) {
    case 'start':
      try {
        const hash = await hashFiles(msg.imzml, msg.ibd, msg.readChunkSize)
        hashed = { imzml: msg.imzml, ibd: msg.ibd, readChunkSize: msg.readChunkSize }
        self.postMessage({ type: 'hash-ready', hash })
      } catch (err) {
        self.postMessage({ type: 'error', message: messageOf(err) })
      }
      return

    case 'credit':
      gate?.addCredits(msg.count)
      return

    case 'fail':
      gate?.fail(msg.message)
      return

    case 'compress': {
      if (!hashed) {
        self.postMessage({ type: 'error', message: 'compress requested before start' })
        return
      }
      gate = new CreditGate({
        partSize: msg.partSize,
        initialCredits: msg.initialCredits,
        maxPartCount: msg.maxPartCount,
        donePartNumbers: msg.donePartNumbers,
        verifyPartNo: msg.verifyPartNo,
        emitPart: (partNo, chunks) => {
          self.postMessage({ type: 'part', partNo, blob: new Blob(chunks as BlobPart[]) })
        },
        // 进度条的数据源。必定先于同一片的 'part' 到达 —— postMessage 通道
        // 保序，且 CreditGate 在外发之前才调用它。
        onCut: (partNo, srcSpan) => {
          self.postMessage({ type: 'cut', partNo, srcSpan })
        },
        // 主线程拿这个 MD5 跟存下来的 ETag 比对，确认本次压缩产出的字节和上次一致
        emitVerify: async (partNo, chunks) => {
          self.postMessage({ type: 'part-verify', partNo, md5: await md5Of(chunks) })
        },
      })
      try {
        await compressToParts(hashed.imzml, hashed.ibd, hashed.readChunkSize, msg, gate)
        self.postMessage({ type: 'done' })
      } catch (err) {
        self.postMessage({ type: 'error', message: messageOf(err) })
      }
      return
    }
  }
}
