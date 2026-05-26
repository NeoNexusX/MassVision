import { auth_api } from '@/shared/api/httpClient'

// GET /files/{file_id}/download
export async function getDownloadMetadata(fileId: string) {
  return auth_api.get(`/files/${fileId}/download`)
}

// DELETE /files/{file_id}
export async function deleteFile(fileId: string | number) {
  return auth_api.delete(`/files/${fileId}`)
}

// POST /files/list_files?page={page}&size={size}
// POST /files/list_files?page={page}&size={size}
export async function listFiles(filters: Record<string, any> = {}, page = 1, size = 10) {
  // Use the exact backend endpoint as specified by requirements.
  // Backend expects JSON body containing 11 filter attributes.
  return auth_api.post('/files/list_files', filters, {
    params: { page, size },
  })
}

// List files for the current user (backend separates public vs user scope)
// POST /files/list_user_files?page={page}&size={size}
export async function listUserFiles(filters: Record<string, any> = {}, page = 1, size = 10) {
  return auth_api.post('/files/list_user_files', filters, {
    params: { page, size },
  })
}

// Get user storage and processing quota
// GET /users/quota
export interface UserQuota {
  max_file_size_gb: number
  total_uploaded_size_bytes: number
  file_count: number
  max_files_per_user: number
  max_processing_size_gb: number
  total_processed_size_bytes: number
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
