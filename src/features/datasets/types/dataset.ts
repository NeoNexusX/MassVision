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
  /** 免登录分享 id（16 位 base62，FilePublic 必返）。分享链接 /files/{public_id} 用它，
   *  与可枚举的数字 file_id 解耦；下载仍用 id */
  publicId?: string | null

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

// Collection 响应中的成员行（后端模型 FilePublic，snake_case 原样）。
// 字段清单以接口实测为准；消费方（collectionMapper）对缺字段做默认值兜底。
export interface FilePublicResponse {
  file_id: number
  /** 免登录分享 id（16 位 base62）；下载仍用 file_id */
  public_id?: string | null
  filename?: string | null
  size?: number | null
  status?: string | null
  is_public?: boolean
  experiment_type?: string | null
  organism?: string | null
  [key: string]: unknown
}

// GET /stats/processing - Processing statistics for current user
export interface ProcessingStats {
  processing: number
  completed: number
  failed: number
}
