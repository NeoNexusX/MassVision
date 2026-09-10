import ZipCompressWorker from '@/workers/zip-compress.worker?worker'
import { ProgressTracker, type ImzmlFilePair } from './imzmlHelper'
import { reasonOf } from './uploadAbort'

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

export interface StreamCompressOptions {
  entryNames: { imzmlName: string; ibdName: string }
  partSize: number
  maxInFlightParts: number
  maxPartCount: number
  /** 续传：这些分片号已在 OSS 上，重新生成但不再上传 */
  donePartNumbers?: number[]
  /** 续传：需要回传 MD5 做可复现性校验的分片号 */
  verifyPartNo?: number | null
  /**
   * 收到一个待上传分片。resolve 表示该片已确认落到 OSS，压缩才会继续产出；
   * reject 则整个压缩流中止。压缩端据此获得背压。
   */
  onPart: (partNo: number, blob: Blob) => Promise<void>
  /** 续传校验回调：返回 false 表示 zip 字节与上次不一致，压缩会以错误中止 */
  onVerify?: (partNo: number, md5: string) => boolean
  onProgress?: (e: CompressProgressEvent) => void
}

export interface StreamCompressResult {
  partCount: number
  zipBytes: number
}

export interface UploadPreparation {
  fileHash: string
  /**
   * preflight 之后调用，开始压缩并逐片外发。秒传命中时不要调用，改调 `dispose()`。
   */
  startCompress: (options: StreamCompressOptions) => Promise<StreamCompressResult>
  /**
   * 不压缩就终止已暂停的 worker（秒传命中，或压缩开始前就失败）。
   * 幂等；压缩已结束或已中止后是空操作。
   */
  dispose: () => void
}

/** zip 字节不可复现时抛出的哨兵，调用方据此放弃续传、重新开一轮完整上传 */
export const NON_DETERMINISTIC_ZIP = 'Archive bytes are not reproducible; cannot resume'

/**
 * 中止一律沿用 `signal.reason`（见 uploadAbort.ts）—— 新建一个 AbortError
 * 会丢掉「用户取消 / 组件卸载」的意图，上传 pipeline 的 catch 就分不了支。
 */

/**
 * 阶段一：起 worker 算源文件哈希，然后停在压缩之前。
 *
 * 立即把哈希交给调用方去做 preflight。要继续就调 `startCompress(...)`；
 * 不继续（例如秒传命中）必须调 `dispose()` —— 暂停中的专用 worker 不会被自动回收。
 */
export function prepareUpload(
  pair: ImzmlFilePair,
  options?: CompressOptions,
): Promise<UploadPreparation> {
  if (options?.signal?.aborted) {
    throw reasonOf(options.signal)
  }

  const totalBytes = pair.ibd.size + pair.imzml.size
  const chunkSize = pickChunkSize(totalBytes)
  const worker = new ZipCompressWorker()
  const tracker = new ProgressTracker()
  let lastReportTime = 0
  let lastPhase: string | undefined

  // 进度统一处理：换阶段时重置速率统计，并节流到 100ms
  const report = (
    msg: { phase?: CompressProgressEvent['phase']; loaded: number },
    cb?: (e: CompressProgressEvent) => void,
  ) => {
    if (!cb) return
    if (lastPhase && msg.phase !== lastPhase) {
      tracker.reset()
      lastReportTime = 0
    }
    lastPhase = msg.phase
    const now = Date.now()
    if (now - lastReportTime <= 100) return
    lastReportTime = now
    const { speedStr, etaStr } = tracker.update(msg.loaded, totalBytes)
    cb({
      loadedBytes: msg.loaded,
      totalBytes,
      percent: Math.min(100, Math.round((msg.loaded / totalBytes) * 100)),
      phase: msg.phase,
      speedStr,
      etaStr,
    })
  }

  return new Promise((resolve, reject) => {
    let settled = false
    // 压缩已启动时由它接管中止；为 null 表示还停在哈希阶段
    let rejectCompress: ((reason: unknown) => void) | null = null

    const cleanup = () => {
      if (settled) return
      settled = true
      worker.terminate()
      options?.signal?.removeEventListener('abort', handleAbort)
    }

    /**
     * 全流程只注册这一个中止监听器。
     *
     * 曾经是两个 —— 外层一个，startCompress 里再加一个 —— 而 cleanup 会在
     * abort 事件**派发途中**移除后者。DOM 规定：派发过程中被移除且尚未调用的
     * 监听器不再调用，于是 startCompress 的 promise 永远不 settle，整条流水线
     * 挂死在 `await prep.startCompress(...)` 上，catch 永远进不去。
     *
     * 一个监听器 + 一个路由变量，这个顺序陷阱就不存在了。
     */
    const handleAbort = () => {
      const reason = reasonOf(options?.signal)
      const rejectActive = rejectCompress ?? reject
      cleanup()
      rejectActive(reason)
    }

    options?.signal?.addEventListener('abort', handleAbort, { once: true })

    const startCompress = (opts: StreamCompressOptions) =>
      new Promise<StreamCompressResult>((res, rej) => {
        const fail = (err: unknown) => {
          cleanup()
          rej(err)
        }
        // 交接中止处理权：此后 handleAbort 要 reject 的是这个 promise
        rejectCompress = rej

        if (options?.signal?.aborted) {
          fail(reasonOf(options.signal))
          return
        }

        worker.onerror = () => fail(new Error('Zip compression worker failed'))

        worker.onmessage = (ev: MessageEvent) => {
          const m = ev.data

          switch (m.type) {
            case 'progress':
              report(m, opts.onProgress)
              return

            case 'part':
              // 上传成功才 ack —— worker 的在途窗口据此放行下一片
              opts.onPart(m.partNo, m.blob).then(
                () => worker.postMessage({ type: 'part-ack' }),
                (err: unknown) =>
                  worker.postMessage({
                    type: 'part-fail',
                    message: err instanceof Error ? err.message : String(err),
                  }),
              )
              return

            case 'part-verify':
              if (opts.onVerify && !opts.onVerify(m.partNo, m.md5)) {
                worker.postMessage({ type: 'part-fail', message: NON_DETERMINISTIC_ZIP })
              }
              return

            case 'done':
              cleanup()
              opts.onProgress?.({
                loadedBytes: totalBytes,
                totalBytes,
                percent: 100,
                phase: 'compressing',
                speedStr: '',
                etaStr: '',
              })
              res({ partCount: m.partCount, zipBytes: m.zipBytes })
              return

            case 'error':
              fail(new Error(m.message))
              return
          }
        }

        worker.postMessage({
          type: 'compress',
          imzmlName: opts.entryNames.imzmlName,
          ibdName: opts.entryNames.ibdName,
          partSize: opts.partSize,
          maxInFlightParts: opts.maxInFlightParts,
          maxPartCount: opts.maxPartCount,
          donePartNumbers: opts.donePartNumbers ?? [],
          verifyPartNo: opts.verifyPartNo ?? null,
        })
      })

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data

      switch (msg.type) {
        case 'progress':
          report(msg, options?.onProgress)
          return

        case 'hash-ready':
          resolve({ fileHash: msg.hash, dispose: cleanup, startCompress })
          return

        case 'error':
          cleanup()
          reject(new Error(msg.message))
          return
      }
    }

    worker.onerror = () => {
      cleanup()
      reject(new Error('Zip compression worker failed'))
    }

    worker.postMessage({ type: 'start', imzml: pair.imzml, ibd: pair.ibd, chunkSize })
  })
}
