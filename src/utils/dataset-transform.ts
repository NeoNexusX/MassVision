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
    // Normalize instrumentTypes: prefer array from backend; if single string provided, wrap into array;
    // keep `undefined` when not provided to allow templates to render '—'.
    instrumentTypes: (() => {
      const raw = item.instrument_types ?? item.instrumentTypes;
      if (Array.isArray(raw)) return raw;
      if (raw == null) return undefined;
      return [String(raw)];
    })(),

    // MS Analysis
    polarity: item.polarity || '',
    ionSource: item.ionisation_source || '',
    analyzer: item.analyzer || '',
    pixelSizeHorizontal: item.pixel_size_horizontal,
    pixelSizeVertical: item.pixel_size_vertical,
    resolvingPower: item.resolving_power,

    // Technical
    sizeBytes: item.size ?? undefined,
    storageType: item.storage_type || '',
    hashMd5: item.file_verify_code || '',

    // Submission info
    submitTime: item.uploaded_at || '',
    submitter: item.first_uploaded_by || '',
    institution: item.institution || '',

    status: (item.status as any) || 'Finished',
    isPublic: !!item.is_public,

    thumbnailUrl: item.thumbnail_url || item.thumbnail || '',

    // preserve raw backend object for details/debugging
    raw: item
  } as File;
}
