import type { Dataset } from '@/types/dataset';
/**
 * Convert backend file item into frontend `Dataset` shape.
 */
export function mapItemToDataset(item: any, index = 0): Dataset {
  return {
    id: String(item.file_id),
    name: (item.filename || `dataset-${index}`).replace(/\.[^.]+$/, ''),
    // keep both raw fields and a human-friendly concatenated sampleDesc
    organism: item.organism || '',
    organismPart: item.organism_part || '',
    sampleDesc: [
      item.organism_part && item.organism ? `${item.organism_part} (${item.organism})` : (item.organism_part || item.organism)
    ].filter(Boolean).join(', '),
    instrument: item.experiment_type || '',
    submitTime: item.uploaded_at || new Date().toISOString(),
    submitter: item.username || '', // For future use
    institution: item.institution || '',
    status: (item.status as any) || 'Finished',  // For future use
    isPublic: !!item.is_public,  // For future use
    // If backend doesn't provide it, keep empty string so UI falls back to placeholder.
    thumbnailUrl: item.thumbnail_url || item.thumbnail || '',
    sizeBytes: item.size ?? undefined
  } as Dataset;
}
