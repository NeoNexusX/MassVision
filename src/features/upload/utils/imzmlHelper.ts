export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(1)} B/s`
  if (bytesPerSec < 1048576) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`
}

export function formatETA(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return 'Calculating...'
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

export interface UnifiedUploadProgress {
  stage: 'packing' | 'hashing' | 'preflight' | 'syncing' | 'uploading' | 'completed'
  percent: number
  message?: string
  speedStr?: string
  etaStr?: string
  /**
   * 分片重试告警。非致命，与 `message` 分开传 ——
   * 旧实现把重试状态塞进 message 再用 `message.includes('Retrying')` 嗅探，
   * 而实际文案里根本没有那个词，那段分支从来没执行过。
   */
  retry?: PartRetryInfo | null
}
