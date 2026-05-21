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
}

export interface UserListFilters {
  username: string
  status: string
  institution: string
  region: string
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
