import type OSS from 'ali-oss'
import { OSS_UPLOAD } from '@/shared/config'
import type { PartRetryInfo } from './imzmlHelper'
import { isAbortLike, messageOf } from './uploadAbort'

export interface DonePart {
  number: number
  etag: string
}

export interface MultipartOptions {
  /**
   * 单个分片的上传超时（ms）。必填，一般传 `OSS_UPLOAD.partTimeout`。
   *
   * 做成参数而不是在这里读常量，只是为了能在测试里缩短它。
   * 取值的权衡见 `OSS_UPLOAD.partTimeout` 的注释。
   */
  partTimeout: number
  /** 用户中止 / 组件卸载。用于打断退避等待并停止后续重试 */
  signal?: AbortSignal
  /**
   * 分片重试中（非致命）。重试成功后以 `null` 调用一次，让 UI 清掉告警。
   * 没有这个回调时，用户在长达数分钟的重试里只能看到一个冻住的进度条。
   */
  onRetry?: (info: PartRetryInfo | null) => void
}

export interface MultipartUploadSession {
  readonly uploadId: string
  /** 已确认落到 OSS 的分片，按上传完成顺序追加（并发上传会乱序） */
  readonly doneParts: DonePart[]
  uploadPart(partNo: number, blob: Blob): Promise<void>
  complete(): Promise<void>
  abort(): Promise<void>
}

/** OSS 的 ETag 带引号且大小写不定，比较前统一 */
export function normalizeEtag(etag: string): string {
  return etag.replace(/"/g, '').trim().toUpperCase()
}

/** 第 `retryIndex` 次重试之前要等多久：1s、2s、4s…… 封顶 8s */
const backoffMs = (retryIndex: number) => Math.min(1000 * 2 ** retryIndex, 8000)

/**
 * 可被中止打断的退避等待。
 *
 * ali-oss 6.23 在浏览器端**没有**取消已发出请求的手段（`urllib` 被映射到
 * shims/xhr.js，只有超时驱动的内部 abort；`client.cancel()` 的 cancelFlag
 * 只被 `multipartUpload` 自己的循环消费，裸 `uploadPart` 不看）。
 * 已经在飞的那一个请求拦不住，但退避等待和后续重试可以立刻停。
 * 这管的不是用户的等待时间（中止后流水线不再 await 这些分片），而是后台残留：
 * 没有它，一个被放弃的重试循环还会在后台白传约 8 分钟的数据。
 */
function interruptibleSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason)
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal!.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * 打开（或接续）一次 OSS 分片上传。
 *
 * 与 `client.multipartUpload()` 的区别：那个 API 要求先有一个完整的 File，
 * 这里则是外部把分片一片片喂进来，配合压缩流实现「边压边传、不落盘」。
 *
 * 单片失败会带指数退避重试 `OSS_UPLOAD.partRetries` 次（当前 = 1，共 2 次尝试），
 * 每次都通过 `onRetry` 上报，UI 据此显示「第 N 片失败，正在第 X/Y 次重试」。
 *
 * 任一分片耗尽尝试次数即抛出，上层据此停掉整条流水线并保留会话供续传 ——
 * 不需要单独的熔断逻辑，第一个耗尽的分片已经把整轮停掉了。
 */
export async function openMultipartSession(
  client: OSS,
  ossPath: string,
  existing: { uploadId: string; doneParts: DonePart[] } | undefined,
  options: MultipartOptions,
): Promise<MultipartUploadSession> {
  const uploadId = existing?.uploadId ?? (await client.initMultipartUpload(ossPath)).uploadId
  const doneParts: DonePart[] = existing ? [...existing.doneParts] : []
  const { signal, partTimeout, onRetry } = options

  return {
    uploadId,
    doneParts,

    async uploadPart(partNo, blob) {
      let lastError: unknown
      let retried = false

      for (let attempt = 0; attempt <= OSS_UPLOAD.partRetries; attempt++) {
        // 每轮开头检查：中止后不再发起新的尝试
        if (signal?.aborted) throw signal.reason
        if (attempt > 0) await interruptibleSleep(backoffMs(attempt - 1), signal)
        try {
          const result = await client.uploadPart(ossPath, uploadId, partNo, blob, 0, blob.size, {
            timeout: partTimeout,
            // 把 ali-oss 浏览器端的默认值手动补回来：它的两个高层入口（put、
            // multipartUpload）都默认关掉 Content-MD5，因为浏览器里只能用纯 JS
            // 算，而底层的 uploadPart 只是原样转发 options、没有这层包装。
            // 我们为了不落盘必须走底层 API，于是附带丢掉了这个默认值。
            //
            // 开着的代价实测：每片 50MB 阻塞主线程约 600ms，且中间会展开成
            // 一千二百万元素的 JS 数组（堆尖峰 357MB）。
            // 关掉之后完整性由 TLS 和 OSS 返回的 ETag（即分片 MD5）保证。
            disabledMD5: true,
          })
          // 中止期间完成的分片不记账：它对应的 uploadId 可能马上就被作废了
          if (signal?.aborted) throw signal.reason
          doneParts.push({ number: partNo, etag: result.etag })
          if (retried) onRetry?.(null)
          return
        } catch (err) {
          if (isAbortLike(err)) throw err
          lastError = err
          if (attempt < OSS_UPLOAD.partRetries) {
            retried = true
            onRetry?.({
              partNo,
              attempt: attempt + 1,
              maxAttempts: OSS_UPLOAD.partRetries + 1,
              reason: messageOf(err),
              nextRetryInMs: backoffMs(attempt),
            })
          }
        }
      }
      throw new Error(
        `OSS part ${partNo} failed after ${OSS_UPLOAD.partRetries + 1} attempts: ${messageOf(lastError)}`,
      )
    },

    async complete() {
      // 这里刻意不排序：ali-oss 的 completeMultipartUpload 内部已经 concat 出副本、
      // 按 number 升序排过并去重（见 ali-oss/lib/common/multipart.js），
      // 再排一次纯属重复。原数组不会被它改动。
      await client.completeMultipartUpload(ossPath, uploadId, doneParts)
    },

    async abort() {
      await client.abortMultipartUpload(ossPath, uploadId)
    },
  }
}
