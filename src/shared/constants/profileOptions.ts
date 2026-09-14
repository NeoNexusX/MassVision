/**
 * 用户资料表单的下拉选项（注册页与个人资料页共用）。
 *
 * 与 `datasetMetadata.ts` 同样的理由从 `public/config.json` 迁入代码：这两张表描述的是
 * 通用的学术身份与学科分类，不随部署变化，没必要占用启动时那次阻塞请求的体积。
 */

import { t } from '@/i18n'

/** 职位 / 学术身份 */
export const POSITION_OPTIONS = [
  'Researcher',
  'Postdoctoral Researcher',
  'Research Assistant',
  'Research Engineer',
  'Senior Researcher',
  'Professor',
  'Associate Professor',
  'Lecture',
  'PhD Student',
  "Master's Student",
] as const

/** 研究领域 */
export const RESEARCH_FIELD_OPTIONS = [
  'Chemistry',
  'Biology',
  'Medicine',
  'Pharmaceutical Science',
  'Biomedical Engineering',
  'Materials Science',
  'Analytical Chemistry',
  'Biotechnology',
  'Environmental Science',
  'Food Science',
  'Other',
] as const

/**
 * 下拉选项的显示文字。值（上面两个数组里的英文）原样提交给后端，这里只负责界面显示；
 * 不在表里的值（用户在 Other 里自填的、历史数据）原样显示。
 * 在 computed / 模板里调用才会随语言切换刷新。
 */
const PROFILE_OPTION_LABELS: Record<string, () => string> = {
  Researcher: () => t('auth.vocab.researcher'),
  'Postdoctoral Researcher': () => t('auth.vocab.postdoctoralResearcher'),
  'Research Assistant': () => t('auth.vocab.researchAssistant'),
  'Research Engineer': () => t('auth.vocab.researchEngineer'),
  'Senior Researcher': () => t('auth.vocab.seniorResearcher'),
  Professor: () => t('auth.vocab.professor'),
  'Associate Professor': () => t('auth.vocab.associateProfessor'),
  Lecture: () => t('auth.vocab.lecturer'),
  'PhD Student': () => t('auth.vocab.phdStudent'),
  "Master's Student": () => t('auth.vocab.masterStudent'),
  Chemistry: () => t('auth.vocab.chemistry'),
  Biology: () => t('auth.vocab.biology'),
  Medicine: () => t('auth.vocab.medicine'),
  'Pharmaceutical Science': () => t('auth.vocab.pharmaceuticalScience'),
  'Biomedical Engineering': () => t('auth.vocab.biomedicalEngineering'),
  'Materials Science': () => t('auth.vocab.materialsScience'),
  'Analytical Chemistry': () => t('auth.vocab.analyticalChemistry'),
  Biotechnology: () => t('auth.vocab.biotechnology'),
  'Environmental Science': () => t('auth.vocab.environmentalScience'),
  'Food Science': () => t('auth.vocab.foodScience'),
  Other: () => t('auth.vocab.other'),
}

export function profileOptionLabel(value: string): string {
  return PROFILE_OPTION_LABELS[value]?.() ?? value
}

/** 供 IconSelect 使用的 { 显示文字: 原值 } 映射 */
export function profileOptionMap(values: readonly string[]): Record<string, string> {
  return Object.fromEntries(values.map((v) => [profileOptionLabel(v), v]))
}
