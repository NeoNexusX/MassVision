/**
 * 首页统计数据层（StatsScene 左侧面板用）。
 *
 * - 这些是**首页公开数据**，统一走公开的 `api`（不带 token），不要用 auth_api。
 * - 约定：本模块所有函数都返回**解包后的响应体**（res.data），调用方不处理 axios 信封。
 *   （与 datasets/api/datasetApi.ts 保持一致。）
 *
 * ⚠️ 后端这几个接口目前尚未实现：路径先以空字符串占位（见下方 *_PATH 常量）。
 *   路径为空时，函数返回下方的占位**假数据**（带一点模拟延迟，保留 loading 态），先保证页面有内容可展示；
 *   后端就绪后把真实路径填进常量即可自动切换到真实请求，调用代码无需改动（mock 分支随后可删）。
 */

import { api } from '@/shared/api/httpClient'

// 后端就绪前的占位假数据公共延迟：模拟一次网络往返，让 loading 态可见。
const MOCK_DELAY_MS = 600
function mockResponse<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), MOCK_DELAY_MS))
}

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

/** 统一工厂：两个分布接口结构一致 ({category,count}+total)，只是数据源不同。 */
function createDistributionFetcher(path: string, mockData: DatasetCategoryStats) {
  return async (): Promise<DatasetCategoryStats> => {
    if (!path) return mockResponse(mockData)
    const res = await api.get(path)
    return res.data
  }
}

// TODO(后端): 数据集分类分布接口路径，例如 '/stats/dataset-categories'。后端就绪后填入。
const DATASET_CATEGORY_STATS_PATH = ''
const MOCK_DATASET_CATEGORY_STATS: DatasetCategoryStats = {
  items: [
    { category: 'Proteomics', count: 42 },
    { category: 'Metabolomics', count: 31 },
    { category: 'Spatial Transcriptomics', count: 24 },
    { category: 'Lipidomics', count: 18 },
    { category: 'Glycomics', count: 9 },
    { category: 'Other', count: 7 },
  ],
  total: 131,
}

/** GET <DATASET_CATEGORY_STATS_PATH> —— 获取数据集分类分布 */
export const getDatasetCategoryStats = createDistributionFetcher(
  DATASET_CATEGORY_STATS_PATH,
  MOCK_DATASET_CATEGORY_STATS,
)

// TODO(后端): 离子源类型分布接口路径，例如 '/stats/dataset-ion-sources'。后端就绪后填入。
const DATASET_ION_SOURCE_STATS_PATH = ''
const MOCK_DATASET_ION_SOURCE_STATS: DatasetCategoryStats = {
  items: [
    { category: 'ESI', count: 48 },
    { category: 'MALDI', count: 33 },
    { category: 'APCI', count: 19 },
    { category: 'EI', count: 14 },
    { category: 'APPI', count: 8 },
    { category: 'DESI', count: 6 },
    { category: 'Other', count: 3 },
  ],
  total: 131,
}

/** GET <DATASET_ION_SOURCE_STATS_PATH> —— 获取数据集离子源类型分布 */
export const getDatasetIonSourceStats = createDistributionFetcher(
  DATASET_ION_SOURCE_STATS_PATH,
  MOCK_DATASET_ION_SOURCE_STATS,
)

// ──────────────────────────────────────────────────────────────────────────
// ③ 平台总览（首页三个 stat）
// ──────────────────────────────────────────────────────────────────────────

/** 平台总览响应体（字段沿用后端 FastAPI 的 snake_case 习惯） */
export interface PlatformOverviewStats {
  /** 总用户数 */
  total_users: number
  /** 总数据集数 */
  total_datasets: number
  /** 总下载数 */
  total_downloads: number
}

// TODO(后端): 平台总览接口路径，例如 '/stats/overview'。后端就绪后填入。
const PLATFORM_OVERVIEW_PATH = ''

// 占位假数据（后端就绪后可删）
const MOCK_PLATFORM_OVERVIEW: PlatformOverviewStats = {
  total_users: 1287,
  total_datasets: 342,
  total_downloads: 5821,
}

/** GET <PLATFORM_OVERVIEW_PATH> —— 获取平台总览（总用户 / 总数据集 / 总下载） */
export async function getPlatformOverview(): Promise<PlatformOverviewStats> {
  // 后端未接入：返回假数据；填入 PLATFORM_OVERVIEW_PATH 后自动改走真实请求。
  if (!PLATFORM_OVERVIEW_PATH) return mockResponse(MOCK_PLATFORM_OVERVIEW)
  const res = await api.get(PLATFORM_OVERVIEW_PATH)
  return res.data
}
