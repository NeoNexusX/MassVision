/**
 * 用户资料表单的下拉选项（注册页与个人资料页共用）。
 *
 * 与 `datasetMetadata.ts` 同样的理由从 `public/config.json` 迁入代码：这两张表描述的是
 * 通用的学术身份与学科分类，不随部署变化，没必要占用启动时那次阻塞请求的体积。
 */

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
