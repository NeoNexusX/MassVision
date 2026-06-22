import { auth_api } from '@/shared/api/httpClient'

export interface AdminUser {
  id: number
  username: string
  active: boolean
  identity: string
  institution: string
  position: string
  research_field: string
  region: string
  orcid: string
  homepage: string
  email: string
  total_file_size?: number
  file_count?: number
  max_total_file_size?: number
  max_file_count?: number
  max_processing_size?: number
  max_download_count?: number
}

export interface UserListFilters {
  username: string
  status: string
  institution: string
  region: string
}

export interface UserQuotaLimits {
  max_total_file_size: number
  max_file_count: number
  max_processing_size: number
  max_download_count: number
}

export async function listAdminUsers(filters: UserListFilters, page: number, size: number) {
  const payload = {
    username: filters.username,
    active: filters.status === 'Inactive' ? false : true,
    institution: filters.institution,
    region: filters.region,
  }

  return auth_api.post('/list_users', payload, {
    params: { page, size },
  })
}

export function deleteAdminUser(userId: number) {
  return auth_api.delete(`/user_delete/${userId}`)
}

/** 管理员更新用户配额限制 */
export async function updateUserQuota(userId: number, limits: Partial<UserQuotaLimits>) {
  return auth_api.post(`/users/${userId}/quota`, limits)
}

/** GET /stats/users/classification?field= — 按指定字段统计用户分类数量 */
export type UsersClassification = Record<string, number>

export async function getUsersClassification(field: string): Promise<UsersClassification> {
  const res = await auth_api.get('/stats/users/classification', { params: { field } })
  return res.data
}
