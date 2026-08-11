/**
 * 数据集元数据的下拉选项。
 *
 * 选项数据来源：运行时 `public/config.json` 的 `options`（人来编辑），见 runtimeConfig.ts。
 *
 * 改为函数（调用时读取）而非模块顶层常量：模块顶层 `getConfig()` 会在文件加载时立即执行，
 * 若本模块在 `loadConfig()` 完成前被求值（`_config` 仍为 null）会抛错。改为函数后，
 * 调用时机跟随组件 setup，必在 bootstrap 之后。
 */
import { getConfig } from '@/shared/config/runtimeConfig'

export function getDatasetMetadata() {
  const o = getConfig().options
  return {
    POLARITIES: o.polarity,
    ION_SOURCES: o.ionSource,
    ANALYZERS: o.analyzer,
    SPECTRUM_MODES: o.spectrumMode,
    STORAGE_MODES: o.storageMode,
    EXPERIMENT_TYPES: o.experimentType,
    ORGANISMS: o.organism,
    ORGANISM_PARTS: o.organismPart,
    CONDITIONS: o.condition,
    SAMPLE_GROWTH_CONDITIONS: o.sampleGrowthCondition,
    SAMPLE_STABILIZATIONS: o.sampleStabilization,
    TISSUE_MODIFICATIONS: o.tissueModification,
    MALDI_MATRICES: o.maldiMatrix,
    MALDI_MATRIX_APPLICATIONS: o.maldiMatrixApplication,
    SOLVENTS: o.solvent,
  } as const
}

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
