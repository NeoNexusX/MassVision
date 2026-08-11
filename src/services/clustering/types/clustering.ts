/**
 * UMAP / KMeans clustering backend API types.
 *
 * Backend endpoint:
 *   POST /processes/{run_id}/clustering
 */
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

/** A loaded RGB image (H, W, 3) uint8 raster. */
export interface ClusteringImage {
  /** Row-major (H * W * channels) uint8 raster. */
  data: Uint8Array
  height: number
  width: number
  channels: number
}
