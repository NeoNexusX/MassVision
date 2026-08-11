export interface File {
  id: string
  // Display name without extension
  name: string

  // Basic metadata
  filename?: string // original filename
  fileType?: string // file_type
  experimentType?: string // experiment_type

  // Biological
  organism?: string
  organismPart?: string
  condition?: string

  // Sample processing
  sampleGrowthConditions?: string
  sampleStabilization?: string
  tissueModification?: string

  // MALDI related
  maldiMatrix?: string
  maldiMatrixApplication?: string
  solvent?: string

  // Technical
  sizeBytes?: number
  storageType?: string
  // backend returns verification code (MD5) in `file_verify_code`; frontend uses `hashMd5`
  hashMd5?: string

  // Experiment / instrument
  instrumentTypes?: string[]
  polarity?: string
  ionSource?: string
  analyzer?: string
  pixelSizeHorizontal?: number
  pixelSizeVertical?: number
  resolvingPower?: number | string

  // MS acquisition
  spectrumMode?: string // 'profile' | 'centroid'
  storageMode?: string // 'continuous' | 'processed'
  mz?: number | string // target m/z for resolving power

  // Submission info
  submitTime: string // ISO string
  submitter: string
  institution?: string

  status: string // 'uploading' | 'completed' | 'failed' - from backend
  isPublic: boolean

  // Visualization / Zarr
  defaultRunId?: string | number | null  // 关联的可视化任务 run_id
  runStatus?: string | null              // 可视化任务状态：pending/running/completed/failed

  // UI
  // Keep raw backend object if needed
  raw?: any
}

// ── API response types (separated from api/datasetApi.ts) ──

// GET /files/{file_id}/download_raw - pre-signed URLs for imzML + ibd, zero polling
export interface DownloadRawEntry {
  filename: string
  url: string
  size: number
}

export interface DownloadRawResponse {
  files: DownloadRawEntry[]
}

// GET /files/{file_id}/images
// Returns { urls: Record<string, string>, storage_mode: string }
// - storage_mode "continuous" -> urls contains "umap_image.jpg"
// - storage_mode "processed"   -> urls contains "tic_image.png"
export interface FileImagesResponse {
  urls: Record<string, string>
  storage_mode: string
}

// GET /stats/processing - Processing statistics for current user
export interface ProcessingStats {
  processing: number
  completed: number
  failed: number
}
