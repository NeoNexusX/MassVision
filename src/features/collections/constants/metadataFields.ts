import type { CollectionMetadata } from '../types/collection'

/**
 * Collection 学术元数据的字段定义表——单一事实来源：
 * 本期驱动 CollectionMetadataPanel 的只读展示（分组渲染，空值显示「—」占位），
 * 二期编辑表单直接复用为控件定义（key 已是后端 PATCH 字段名，snake_case）。
 */

export type MetadataGroupId = 'general' | 'citation' | 'sample' | 'acquisition'

export type MetadataFieldType = 'text' | 'long' | 'list'

export interface MetadataFieldDef {
  key: keyof CollectionMetadata
  label: string
  type: MetadataFieldType
  group: MetadataGroupId
}

export const METADATA_GROUPS: { id: MetadataGroupId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'citation', label: 'Citation' },
  { id: 'sample', label: 'Sample' },
  { id: 'acquisition', label: 'Acquisition' },
]

export const METADATA_FIELDS: MetadataFieldDef[] = [
  // General
  { key: 'name', label: 'Name', type: 'text', group: 'general' },
  { key: 'description', label: 'Description', type: 'long', group: 'general' },
  { key: 'member_type', label: 'Member Type', type: 'text', group: 'general' },
  { key: 'collection_type', label: 'Collection Type', type: 'text', group: 'general' },
  // Citation
  { key: 'title', label: 'Title', type: 'text', group: 'citation' },
  { key: 'doi', label: 'DOI', type: 'list', group: 'citation' },
  { key: 'access', label: 'Access', type: 'list', group: 'citation' },
  { key: 'journal_name', label: 'Journal', type: 'text', group: 'citation' },
  { key: 'cite_information', label: 'Citation', type: 'long', group: 'citation' },
  { key: 'abstract', label: 'Abstract', type: 'long', group: 'citation' },
  // Sample
  { key: 'organism', label: 'Organism', type: 'list', group: 'sample' },
  { key: 'organism_part', label: 'Organism Part', type: 'list', group: 'sample' },
  { key: 'sample_stabilization', label: 'Sample Stabilization', type: 'list', group: 'sample' },
  { key: 'sample_growth_conditions', label: 'Growth Conditions', type: 'list', group: 'sample' },
  { key: 'tissue_modification', label: 'Tissue Modification', type: 'list', group: 'sample' },
  // Acquisition
  // （resolving_power / mz / pixel_size_* 已随集合级数值字段下线；文件级同名字段不受影响）
  { key: 'polarity', label: 'Polarity', type: 'list', group: 'acquisition' },
  { key: 'ionisation_source', label: 'Ionisation Source', type: 'list', group: 'acquisition' },
  { key: 'analyzer', label: 'Analyzer', type: 'list', group: 'acquisition' },
]

/** 该字段是否有可展示的值（空串/null/undefined/空数组都视为未填写） */
export function hasMetadataValue(metadata: CollectionMetadata, field: MetadataFieldDef): boolean {
  const v = metadata?.[field.key]
  if (v == null) return false
  if (Array.isArray(v)) return v.length > 0
  return String(v).trim() !== ''
}
