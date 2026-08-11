/**
 * 用户资料表单的下拉选项。
 *
 * 数据来源：运行时 `public/config.json` 的 `options`（人来编辑），见 runtimeConfig.ts。
 *
 * 改为函数（调用时读取）而非模块顶层常量：模块顶层 `getConfig()` 会在文件加载时立即执行，
 * 若本模块被并入 shared chunk 并在 main.ts 顶层静态加载，则会在 `loadConfig()` 完成前求值、
 * `_config` 仍为 null 时抛错。改为函数后，调用时机跟随组件 setup，必在 bootstrap 之后。
 */
import { getConfig } from '@/shared/config/runtimeConfig'

export function getPositionOptions(): string[] {
  return getConfig().options.position
}

export function getResearchFieldOptions(): string[] {
  return getConfig().options.researchField
}
