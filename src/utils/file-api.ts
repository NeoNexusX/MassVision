import { auth_api } from './api'

/**
 * File Manager API
 */
// 1. Get user file list
// GET /files
export async function getUserFiles() {
  // As per experience, this interface may return a list containing file objects
  return auth_api.get('/files');
}

// 2. Simple file upload
// POST /files/upload_simple
export async function uploadSimpleFile(
  file: File,
  preFileId?: string,
  storageType = 'local',
  onUploadProgress?: (progressEvent: any) => void
) {
  const formData = new FormData();
  formData.append('file', file);
  if (preFileId) formData.append('pre_file_id', preFileId);
  if (storageType) formData.append('storage_type', storageType);

  return auth_api.post('/files/upload_simple', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress
  });
}

// 3. Get download metadata (OSS download returns JSON with oss_download_url)
// GET /files/{file_id}/download
export async function getDownloadMetadata(fileId: string) {
  return auth_api.get(`/files/${fileId}/download`);
}

// 4. Download file (legacy blob mode)
// GET /files/{file_id}/download
export async function downloadFile(fileId: string, onDownloadProgress?: (progressEvent: any) => void) {
  // Note: needs to assure fileId is a string
  return auth_api.get(`/files/${fileId}/download`, {
    responseType: 'blob', // Important: Instructs axios to return binary stream data instead of JSON
    onDownloadProgress
  })
}

// 5. Delete file
// DELETE /files/{file_id}
export async function deleteFile(fileId: string | number) {
  return auth_api.delete(`/files/${fileId}`);
}

// 6. Check imzML file processing status
// GET /origins/imzml/{file_id}
export async function checkImzmlStatus(fileId: string): Promise<{ status: string; ready: boolean }> {
  const res = await auth_api.get(`/origins/imzml/${fileId}`);
  const status = res.data?.status || 'unknown';
  return { status, ready: status === 'completed' };
}

/**
 * Chunked Upload API
 * Recommended for larger files
 */

// 5. Preflight file check
// POST /files/preflight
// Used to verify if file is allowed to be uploaded, or to retrieve upload_id for chunked upload
export async function preflightFile(fileInfo: any) {
  // fileInfo might contain name, size, type, etc.
  return auth_api.post('/files/preflight', fileInfo);
}

// 6. Chunk Upload
// POST /files/chunked/upload
export async function uploadChunk(chunkData: FormData) {
  // chunkData needs to contain the chunk itself alongside upload_id, chunk_index, etc.
  return auth_api.post('/files/chunked/upload', chunkData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

// 7. Get Chunk Upload Status
// GET /files/chunked/{file_id}/status
export async function getUploadStatus(fileId: string) {
  return auth_api.get(`/files/chunked/${fileId}/status`);
}

// 8. List Query (Search / Filter / Pagination)
// POST /files/list_files?page={page}&size={size}
export async function listFiles(filters: Record<string, any> = {}, page = 1, size = 10) {
  // Use the exact backend endpoint as specified by requirements.
  // Backend expects JSON body containing 11 filter attributes.
  return auth_api.post('/files/list_files', filters, {
    params: { page, size }
  });
}

// List files for the current user (backend separates public vs user scope)
// POST /files/list_user_files?page={page}&size={size}
export async function listUserFiles(filters: Record<string, any> = {}, page = 1, size = 10) {
  return auth_api.post('/files/list_user_files', filters, {
    params: { page, size }
  });
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
