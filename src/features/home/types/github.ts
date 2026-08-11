/** 热力图单元：某天的提交计数 */
export interface HeatValue {
  /** 'YYYY-MM-DD'（本地时区） */
  date: string
  count: number
}

export interface CommitHeatmapResult {
  values: HeatValue[]
  total: number
  activeDays: number
}

export interface FetchCommitHeatmapOptions {
  owner: string
  repo: string
  /** 统计哪个分支（或 ref/SHA）的提交，如 'dev' */
  branch: string
  days: number
}

/** 被 GitHub 限流时抛出，携带剩余次数与重置时间，便于 UI 友好提示。 */
export class GithubRateLimitError extends Error {
  remaining: number
  resetAt: Date | null
  constructor(remaining: number, resetAt: Date | null) {
    const at = resetAt ? resetAt.toLocaleTimeString() : '未知'
    super(`GitHub API 限流（剩余次数 ${remaining}），将于 ${at} 重置`)
    this.name = 'GithubRateLimitError'
    this.remaining = remaining
    this.resetAt = resetAt
  }
}
