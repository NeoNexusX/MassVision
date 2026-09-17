import { auth_api, api } from '@/shared/api/httpClient'
import { getConfig } from '@/shared/config/runtimeConfig'
import type {
  DownloadRawResponse,
  ProcessingStats,
} from '@/features/datasets/types/dataset'

// 约定：本模块所有函数都返回**解包后的响应体**（res.data），调用方不再处理 axios 信封。

// GET /files/{file_id}/metadata - 根据文件 ID 获取元数据
export async function getFileMetadata(fileId: string | number, isPublic = false) {
  const client = isPublic ? api : auth_api
  const res = await client.get(`/files/${fileId}/metadata`)
  return res.data
}

// GET /files/public/{public_id} — 免登录公开文件详情（分享页首屏）。
// public_id 是 16 位随机串（非 file_id，不可枚举）；后端对「不存在 / 未公开 /
// 非 completed」一律返回 404 且不区分原因，前端统一按“链接失效”处理。
// 响应为 FilePublic，同时含 file_id（下载用）与 public_id（分享用）。
export async function getPublicFile(publicId: string) {
  const res = await api.get(`/files/public/${publicId}`)
  return res.data
}

// GET /files/{file_id}/download_raw - pre-signed URLs for imzML + ibd, zero polling
export async function getDownloadRaw(fileId: string): Promise<DownloadRawResponse> {
  const res = await auth_api.get(`/files/${fileId}/download_raw`)
  return res.data
}

// DELETE /files/{file_id}
export async function deleteFile(fileId: string | number) {
  const res = await auth_api.delete(`/files/${fileId}`)
  return res.data
}

// PUT /files/{file_id}/set_public
export async function setFilePublic(fileId: string | number) {
  const res = await auth_api.put(`/files/${fileId}/set_public`)
  return res.data
}

// PATCH /files/{file_id} — 文件元数据部分更新（键为后端 snake_case）。
// 可改：样本属性 9 个（含 solvent）+ spectrum_mode + storage_mode；is_public/
// experiment_type/filename 等系统字段禁改。权限：任一文件持有者。响应为更新后的 FilePublic。
export interface FileMetadataPatch {
  organism?: string
  organism_part?: string
  condition?: string
  sample_growth_conditions?: string
  sample_stabilization?: string
  tissue_modification?: string
  maldi_matrix?: string
  maldi_matrix_application?: string
  solvent?: string // "N% Name, ..." 复合串，与上传表单同构
  spectrum_mode?: string // 'profile' | 'centroid'
  storage_mode?: string // 'continuous' | 'processed'
}

export async function patchFileMetadata(fileId: string | number, patch: FileMetadataPatch) {
  const res = await auth_api.patch(`/files/${fileId}`, patch)
  return res.data
}

/** 文件列表服务端排序（sort_by/order 白名单与后端一致，非法值 422） */
export interface FileListSort {
  sortBy: 'uploaded_at' | 'size'
  order: 'asc' | 'desc'
}

// POST /files/list_files?page={page}&size={size}&sort_by={sort_by}&order={order}
// Backend expects a JSON body of filter attributes; returns { data: [...], meta: {...} }.
// 排序/分页参数走 query string，过滤条件仍在请求体；同值行按 file_id 倒序兜底。
export async function listFiles(filters: Record<string, any> = {}, page = 1, size = getConfig().pagination.defaultPageSize, isPublic = false, sort?: FileListSort) {
  const client = isPublic ? api : auth_api
  const res = await client.post('/files/list_files', filters, {
    params: { page, size, sort_by: sort?.sortBy, order: sort?.order },
  })
  return res.data
}

// List files for the current user (backend separates public vs user scope)
// POST /files/list_user_files?page={page}&size={size}&sort_by={sort_by}&order={order}
export async function listUserFiles(filters: Record<string, any> = {}, page = 1, size = getConfig().pagination.defaultPageSize, sort?: FileListSort) {
  const res = await auth_api.post('/files/list_user_files', filters, {
    params: { page, size, sort_by: sort?.sortBy, order: sort?.order },
  })
  return res.data
}

// POST /processes - Create Process
export async function createProcess(payload: {
  file_id: number
  algorithms: Record<string, any>
}) {
  const res = await auth_api.post('/processes', payload)
  return res.data
}

// POST /processes/raw-convert - 一键 Zarr 可视化（无需配置预处理参数）
export async function rawConvertProcess(fileId: string | number) {
  const res = await auth_api.post('/processes/raw-convert', { file_id: Number(fileId) })
  return res.data
}

// POST /processes/mine?page=&size= - List my processes (paginated, fuzzy filter)
// RunFilter body 必填（后端 breaking change：不发 body 会 422），不筛选时也要发 {}
export interface ProcessRunFilter {
  /** 对源文件名模糊匹配（LIKE %xxx%） */
  filename?: string
  /** 对算法参数 params_json 模糊匹配（直转 run 的 __RAW_CONVERT__ 标记也参与匹配） */
  params?: string
}

// 后端返回 { data: [...], meta: { current_page, total_pages, total_records } }
export async function listMyProcesses(page = 1, size = 10, filter: ProcessRunFilter = {}) {
  const res = await auth_api.post('/processes/mine', filter, { params: { page, size } })
  const body = res.data
  // 兼容纯数组返回（无分页信息时）
  if (Array.isArray(body)) return { data: body, meta: { current_page: 1, total_pages: 1, total_records: body.length } }
  if (body && Array.isArray(body.data)) return body
  return { data: [], meta: { current_page: 1, total_pages: 1, total_records: 0 } }
}

// GET /stats/processing - Processing statistics for current user
export async function getProcessingStats(): Promise<ProcessingStats> {
  const res = await auth_api.get('/stats/processing')
  return res.data
}

// DELETE /processes/{run_id} - Delete a process/result
export async function deleteProcess(runId: string | number) {
  const res = await auth_api.delete(`/processes/${runId}`)
  return res.data
}
