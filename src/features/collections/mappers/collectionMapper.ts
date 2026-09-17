import type { FilePublicResponse } from '@/features/datasets/types/dataset'
import { METADATA_FIELDS } from '../constants/metadataFields'
import type {
  CollectionDetail,
  CollectionMember,
  CollectionMetadata,
  CollectionSummary,
} from '../types/collection'

/**
 * Collection 响应映射：顶层 snake→camel；元数据字段原样透传（snake_case），
 * 与 types/collection.ts 的混合策略一致。
 */

function mapFilePublicToMember(raw: FilePublicResponse): CollectionMember {
  return {
    id: raw.file_id,
    filename: raw.filename || '',
    size: raw.size ?? 0,
    status: raw.status || '',
    isPublic: !!raw.is_public,
    experimentType: raw.experiment_type ?? null,
  }
}

/**
 * 提取学术元数据块。后端把元数据字段**平铺在响应顶层**（实测 GET /collections：
 * name/doi/organism/analyzer… 与 id/member_count 同级，没有嵌套的 metadata 对象），
 * 因此以 metadataFields 表为字段清单从顶层挑选；若将来改为嵌套 metadata 对象也兼容。
 */
function toMetadata(raw: any): CollectionMetadata {
  const nested = raw?.metadata
  const source =
    nested && typeof nested === 'object' && Object.keys(nested).length > 0 ? nested : raw
  const out: Record<string, unknown> = {}
  for (const field of METADATA_FIELDS) {
    if (source?.[field.key] !== undefined) out[field.key] = source[field.key]
  }
  if (!out.name) out.name = raw?.name || ''
  return out as unknown as CollectionMetadata
}

/** 顶层优先、其次元数据块；统一成 string[] 便于卡片直接渲染 */
function toStringList(raw: any, metadata: CollectionMetadata, key: string): string[] {
  const top = raw?.[key]
  if (Array.isArray(top)) return top.filter((v) => v != null && String(v).trim() !== '')
  const fromMeta = (metadata as unknown as Record<string, unknown>)[key]
  if (Array.isArray(fromMeta)) {
    return fromMeta.filter((v) => v != null && String(v).trim() !== '')
  }
  return []
}

function toSummary(raw: any): CollectionSummary {
  const metadata = toMetadata(raw)
  return {
    id: raw.id,
    name: raw.name || '',
    title: raw.title || null,
    description: raw?.description ?? metadata.description ?? null,
    memberCount: raw.member_count ?? 0,
    totalSize: raw.total_size ?? 0,
    ownerUsername: raw.owner_username || '',
    organism: toStringList(raw, metadata, 'organism'),
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    publicId: raw.public_id ?? null,
    doi: toStringList(raw, metadata, 'doi'),
    journalName: raw.journal_name ?? metadata.journal_name ?? null,
    publishTime: raw.publish_time ?? null,
    access: toStringList(raw, metadata, 'access'),
    organismPart: toStringList(raw, metadata, 'organism_part'),
    ionisationSource: toStringList(raw, metadata, 'ionisation_source'),
    members: Array.isArray(raw?.members)
      ? raw.members.map(mapFilePublicToMember)
      : undefined,
  }
}

/** GET /collections/{id}（及创建/加成员/调序返回的完整详情） */
export function mapCollectionDetail(raw: any): CollectionDetail {
  const members = Array.isArray(raw?.members) ? raw.members : []
  return {
    ...toSummary(raw),
    metadata: toMetadata(raw),
    members: members.map(mapFilePublicToMember),
  }
}

/** GET /collections 列表行：详情 mapper 的子集（列表响应可能不带 members） */
export function mapCollectionSummary(raw: any): CollectionSummary {
  return toSummary(raw)
}
