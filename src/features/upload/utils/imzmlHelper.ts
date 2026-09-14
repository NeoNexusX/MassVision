export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(1)} B/s`
  if (bytesPerSec < 1048576) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`
}

/**
 * 「剩余时间尚无法估算」的哨兵值。本文件会被压缩 worker 引用，worker 里没有 i18n，
 * 所以这里只返回固定英文，由 UploadProgressPanel 比对后换成当前语言的文案。
 */
export const ETA_CALCULATING = 'Calculating...'

export function formatETA(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return ETA_CALCULATING
  if (seconds > 3600) return '>1h'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

export class ProgressTracker {
  private lastReportTime = Date.now()
  private lastLoaded = 0
  private speed = 0

  /** Call when starting a new phase to avoid stale state bleeding into speed calculation. */
  reset() {
    this.lastReportTime = Date.now()
    this.lastLoaded = 0
    this.speed = 0
  }

  update(loaded: number, total: number) {
    const now = Date.now()
    const dt = (now - this.lastReportTime) / 1000
    if (dt >= 0.5) {
      this.speed = (loaded - this.lastLoaded) / dt
      this.lastReportTime = now
      this.lastLoaded = loaded
    }
    const remBytes = total - loaded
    const eta = this.speed > 0 ? remBytes / this.speed : -1
    return { speedStr: formatSpeed(this.speed), etaStr: formatETA(eta) }
  }
}

export interface ImzmlFilePair {
  ibd: File
  imzml: File
  baseName: string
}

/** 单个分片正在重试。非致命 —— 重试成功后会以 `retry: null` 清除 */
export interface PartRetryInfo {
  partNo: number
  /** 第几次重试，1-based */
  attempt: number
  maxAttempts: number
  /** OSS 返回的原始错误，直接展示给用户 */
  reason: string
  nextRetryInMs: number
}

/**
 * imzML entry 已全部落到 OSS 的那一刻的结算。
 *
 * 上传速率刻意用**线路字节**口径，与面板上源字节口径的 `uploadSpeedStr` 不同：
 * imzML 是 XML，压缩率约 0.2，源字节口径在这一段会给出比后续常态高四五倍的
 * 数字，公布出去之后用户会眼看着它一路下跌，误以为出了问题。
 * 压缩速率仍用源字节 —— 它本来就该是。
 */
export interface ImzmlMilestone {
  /** 线路字节/s 的平均上传速率。样本不足（如续传时整段被跳过）时为空串 */
  uploadSpeedStr: string
  /** 源字节/s 的平均压缩速率。样本不足时为空串 */
  compressSpeedStr: string
}

export interface UnifiedUploadProgress {
  stage: 'packing' | 'hashing' | 'preflight' | 'syncing' | 'uploading' | 'completed'
  percent: number
  message?: string
  /**
   * 端到端速度（源字节/s）。哈希阶段是读盘速度；上传阶段分母是压缩开始至今的
   * 全部挂钟时间，什么都不扣 —— 这正是用户体感的速度，也是 ETA 的分母。
   * 下面两个速度是它的拆解，分母各自更窄。
   */
  speedStr?: string
  etaStr?: string
  /** 压缩速度（源字节/s），分母已扣掉被背压卡住的时间 */
  compressSpeedStr?: string
  /** 上传速度（源字节/s），分母是「至少一片在飞」的时间 */
  uploadSpeedStr?: string
  /** 谁让对方等得更久。样本不足时为 null */
  bottleneck?: 'upload' | 'compress' | null
  /**
   * imzML entry 全部落到 OSS 时的一次性结算，此后每条进度都原样带着。
   * 单独一个字段而不是塞进 `message`：ibd 段往往要跑很久，这条信息在整个后半程
   * 都是有用的上下文，得常驻，塞进 message 会被下一条进度直接冲掉。
   */
  imzmlMilestone?: ImzmlMilestone | null
  /** 已确认落到 OSS 的源字节 / 源文件总大小，用于「已安全上传 X / Y」 */
  doneSourceBytes?: number
  totalSourceBytes?: number
  /**
   * 分片重试告警。非致命，与 `message` 分开传 ——
   * 旧实现把重试状态塞进 message 再用 `message.includes('Retrying')` 嗅探，
   * 而实际文案里根本没有那个词，那段分支从来没执行过。
   */
  retry?: PartRetryInfo | null
}
