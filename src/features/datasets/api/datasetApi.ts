import { auth_api } from '@/shared/api/httpClient'
import { getConfig } from '@/shared/config/runtimeConfig'

// 约定：本模块所有函数都返回**解包后的响应体**（res.data），调用方不再处理 axios 信封。

// GET /files/{file_id}/download
export async function getDownloadMetadata(fileId: string) {
  const res = await auth_api.get(`/files/${fileId}/download`)
  return res.data
}

// GET /files/{file_id}/metadata — 根据文件 ID 获取元数据
export async function getFileMetadata(fileId: string | number) {
  const res = await auth_api.get(`/files/${fileId}/metadata`)
  return res.data
}

// GET /files/{file_id}/download_raw — pre-signed URLs for imzML + ibd, zero polling
export interface DownloadRawEntry {
  filename: string
  url: string
  size: number
}

export interface DownloadRawResponse {
  files: DownloadRawEntry[]
}

export async function getDownloadRaw(fileId: string): Promise<DownloadRawResponse> {
  const res = await auth_api.get(`/files/${fileId}/download_raw`)
  return res.data
}

// GET /files/{file_id}/images
// Returns { urls: Record<string, string>, storage_mode: string }
// - storage_mode "continuous" → urls contains "umap_image.jpg"
// - storage_mode "processed"   → urls contains "tic_image.png"
export interface FileImagesResponse {
  urls: Record<string, string>
  storage_mode: string
}

/** 根据 storage_mode 从 urls 中取出正确的图片 URL */
export function pickImageUrl(images: FileImagesResponse): string {
  const { storage_mode: mode, urls } = images
  const values = Object.values(urls)
  const fallback = values[0] ?? ''

  if (mode === 'continuous') return urls['umap_image.jpg'] || fallback
  if (mode === 'processed')   return urls['tic_image.png']  || fallback
  return fallback
}

export async function getFileImages(fileId: string | number): Promise<FileImagesResponse> {
  const res = await auth_api.get(`/files/${fileId}/images`)
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
export async function listFiles(filters: Record<string, any> = {}, page = 1, size = getConfig().pagination.defaultPageSize) {
  const res = await auth_api.post('/files/list_files', filters, { params: { page, size } })
  return res.data
}

// List files for the current user (backend separates public vs user scope)
// POST /files/list_user_files?page={page}&size={size}
export async function listUserFiles(filters: Record<string, any> = {}, page = 1, size = getConfig().pagination.defaultPageSize) {
  const res = await auth_api.post('/files/list_user_files', filters, { params: { page, size } })
  return res.data
}

// Get user storage and processing quota
// GET /users/quota
export interface UserQuota {
  total_uploaded_size_bytes: number
  file_count: number
  max_files_per_user: number
  max_total_file_size: number
  max_processing_size_gb: number
  total_processed_size_bytes: number
  download_used: number
  max_download_count: number
}

export async function getUserQuota(): Promise<UserQuota> {
  const res = await auth_api.get('/users/quota')
  return res.data
}

// POST /processes — Create Process
export async function createProcess(payload: {
  file_id: number
  algorithms: Record<string, any>
}) {
  const res = await auth_api.post('/processes', payload)
  return res.data
}

// GET /processes/mine?page=&size= — List my processes (paginated)
// 后端返回 { data: [...], meta: { current_page, total_pages, total_records } }
export async function listMyProcesses(page = 1, size = 10) {
  const res = await auth_api.get('/processes/mine', { params: { page, size } })
  const body = res.data
  // 兼容纯数组返回（无分页信息时）
  if (Array.isArray(body)) return { data: body, meta: { current_page: 1, total_pages: 1, total_records: body.length } }
  if (body && Array.isArray(body.data)) return body
  return { data: [], meta: { current_page: 1, total_pages: 1, total_records: 0 } }
}

// GET /stats/processing — Processing statistics for current user
export interface ProcessingStats {
  processing: number
  completed: number
  failed: number
}

export async function getProcessingStats(): Promise<ProcessingStats> {
  const res = await auth_api.get('/stats/processing')
  return res.data
}

// DELETE /processes/{run_id} — Delete a process/result
export async function deleteProcess(runId: string | number) {
  const res = await auth_api.delete(`/processes/${runId}`)
  return res.data
}
