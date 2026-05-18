export interface File {
  id: string;
  // Display name without extension
  name: string;

  // Basic metadata
  filename?: string; // original filename
  fileType?: string; // file_type
  experimentType?: string; // experiment_type

  // Biological
  organism?: string;
  organismPart?: string;
  condition?: string;

  // Sample processing
  sampleGrowthConditions?: string;
  sampleStabilization?: string;
  tissueModification?: string;

  // MALDI related
  maldiMatrix?: string;
  maldiMatrixApplication?: string;
  solvent?: string;

  // Technical
  sizeBytes?: number;
  storageType?: string;
  // backend returns verification code (MD5) in `file_verify_code`; frontend uses `hashMd5`
  hashMd5?: string;

  // Experiment / instrument
  instrumentTypes?: string[];
  polarity?: string;
  ionSource?: string;
  analyzer?: string;
  pixelSizeHorizontal?: number;
  pixelSizeVertical?: number;
  resolvingPower?: number | string;

  // MS acquisition
  spectrumMode?: string;  // 'profile' | 'centroid'
  storageMode?: string;   // 'continuous' | 'processed'
  mz?: number | string;   // target m/z for resolving power

  // Submission info
  submitTime: string; // ISO string
  submitter: string;
  institution?: string;

  status: string; // 'uploading' | 'completed' | 'failed' — from backend
  isPublic: boolean;

  // UI
  thumbnailUrl?: string;

  // Keep raw backend object if needed
  raw?: any;
}
