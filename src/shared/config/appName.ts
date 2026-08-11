import { getConfig } from './runtimeConfig'

/**
 * 应用名称与品牌拆分（来源：运行时 config.json）。
 *
 * 改为函数（调用时读取）而非模块顶层常量：模块顶层 `getConfig()` 会在文件加载时立即执行，
 * 若本模块被并入 shared chunk 并在 main.ts 顶层静态加载，则会在 `loadConfig()` 完成前求值、
 * `_config` 仍为 null 时抛错。改为函数后，调用时机跟随组件 setup，必在 bootstrap 之后。
 */

/** 应用名称 */
export function getAppName(): string {
  return getConfig().appName
}

/**
 * 品牌名按大写 X 拆分：navbar / drawer / Hero 统一把 X 用渐变高亮；
 * 没有 X 时 pre 为完整名称、x/post 为空串（与各组件原先的内联逻辑一致）。
 */
export function getBrandParts(): {
  pre: string
  x: string
  post: string
} {
  const name = getAppName()
  const xIndex = name.indexOf('X')
  return {
    pre: xIndex >= 0 ? name.slice(0, xIndex) : name,
    x: xIndex >= 0 ? name[xIndex]! : '',
    post: xIndex >= 0 ? name.slice(xIndex + 1) : '',
  }
}
