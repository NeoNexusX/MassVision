/**
 * 首页统计数据层（StatsScene 左侧面板用）。
 *
 * - 这些是**首页公开数据**，统一走公开的 `api`（不带 token），不要用 auth_api。
 * - 约定：本模块所有函数都返回**解包后的响应体**（res.data），调用方不处理 axios 信封。
 *   （与 datasets/api/datasetApi.ts 保持一致。）
 */

import { api } from '@/shared/api/httpClient'

// ──────────────────────────────────────────────────────────────────────────
// 数据集分类 / 离子源类型分布（环形图数据源）
// ──────────────────────────────────────────────────────────────────────────

/** 环形图单段：某个数据集分类及其数量 */
export interface DatasetCategoryItem {
  category: string
  count: number
}

/** 数据集分类分布响应体 */
export interface DatasetCategoryStats {
  items: DatasetCategoryItem[]
  /** 所有分类计数之和；后端可不返回，前端可自行累加兜底 */
  total: number
}

/** GET /stats/files/classification?field= — 按指定字段统计文件分类数量 */
export async function getFilesClassification(field: string): Promise<Record<string, number>> {
  const res = await api.get('/stats/files/classification', { params: { field } })
  return res.data
}

/** 将 { key: count } 映射为 DonutStatSection 所需的 { items, total } 格式 */
function classificationToCategoryStats(data: Record<string, number>): DatasetCategoryStats {
  const items = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
  const total = items.reduce((sum, item) => sum + item.count, 0)
  return { items, total }
}

/** GET /stats/files/classification?field=organism_part —— 数据集组织部位分布（环形图上方） */
export async function getDatasetCategoryStats(): Promise<DatasetCategoryStats> {
  const data = await getFilesClassification('organism_part')
  return classificationToCategoryStats(data)
}

/** GET /stats/files/classification?field=ionisation_source —— 数据集离子源类型分布（环形图下方） */
export async function getDatasetIonSourceStats(): Promise<DatasetCategoryStats> {
  const data = await getFilesClassification('ionisation_source')
  return classificationToCategoryStats(data)
}

// ──────────────────────────────────────────────────────────────────────────
// ③ 平台总览（首页三个 stat）
// ──────────────────────────────────────────────────────────────────────────

/** 平台总览响应体（字段沿用后端 FastAPI 的 snake_case 习惯） */
export interface PlatformOverviewStats {
  /** 总用户数 */
  total_users: number
  /** 总数据集数 */
  total_files: number
  /** 总下载数 */
  total_downloads: number
}

const PLATFORM_OVERVIEW_PATH = '/stats/overview'

/** GET /stats/overview —— 获取平台总览（总用户 / 总数据集 / 总下载） */
export async function getPlatformOverview(): Promise<PlatformOverviewStats> {
  const res = await api.get(PLATFORM_OVERVIEW_PATH)
  return res.data
}
