import { METADATA_FIELDS } from '../constants/metadataFields'
import type {
  CollectionMetadata,
  CollectionMetadataDraft,
  CollectionPatchPayload,
} from '../types/collection'

/**
 * 集合元数据的编辑草稿 ⇄ PATCH 载荷转换（纯函数，便于单测）。
 *
 * 草稿形态：22 个字段统一为 string（text/long）或 string[]（list），
 * 空值归一为 '' / []，让表单控件绑定简单且类型安全。
 * 载荷形态：只包含与当前值不同的字段（exclude_unset 语义），
 * 键为后端 snake_case（与 CollectionMetadata 同键）。
 */

/** 当前元数据 → 表单草稿（list 字段缺省 []，text 字段缺省 ''） */
export function toMetadataDraft(metadata: CollectionMetadata): CollectionMetadataDraft {
  // 联合键索引写入在 TS 下不可赋值，先按松化 record 组装再整体断言
  const draft: Record<string, string | string[]> = {}
  for (const field of METADATA_FIELDS) {
    const v = metadata?.[field.key]
    draft[field.key] = field.type === 'list' ? (Array.isArray(v) ? [...v] : []) : (v ?? '')
  }
  return draft as CollectionMetadataDraft
}

/**
 * 草稿 → 差量 PATCH 载荷：逐字段与当前值比较（比较前同样归一化），
 * 只保留发生变化的键。清空字段会发送 '' / []（合法的显式置空）。
 */
export function buildMetadataPatch(
  current: CollectionMetadata,
  draft: CollectionMetadataDraft,
): CollectionPatchPayload {
  const patch: CollectionPatchPayload = {}
  for (const field of METADATA_FIELDS) {
    const raw = current?.[field.key]
    const normalized = field.type === 'list' ? (Array.isArray(raw) ? raw : []) : (raw ?? '')
    if (JSON.stringify(normalized) !== JSON.stringify(draft[field.key])) {
      ;(patch as Record<string, unknown>)[field.key] = draft[field.key]
    }
  }
  return patch
}
