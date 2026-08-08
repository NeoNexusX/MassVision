// ---------- zarr v3 metadata types ----------

export interface ZarrV3ArrayMetadata {
  zarr_format: 3
  node_type: 'array'
  shape: number[]
  data_type: string
  chunk_grid: {
    name: 'regular'
    configuration: { chunk_shape: number[] }
  }
  chunk_key_encoding: {
    name: 'default' | string
    configuration?: { separator?: string }
  }
  codecs?: Array<{
    name: string
    configuration?: Record<string, unknown>
  }>
  attributes?: Record<string, unknown>
  fill_value?: number | null
}

export interface ZarrV3GroupMetadata {
  zarr_format: 3
  node_type: 'group'
  attributes?: Record<string, unknown>
}
