/**
 * 配置统一出口。
 *
 * 分三层：
 * - runtimeConfig.ts  运行时人编辑的 config.json（应用名称、分页、验证码、团队成员、下拉选项）
 * - env.ts            构建/部署环境变量（API 地址，随部署变化）
 * - 其余              代码内部常量（存储键名、OSS 调优参数等，非人来配置）
 *
 * 用法：
 *   import { ENV, STORAGE_KEYS } from '@/shared/config'
 *   import { APP_NAME } from '@/shared/config/app'          // 直接导入，避免触发模块级 getConfig()
 *   import { getConfig } from '@/shared/config/runtimeConfig'   // 读分页/验证码/选项等运行时配置
 */
export { ENV } from './env'
export { STORAGE_KEYS, SESSION_KEYS } from './storageKeys'
export { OSS_UPLOAD, ZARR_STORE } from './defaults'
export { loadConfig, getConfig } from './runtimeConfig'
export type { AppConfig, OptionLists, TeamMember } from './runtimeConfig'
