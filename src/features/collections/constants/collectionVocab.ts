import { t, te } from '@/i18n'
import { vocabLabel } from '@/features/datasets/constants/vocabLabels'

/**
 * 集合专用词表（数据集上没有对应字段，所以不放进 datasetMetadata.ts）。
 * 数组里的英文原值是提交给后端的值；显示文字由 collectionVocabLabel 负责，规则同 vocabLabels.ts。
 * 两个字段都是多选 + 可自由输入，词表只是下拉建议，不含 'Other'。
 */

/** 成员类型：集合里包含哪几种数据 */
export const MEMBER_TYPES = ['MSI', 'H&E', 'ST', 'IHC', 'IF', 'Optical image'] as const

/** 集合类型：这些数据以什么方式构成集合 */
export const COLLECTION_TYPES = [
  'Serial sections',
  '3D reconstruction',
  'Time series',
  'Multi-sample cohort',
  'Biological replicates',
  'Case-control',
  'Multimodal',
  'Tissue microarray',
] as const

const COLLECTION_VOCAB_LABELS: Record<string, () => string> = {
  MSI: () => t('collections.vocab.memberType.msi'),
  'H&E': () => t('collections.vocab.memberType.he'),
  ST: () => t('collections.vocab.memberType.st'),
  IHC: () => t('collections.vocab.memberType.ihc'),
  IF: () => t('collections.vocab.memberType.if'),
  'Optical image': () => t('collections.vocab.memberType.opticalImage'),
  'Serial sections': () => t('collections.vocab.collectionType.serialSections'),
  '3D reconstruction': () => t('collections.vocab.collectionType.reconstruction3d'),
  'Time series': () => t('collections.vocab.collectionType.timeSeries'),
  'Multi-sample cohort': () => t('collections.vocab.collectionType.cohort'),
  'Biological replicates': () => t('collections.vocab.collectionType.replicates'),
  'Case-control': () => t('collections.vocab.collectionType.caseControl'),
  Multimodal: () => t('collections.vocab.collectionType.multimodal'),
  'Tissue microarray': () => t('collections.vocab.collectionType.tissueMicroarray'),
}

/**
 * 集合元数据取值的显示文字：先查集合词表，再退回数据集词表（物种、极性等）。
 * collections 语言包未加载时原样显示，而不是显示裸 key。
 */
export function collectionVocabLabel(value: string | null | undefined): string {
  if (!value) return ''
  const label = COLLECTION_VOCAB_LABELS[value]
  if (label && te('collections.vocab.memberType.msi', 'en')) return label()
  return vocabLabel(value)
}
