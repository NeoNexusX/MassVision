/**
 * Zarr v3 metadata validation and chunk-key computation.
 *
 * Extracted from the former zarrCodecs module so the ion-image reader
 * (massflow.msi_zarr) and the clustering reader (massflow_feature_analysis)
 * share one implementation of v3 metadata validation and chunk-key encoding.
 */

import type { ZarrV3ArrayMetadata } from './types/zarrV3'

/**
 * Validate a zarr v3 array's metadata: must be a v3 array and only use
 * codecs we know how to decode (bytes / gzip / zlib / deflate / zstd).
 */
export function assertV3Array(meta: ZarrV3ArrayMetadata, label: string): void {
  if (meta.zarr_format !== 3 || meta.node_type !== 'array') {
    throw new Error(`[zarrMetadata] ${label}: not a v3 array`)
  }
  const unsupported = (meta.codecs ?? []).filter(
    (c) => !['bytes', 'gzip', 'zlib', 'deflate', 'zstd'].includes(c.name),
  )
  if (unsupported.length > 0) {
    throw new Error(
      `[zarrMetadata] ${label}: unsupported codec: ${unsupported.map((c) => c.name).join(',')}`,
    )
  }
}

/**
 * Compute the chunk key for an N-D array using zarr v3 default encoding.
 * For a single-chunk array this is "c/0/0/0" (3D) / "c/0/0" (2D) / "c/0" (1D).
 */
export function computeNDChunkKey(
  meta: ZarrV3ArrayMetadata,
  chunkIndices: number[],
): string {
  const enc = meta.chunk_key_encoding
  if (enc.name !== 'default') {
    throw new Error(
      `[zarrMetadata] unsupported chunk key encoding: ${enc.name}`,
    )
  }
  const sep = enc.configuration?.separator ?? '/'
  return `c${sep}${chunkIndices.join(sep)}`
}
