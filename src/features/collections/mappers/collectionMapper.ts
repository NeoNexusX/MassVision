import type { FilePublicResponse } from '@/features/datasets/types/dataset'
import type {
  CollectionDetail,
  CollectionMember,
  CollectionMetadata,
  CollectionSummary,
} from '../types/collection'

/**
 * Collection 响应映射：顶层 snake→camel；metadata 块原样透传（snake_case），
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

function toSummary(raw: any): CollectionSummary {
  const metadata = (raw?.metadata ?? {}) as CollectionMetadata
  return {
    id: raw.id,
    name: raw.name || '',
    title: raw.title ?? null,
    description: raw?.description ?? metadata.description ?? null,
    memberCount: raw.member_count ?? 0,
    totalSize: raw.total_size ?? 0,
    ownerUsername: raw.owner_username || '',
    organism: Array.isArray(raw.organism)
      ? raw.organism
      : Array.isArray(metadata.organism)
        ? metadata.organism
        : [],
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    publicId: raw.public_id ?? null,
  }
}

/** GET /collections/{id}（及创建/加成员/调序返回的完整详情） */
export function mapCollectionDetail(raw: any): CollectionDetail {
  const members = Array.isArray(raw?.members) ? raw.members : []
  return {
    ...toSummary(raw),
    // metadata 块透传：后端返回什么就存什么，展示由 metadataFields 表驱动
    metadata: (raw?.metadata ?? { name: raw?.name || '' }) as CollectionMetadata,
    members: members.map(mapFilePublicToMember),
  }
}

/** GET /collections 列表行：详情 mapper 的子集（列表响应可能不带 members） */
export function mapCollectionSummary(raw: any): CollectionSummary {
  return toSummary(raw)
}
