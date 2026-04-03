import { auth_api } from './api'

/**
 * 文件管理接口 (File Manager API)
 */
// 1. 获取用户文件列表
// GET /files
export async function getUserFiles() {
  // 根据经验，这个接口可能返回一个包含文件对象的列表
  return auth_api.get('/files');
}

// 2. 简单文件上传
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

// 3. 下载文件
// GET /files/{file_id}/download
export async function downloadFile(fileId: string) {
  // 注意：需要确保 fileId 是字符串
  return auth_api.get(`/files/${fileId}/download`, {
    responseType: 'blob' // 重要：告诉 axios 返回二进制流数据，而不是 JSON
  })
}

// 4. 删除文件
// DELETE /files/{file_id}
export async function deleteFile(fileId: string) {
  return auth_api.delete(`/files/${fileId}`);
}

/**
 * 分片上传相关接口 (Chunked Upload)
 * 如果文件较大，建议使用这一组接口
 */

// 5. 文件预检查 (Preflight)
// POST /files/preflight
// 通常用于检查文件是否允许上传，或者获取分片上传的 upload_id
export async function preflightFile(fileInfo: any) {
  // fileInfo 可能包含 name, size, type 等
  return auth_api.post('/files/preflight', fileInfo);
}

// 6. 分片上传 (Chunk Upload)
// POST /files/chunked/upload
export async function uploadChunk(chunkData: FormData) {
  // chunkData 需要包含 chunk 本身以及 upload_id, chunk_index 等信息
  return auth_api.post('/files/chunked/upload', chunkData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

// 7. 获取分片上传状态
// GET /files/chunked/{file_id}/status
export async function getUploadStatus(fileId: string) {
  return auth_api.get(`/files/chunked/${fileId}/status`);
}

// 8. 列表查询（搜索 / 过滤 / 分页）
// POST /files/list_files?page={page}&size={size}
export async function listFiles(filters: Record<string, any> = {}, page = 1, size = 10) {
  // Use the exact backend endpoint as specified by requirements.
  // Note: providing an absolute URL overrides axios instance baseURL.
  const url = `http://10.26.58.61:34567/files/list_files?page=${page}&size=${size}`;
  // 后端期望 JSON body 包含过滤字段（11 个属性）。
  return auth_api.post(url, filters);
}
