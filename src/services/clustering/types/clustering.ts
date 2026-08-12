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

/**
 * Raw UMAP embedding for v1.1 datasets - the data behind `umap_image`.
 *
 * v1.1 stores the UMAP as three arrays under `analysis/umap/`:
 *   - `coordinates`     uint32[n, 2]  - tissue-pixel grid (x, y), 0-based
 *   - `scaled_embedding` float32[n, 3] - 3D embedding scaled to [0, 1];
 *                                       round(v * 255) == umap_image RGB
 *   - `umap_image`       uint8[H, W, 3] - the above rasterized onto the grid
 *
 * The raster is enough to draw the overlay; the embedding is needed for the
 * scatter / lasso view (points plotted by their true 3D position, not the
 * rasterized grid). v1.0 datasets only ship `umap_image`, so `embedding` is
 * null there.
 */
export interface UmapEmbedding {
  /** Tissue-pixel grid coordinates (x, y), 0-based. shape [n, 2], row-major. */
  coordinates: Uint32Array
  /** 3D UMAP embedding scaled to [0, 1]; round(v * 255) == the image RGB. shape [n, 3], row-major. */
  scaledEmbedding: Float32Array
  /** Number of tissue pixels (coordinates.length / 2). */
  count: number
}

/** Full UMAP result: the pre-rendered raster plus the raw embedding (if present). */
export interface UmapData {
  /** Pre-rendered (H, W, 3) uint8 raster - colors placed at tissue pixels. */
  image: ClusteringImage
  /** Raw embedding (v1.1); null for v1.0 datasets that only ship umap_image. */
  embedding: UmapEmbedding | null
}
