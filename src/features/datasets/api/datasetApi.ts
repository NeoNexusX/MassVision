import { auth_api } from '@/shared/api/httpClient'
import { getConfig } from '@/shared/config/runtimeConfig'

// 约定：本模块所有函数都返回**解包后的响应体**（res.data），调用方不再处理 axios 信封。

// GET /files/{file_id}/download
export async function getDownloadMetadata(fileId: string) {
  const res = await auth_api.get(`/files/${fileId}/download`)
  return res.data
}

// DELETE /files/{file_id}
export async function deleteFile(fileId: string | number) {
  const res = await auth_api.delete(`/files/${fileId}`)
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
  is_public?: boolean
}) {
  const res = await auth_api.post('/processes', payload)
  return res.data
}

// GET /processes/mine — List my processes
export async function listMyProcesses() {
  const res = await auth_api.get('/processes/mine')
  return res.data
}
