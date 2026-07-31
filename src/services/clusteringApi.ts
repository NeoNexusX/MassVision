/**
 * UMAP / KMeans clustering backend API.
 *
 * Backend endpoint:
 *   POST /processes/{run_id}/clustering
 *
 * Idempotent get-or-create: the first call starts the UMAP/KMeans clustering
 * task for a run, repeated calls return the existing task record (no
 * duplicates). The response's `clustering_status` reflects the task state
 * ('completed' once finished), so the POST doubles as a status check for the
 * Refresh flow. The UI still treats a successful clustering-zarr load as the
 * final readiness gate.
 */

import { auth_api } from '@/shared/api/httpClient'

export interface ClusteringTaskResponse {
  /** Clustering task id. */
  id: number
  /** Preprocessing parameters used to derive the feature matrix (JSON string). */
  params_json: string
  /** Backend task status. */
  status: string
  /** Clustering status - 'completed' once the clustering zarr is finished. */
  clustering_status: string
  error_message: string | null
  /** ISO 8601 timestamp. */
  created_at: string
  /** ISO 8601 timestamp, null/absent until finished. */
  finished_at: string | null
  experiment_id: number
  source_file_id: number
  user_id: number
  filename: string
}

/**
 * Create-or-fetch the UMAP/KMeans clustering task for a run. Idempotent:
 * repeated calls return the existing task record, whose `clustering_status`
 * tells the caller whether the task has finished.
 */
export async function createClustering(runId: string): Promise<ClusteringTaskResponse> {
  if (!runId) throw new Error('[clusteringApi] runId is required')
  const { data } = await auth_api.post<ClusteringTaskResponse>(
    `/processes/${runId}/clustering`,
  )
  if (!data || data.id == null) {
    throw new Error('[clusteringApi] invalid clustering response: missing id')
  }
  return data
}
