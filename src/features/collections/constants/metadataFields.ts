import type { CollectionMetadata } from '../types/collection'
import { t } from '@/i18n'

/**
 * Collection 学术元数据的字段定义表——单一事实来源：
 * 本期驱动 CollectionMetadataPanel 的只读展示（分组渲染，空值显示「—」占位），
 * 二期编辑表单直接复用为控件定义（key 已是后端 PATCH 字段名，snake_case）。
 */

export type MetadataGroupId = 'general' | 'citation' | 'sample' | 'acquisition'

export type MetadataFieldType = 'text' | 'long' | 'list'

export interface MetadataFieldDef {
  key: keyof CollectionMetadata
  /** 显示名 getter：表是模块顶层常量，文案必须在渲染时按当前语言取（在模板 / computed 里调用） */
  label: () => string
  type: MetadataFieldType
  group: MetadataGroupId
}

export const METADATA_GROUPS: { id: MetadataGroupId; label: () => string }[] = [
  { id: 'general', label: () => t('collections.group.general') },
  { id: 'citation', label: () => t('collections.group.citation') },
  { id: 'sample', label: () => t('collections.group.sample') },
  { id: 'acquisition', label: () => t('collections.group.acquisition') },
]

export const METADATA_FIELDS: MetadataFieldDef[] = [
  // General
  { key: 'name', label: () => t('common.field.name'), type: 'text', group: 'general' },
  { key: 'description', label: () => t('collections.meta.description'), type: 'long', group: 'general' },
  { key: 'member_type', label: () => t('collections.meta.memberType'), type: 'text', group: 'general' },
  { key: 'collection_type', label: () => t('collections.meta.collectionType'), type: 'text', group: 'general' },
  // Citation
  { key: 'title', label: () => t('collections.meta.title'), type: 'text', group: 'citation' },
  { key: 'doi', label: () => t('collections.meta.doi'), type: 'list', group: 'citation' },
  { key: 'access', label: () => t('collections.meta.access'), type: 'list', group: 'citation' },
  { key: 'journal_name', label: () => t('collections.meta.journal'), type: 'text', group: 'citation' },
  { key: 'cite_information', label: () => t('collections.meta.citation'), type: 'long', group: 'citation' },
  { key: 'abstract', label: () => t('collections.meta.abstract'), type: 'long', group: 'citation' },
  // Sample
  { key: 'organism', label: () => t('common.meta.organism'), type: 'list', group: 'sample' },
  { key: 'organism_part', label: () => t('common.meta.organismPart'), type: 'list', group: 'sample' },
  { key: 'sample_stabilization', label: () => t('common.meta.sampleStabilization'), type: 'list', group: 'sample' },
  { key: 'sample_growth_conditions', label: () => t('common.meta.growthConditions'), type: 'list', group: 'sample' },
  { key: 'tissue_modification', label: () => t('common.meta.tissueModification'), type: 'list', group: 'sample' },
  // Acquisition
  // （resolving_power / mz / pixel_size_* 已随集合级数值字段下线；文件级同名字段不受影响）
  { key: 'polarity', label: () => t('common.meta.polarity'), type: 'list', group: 'acquisition' },
  { key: 'ionisation_source', label: () => t('common.meta.ionisationSource'), type: 'list', group: 'acquisition' },
  { key: 'analyzer', label: () => t('common.meta.analyzer'), type: 'list', group: 'acquisition' },
]

/** 该字段是否有可展示的值（空串/null/undefined/空数组都视为未填写） */
export function hasMetadataValue(metadata: CollectionMetadata, field: MetadataFieldDef): boolean {
  const v = metadata?.[field.key]
  if (v == null) return false
  if (Array.isArray(v)) return v.length > 0
  return String(v).trim() !== ''
}
