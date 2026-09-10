import { api, auth_api, extractBackendError } from '@/shared/api/httpClient'
import { mapCollectionDetail, mapCollectionSummary } from '../mappers/collectionMapper'
import type {
  CollectionApiError,
  CollectionCreatePayload,
  CollectionDetail,
  CollectionPatchPayload,
  CollectionSummary,
  MemberRemovalResult,
} from '../types/collection'

/**
 * Collection API 客户端。约定（同 datasetApi）：所有函数返回解包后的响应体，
 * 并已通过 collectionMapper 转成前端类型；错误统一转成 CollectionApiError
 * （携带 status + 后端 detail 原文），供 composable 判定 409/403/404 细分文案。
 *
 * 除公开页（getPublicCollection 走免登录 api 实例）外全部 auth_api。
 */

function toCollectionApiError(err: any): CollectionApiError {
  const e = new Error(extractBackendError(err, 'Collection request failed')) as CollectionApiError
  e.status = err?.response?.status
  // 409 的 detail 是字符串原文（invalid collection members 等）；422 时是校验数组，String 化即可
  const detail = err?.response?.data?.detail
  e.backendMessage = typeof detail === 'string' ? detail : String(detail ?? e.message)
  return e
}

async function unwrap<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await fn()).data
  } catch (err) {
    throw toCollectionApiError(err)
  }
}

/** 响应信封防御归一：GET /collections 可能是纯数组或 { data } / { items } 信封 */
function normalizeList(body: any): any[] {
  if (Array.isArray(body)) return body
  if (body && Array.isArray(body.data)) return body.data
  if (body && Array.isArray(body.items)) return body.items
  return []
}

// GET /collections — 我的集合列表（按 updated_at 倒序，后端无分页/搜索参数）
export async function listMyCollections(): Promise<CollectionSummary[]> {
  const body = await unwrap(() => auth_api.get('/collections'))
  return normalizeList(body).map(mapCollectionSummary)
}

// GET /collections/{id} — 详情 + 有序成员
export async function getCollection(id: number): Promise<CollectionDetail> {
  const body = await unwrap(() => auth_api.get(`/collections/${id}`))
  return mapCollectionDetail(body)
}

// POST /collections — 创建；file_ids 顺序 = position，响应为完整 CollectionDetail
export async function createCollection(payload: CollectionCreatePayload): Promise<CollectionDetail> {
  const body = await unwrap(() => auth_api.post('/collections', payload))
  return mapCollectionDetail(body)
}

// PATCH /collections/{id} — 元数据部分更新（exclude_unset），响应为完整 CollectionDetail
export async function updateCollection(
  id: number,
  patch: CollectionPatchPayload,
): Promise<CollectionDetail> {
  const body = await unwrap(() => auth_api.patch(`/collections/${id}`, patch))
  return mapCollectionDetail(body)
}

// DELETE /collections/{id} — 删除集合（不动文件）
export async function deleteCollection(id: number): Promise<{ collection_id: number; deleted: boolean }> {
  return unwrap(() => auth_api.delete(`/collections/${id}`))
}

// POST /collections/{id}/members — 批量追加到末尾（幂等：已有/重复 id 跳过）
export async function addMembers(id: number, fileIds: number[]): Promise<CollectionDetail> {
  const body = await unwrap(() => auth_api.post(`/collections/${id}/members`, { file_ids: fileIds }))
  return mapCollectionDetail(body)
}

// DELETE /collections/{id}/members — 批量移除；响应 removed/skipped 供对账
export async function removeMembers(id: number, fileIds: number[]): Promise<MemberRemovalResult> {
  const body = await unwrap<any>(() =>
    auth_api.delete(`/collections/${id}/members`, { data: { file_ids: fileIds } }),
  )
  return {
    collectionId: body?.collection_id ?? id,
    removed: body?.removed ?? [],
    skipped: body?.skipped ?? [],
  }
}

// PATCH /collections/{id}/members/order — 全量重写调序；数组必须恰好等于当前成员全集
export async function reorderMembers(id: number, fileIds: number[]): Promise<CollectionDetail> {
  const body = await unwrap(() =>
    auth_api.patch(`/collections/${id}/members/order`, { file_ids: fileIds }),
  )
  return mapCollectionDetail(body)
}

// GET /collections/public/{public_id} — 免登录公开页详情
export async function getPublicCollection(publicId: string): Promise<CollectionDetail> {
  const body = await unwrap(() => api.get(`/collections/public/${publicId}`))
  return mapCollectionDetail(body)
}
