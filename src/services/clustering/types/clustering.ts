/**
 * Backend UMAP task and locally consumed clustering data types.
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
  /** UMAP task status - 'completed' once the embedded UMAP result is ready. */
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

/**
 * Raw UMAP embedding - the n×3 float32 matrix shipped by the backend.
 *
 * The backend analysis pipeline runs two steps (UMAP reduction + scaling) and
 * stores the result in the run's zarr `analysis/umap` group:
 *   - `coordinates`      uint32[n, 2]  - tissue-pixel grid (x, y), root coordinate_base
 *   - `scaled_embedding` float32[n, 3] - 3D embedding scaled to [0, 1]
 *
 * The third step — rasterizing the embedding onto the tissue grid, where each
 * pixel takes round(scaled_embedding * 255) as RGB — is done by the FRONTEND
 * (ClusteringZarrStore.rasterizeEmbedding). The matrix is also the input for
 * the local KMeans and the scatter / lasso view.
 */
export interface UmapEmbedding {
  /** Tissue-pixel grid coordinates (x, y), 0-based (the analysis library
   *  normalizes before writing - the root coordinate_base does NOT apply). shape [n, 2], row-major. */
  coordinates: Uint32Array
  /** 3D UMAP embedding scaled to [0, 1]; round(v * 255) == the image RGB. shape [n, 3], row-major. */
  scaledEmbedding: Float32Array
  /** Number of tissue pixels (coordinates.length / 2). */
  count: number
}

/** Full UMAP result: the raw embedding plus the rasterized (H, W, 3) image. */
export interface UmapData {
  /** Synthesized (H, W, 3) uint8 raster - colors placed at tissue pixels. */
  image: ClusteringImage
  /** The raw embedding this raster was synthesized from. */
  embedding: UmapEmbedding
}
