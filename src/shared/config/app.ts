import { getConfig } from './runtimeConfig'

/** 应用名称（来源：运行时 config.json，见 runtimeConfig.ts） */
export const APP_NAME = getConfig().appName

/**
 * 品牌名按大写 X 拆分：navbar / drawer / Hero 统一把 X 用渐变高亮；
 * 没有 X 时 pre 为完整名称、x/post 为空串（与各组件原先的内联逻辑一致）。
 */
const xIndex = APP_NAME.indexOf('X')
export const BRAND_PARTS = {
  pre: xIndex >= 0 ? APP_NAME.slice(0, xIndex) : APP_NAME,
  x: xIndex >= 0 ? APP_NAME[xIndex] : '',
  post: xIndex >= 0 ? APP_NAME.slice(xIndex + 1) : '',
} as const
