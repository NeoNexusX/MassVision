import { auth_api, api } from '@/shared/api/httpClient'
import { getConfig } from '@/shared/config/runtimeConfig'
import type {
  DownloadRawResponse,
  ProcessingStats,
} from '@/features/datasets/types/dataset'

// 约定：本模块所有函数都返回**解包后的响应体**（res.data），调用方不再处理 axios 信封。

// GET /files/{file_id}/download
export async function getDownloadMetadata(fileId: string) {
  const res = await auth_api.get(`/files/${fileId}/download`)
  return res.data
}

// GET /files/{file_id}/metadata - 根据文件 ID 获取元数据
export async function getFileMetadata(fileId: string | number, isPublic = false) {
  const client = isPublic ? api : auth_api
  const res = await client.get(`/files/${fileId}/metadata`)
  return res.data
}

// GET /files/{file_id}/download_raw - pre-signed URLs for imzML + ibd, zero polling
export async function getDownloadRaw(fileId: string, isPublic = false): Promise<DownloadRawResponse> {
  const client = isPublic ? api : auth_api
  const res = await client.get(`/files/${fileId}/download_raw`)
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

// POST /files/list_files?page={page}&size={size}
// Backend expects a JSON body of filter attributes; returns { data: [...], meta: {...} }.
export async function listFiles(filters: Record<string, any> = {}, page = 1, size = getConfig().pagination.defaultPageSize, isPublic = false) {
  const client = isPublic ? api : auth_api
  const res = await client.post('/files/list_files', filters, { params: { page, size } })
  return res.data
}

// List files for the current user (backend separates public vs user scope)
// POST /files/list_user_files?page={page}&size={size}
export async function listUserFiles(filters: Record<string, any> = {}, page = 1, size = getConfig().pagination.defaultPageSize) {
  const res = await auth_api.post('/files/list_user_files', filters, { params: { page, size } })
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

// GET /processes/mine?page=&size= - List my processes (paginated)
// 后端返回 { data: [...], meta: { current_page, total_pages, total_records } }
export async function listMyProcesses(page = 1, size = 10) {
  const res = await auth_api.get('/processes/mine', { params: { page, size } })
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
