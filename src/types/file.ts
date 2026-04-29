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

  // Submission info
  submitTime: string; // ISO string
  submitter: string;
  institution?: string;

  status: 'Processing' | 'Queued' | 'Finished';
  isPublic: boolean;

  // UI
  thumbnailUrl?: string;

  // Keep raw backend object if needed
  raw?: any;
}
