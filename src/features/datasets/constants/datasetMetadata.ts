/**
 * 数据集元数据的下拉选项。
 *
 * 选项数据来源：运行时 `public/config.json` 的 `options`（人来编辑），见 runtimeConfig.ts。
 * 这些导出在模块加载时取值，而应用 bootstrap 保证配置已先就位，故可安全读取。
 */
import { getConfig } from '@/shared/config/runtimeConfig'

const o = getConfig().options

export const POLARITIES: string[] = o.polarity
export const ION_SOURCES: string[] = o.ionSource
export const ANALYZERS: string[] = o.analyzer
export const SPECTRUM_MODES: string[] = o.spectrumMode
export const STORAGE_MODES: string[] = o.storageMode
export const EXPERIMENT_TYPES: string[] = o.experimentType
export const ORGANISMS: string[] = o.organism
export const ORGANISM_PARTS: string[] = o.organismPart
export const CONDITIONS: string[] = o.condition
export const SAMPLE_GROWTH_CONDITIONS: string[] = o.sampleGrowthCondition
export const SAMPLE_STABILIZATIONS: string[] = o.sampleStabilization
export const TISSUE_MODIFICATIONS: string[] = o.tissueModification
export const MALDI_MATRICES: string[] = o.maldiMatrix
export const MALDI_MATRIX_APPLICATIONS: string[] = o.maldiMatrixApplication
export const SOLVENTS: string[] = o.solvent

export function createDefaultDatasetFilters() {
  return {
    filename: '',
    experiment_type: '',
    username: '',
    organism: '',
    organism_part: '',
    condition: '',
    sample_stabilization: '',
    tissue_modification: '',
    maldi_matrix: '',
    maldi_matrix_application: '',
    solvent: '',
    status: [] as string[],
  }
}
