import type { File } from '@/types/file';

/**
 * Convert backend file item into frontend `File` shape.
 * Provides fallbacks for common backend key variants and preserves raw object.
 */
export function mapItemToDataset(item: any, index = 0): File {
  return {
    id: String(item.file_id),
    // Display name without extension
    name: (item.filename || `dataset-${index}`).replace(/\.[^.]+$/, ''),

    // Raw / filename
    filename: item.filename || '',
    fileType: item.file_type || '',

    // Biological
    organism: item.organism || '',
    organismPart: item.organism_part || '',
    condition: item.condition || '',

    // Sample processing
    sampleGrowthConditions: item.sample_growth_conditions || '',
    sampleStabilization: item.sample_stabilization || '',
    tissueModification: item.tissue_modification || '',

    // MALDI
    maldiMatrix: item.maldi_matrix || '',
    maldiMatrixApplication: item.maldi_matrix_application || '',
    solvent: item.solvent || '',

    // Experiment / instrument
    experimentType: item.experiment_type || '',
    // do not force empty array; keep undefined when backend doesn't provide
    instrumentTypes: item.instrument_types || '',

    // Technical
    sizeBytes: item.size ?? undefined,
    storageType: item.storage_type || '',
    hashMd5: item.file_verify_code || '',

    // Submission info
    submitTime: item.uploaded_at || '',
    submitter: item.username || '',
    institution: item.institution || '',

    status: (item.status as any) || 'Finished',
    isPublic: !!item.is_public,

    thumbnailUrl: item.thumbnail_url || item.thumbnail || '',

    // preserve raw backend object for details/debugging
    raw: item
  } as File;
}
