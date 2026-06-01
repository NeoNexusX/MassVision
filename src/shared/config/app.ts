import { getConfig } from './runtimeConfig'

/** 应用名称（来源：运行时 config.json，见 runtimeConfig.ts） */
export const APP_NAME = getConfig().appName
