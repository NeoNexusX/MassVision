/**
 * 用户资料表单的下拉选项。
 *
 * 数据来源：运行时 `public/config.json` 的 `options`（人来编辑），见 runtimeConfig.ts。
 * 这些导出在模块加载时取值，而应用 bootstrap 保证配置已先就位，故可安全读取。
 */
import { getConfig } from '@/shared/config/runtimeConfig'

const { position, researchField } = getConfig().options

export const positionOptions: string[] = position
export const researchFieldOptions: string[] = researchField
