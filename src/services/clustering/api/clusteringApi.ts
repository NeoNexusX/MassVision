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
import type { ClusteringTaskResponse } from '../types/clustering'

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
