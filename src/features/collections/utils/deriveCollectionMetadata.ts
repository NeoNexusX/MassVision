import type { File } from '@/features/datasets/types/dataset'

/**
 * 从选中的成员文件聚合出集合级元数据（纯函数，便于单测）。
 *
 * 集合的 list 字段语义是「该集合涵盖的取值集合」，所以这里取**去重并集**并按
 * 选择顺序保留首次出现的位置（与成员顺序一致）；成员取值不一致时数组会有多项，
 * 这是对的——不是取交集。
 *
 * 只有这 8 个字段能从文件推导；citation 组的 doi/access 虽然也是 list，
 * 但属于人工著录，不在这里。数值型仪器字段（pixel_size_* / resolving_power /
 * mz）已随集合级模型下线，不再推导。
 */
export const DERIVED_METADATA_KEYS = [
  'organism',
  'organism_part',
  'sample_stabilization',
  'sample_growth_conditions',
  'tissue_modification',
  'polarity',
  'ionisation_source',
  'analyzer',
] as const

export type DerivedMetadataKey = (typeof DERIVED_METADATA_KEYS)[number]

export type DerivedMetadata = Record<DerivedMetadataKey, string[]>

/** 集合字段 ← File 字段（camelCase，由 datasetMapper 映射好） */
const SOURCES: Record<DerivedMetadataKey, (file: File) => unknown> = {
  organism: (f) => f.organism,
  organism_part: (f) => f.organismPart,
  sample_stabilization: (f) => f.sampleStabilization,
  sample_growth_conditions: (f) => f.sampleGrowthConditions,
  tissue_modification: (f) => f.tissueModification,
  polarity: (f) => f.polarity,
  ionisation_source: (f) => f.ionSource,
  analyzer: (f) => f.analyzer,
}

function normalize(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

export function deriveCollectionMetadata(files: readonly File[]): DerivedMetadata {
  const result = {} as DerivedMetadata
  for (const key of DERIVED_METADATA_KEYS) {
    const seen = new Set<string>()
    const values: string[] = []
    for (const file of files) {
      const value = normalize(SOURCES[key](file))
      if (!value || seen.has(value)) continue
      seen.add(value)
      values.push(value)
    }
    result[key] = values
  }
  return result
}
