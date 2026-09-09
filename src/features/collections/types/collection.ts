/** 集合（Collection）：把相关 dataset 组织在一起的策展容器。设计阶段仅前端使用。 */
export interface Collection {
  id: string
  name: string
  /** 1–3 行简介，列表卡片上 line-clamp-3 截断 */
  description: string
  /** Public / Private 可见性 */
  isPublic: boolean
  /** 创建者用户名 */
  owner: string
  /** 最近更新时间（ISO 字符串），列表默认按此倒序 */
  updatedAt: string
  /** 成员 dataset 数量 */
  datasetCount: number
  /** 覆盖的物种（去重），卡片上最多展示 3 个 chip，其余折叠为 “+N more” */
  organisms: string[]
  /** 有序成员 dataset id。后端就绪后列表接口只返回 datasetCount，
   *  成员列表应由集合详情接口提供；mock 阶段存在 store 里供 Edit 预选复用。 */
  datasetIds?: string[]
}

export type CollectionSortKey = 'updated_desc' | 'name_asc' | 'count_desc'

/** Create / Edit 提交的表单内容 */
export interface CollectionDraft {
  name: string
  description: string
  isPublic: boolean
  /** 有序成员 dataset id 列表，对应未来 POST /collections 的 dataset_ids 字段。
   *  Edit 弹窗透传原集合的 datasetIds 以保留成员。 */
  datasetIds: string[]
  /** 从成员 dataset.organism 汇总（去重、按首次出现排序）。
   *  真实后端会按 dataset_ids 自行汇总，无需前端传；mock 用它组装列表卡片。 */
  organisms?: string[]
}

/** 与后端列表接口对齐的分页元信息（形状同 listFiles 返回的 meta） */
export interface CollectionListMeta {
  current_page: number
  total_pages: number
  total_records: number
}

export interface CollectionListResult {
  data: Collection[]
  meta: CollectionListMeta
}
