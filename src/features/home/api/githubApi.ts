/**
 * GitHub 仓库提交（commit）活跃度数据层（StatsScene 热力图用）。
 *
 * - 直接调用 GitHub 公共 REST API（未认证，不带 token）：不走项目后端 httpClient（那是另一套 baseURL/鉴权）。
 * - 未认证限流为 **60 次/小时/IP**。本模块用 localStorage 做 TTL 缓存：开发期反复刷新只在缓存过期后
 *   才真正发请求，避免把额度刷光导致 rate limit；一旦被限流且本地有旧缓存，则回退到旧缓存而不是整块报错。
 */

import { STORAGE_KEYS } from '@/shared/config'

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

/** GitHub /commits 列表里我们关心的字段 */
interface RawCommit {
  commit: {
    author: { date: string } | null
    committer: { date: string } | null
  }
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

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 小时内不重复请求
const CACHE_PREFIX = STORAGE_KEYS.githubCommitHeatmap
const MAX_PAGES = 30 // 安全上限：最多 3000 条提交，避免极端仓库无限翻页

interface CacheEntry {
  ts: number
  result: CommitHeatmapResult
}

/** 用本地时区把 Date 转成 'YYYY-MM-DD'，避免 UTC 跨零点把活动算到前一天。 */
export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function cacheKey(o: FetchCommitHeatmapOptions): string {
  return `${CACHE_PREFIX}${o.owner}/${o.repo}|${o.branch}|${o.days}`
}

function readCache(key: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as CacheEntry) : null
  } catch {
    return null
  }
}

function writeCache(key: string, result: CommitHeatmapResult): void {
  try {
    const entry: CacheEntry = { ts: Date.now(), result }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    /* localStorage 不可用（隐私模式/超额）时静默降级 */
  }
}

/** 真正请求 GitHub commits 并聚合成按天计数（含分页 + 限流识别）。 */
async function fetchCommitsFromGithub(
  o: FetchCommitHeatmapOptions,
): Promise<CommitHeatmapResult> {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - o.days + 1)
  start.setHours(0, 0, 0, 0)

  // 预填区间内每一天为 0，保证热力图连续不断
  const dateMap: Record<string, number> = {}
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    dateMap[toDateStr(new Date(d))] = 0
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  // since 直接把范围限定在统计区间内（GitHub 按 committer 时间过滤，返回按时间倒序）
  const since = start.toISOString()

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `https://api.github.com/repos/${encodeURIComponent(o.owner)}/${encodeURIComponent(o.repo)}/commits` +
      `?sha=${encodeURIComponent(o.branch)}&since=${encodeURIComponent(since)}&per_page=100&page=${page}`

    const res = await fetch(url, { headers })

    if (res.status === 403 || res.status === 429) {
      const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? '0')
      const reset = res.headers.get('x-ratelimit-reset')
      throw new GithubRateLimitError(remaining, reset ? new Date(Number(reset) * 1000) : null)
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string }
      throw new Error(body.message ?? `GitHub API 错误: ${res.status}`)
    }

    const commits = (await res.json()) as RawCommit[]
    if (commits.length === 0) break

    for (const c of commits) {
      // 与 since 的过滤口径一致，优先用 committer 时间，缺失再退到 author 时间
      const raw = c.commit.committer?.date ?? c.commit.author?.date
      if (!raw) continue
      const day = toDateStr(new Date(raw))
      // 只统计预填区间内的天；用局部变量收窄类型（noUncheckedIndexedAccess 下 dateMap[day] 为 number | undefined）
      const cur = dateMap[day]
      if (cur !== undefined) dateMap[day] = cur + 1
    }

    // 不足 100 条即末页
    if (commits.length < 100) break
  }

  const values: HeatValue[] = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
  const total = values.reduce((s, v) => s + v.count, 0)
  const activeDays = values.filter((v) => v.count > 0).length

  return { values, total, activeDays }
}

/**
 * 获取提交热力图数据。
 * 顺序：未过期缓存 → 真正请求并写缓存 → 被限流则回退到旧缓存（若有），否则抛错。
 */
export async function fetchCommitHeatmap(o: FetchCommitHeatmapOptions): Promise<CommitHeatmapResult> {
  if (!o.owner || !o.repo) {
    throw new Error('owner 和 repo 不能为空')
  }

  const key = cacheKey(o)
  const cached = readCache(key)

  // 1) 命中未过期缓存 → 直接返回，不发请求（开发期反复刷新的关键优化）
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.result
  }

  // 2) 真正请求
  try {
    const result = await fetchCommitsFromGithub(o)
    writeCache(key, result)
    return result
  } catch (e) {
    // 3) 被限流但有旧缓存 → 用旧缓存兜底，避免整块报错
    if (e instanceof GithubRateLimitError && cached) {
      return cached.result
    }
    throw e
  }
}
