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

export type UsersClassification = Record<string, number>
