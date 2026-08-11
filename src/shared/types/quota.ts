// Get user storage and processing quota
// GET /users/quota
//
// 说明：本接口描述的是「当前登录用户的配额」，属于跨业务的通用用户关注点，
// 与 datasets 业务无耦合，故放在 shared/api 层（原位于 features/datasets/api/datasetApi，
// 曾导致 shared/composables/useUserQuota -> features/datasets 的反向依赖环）。
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
