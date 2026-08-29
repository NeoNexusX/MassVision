#!/usr/bin/env node
/**
 * 把正式环境专属的 config 覆盖深合并进 config.json（仅 CI 正式构建前执行）。
 *
 * 用法：node scripts/apply-prod-config.mjs [overrides.json] [target.json]
 *   缺省：env/config.prod.overrides.json → public/config.json
 *
 * 背景：测试/正式服务器共用仓库里的 public/config.json，仅个别键有差异
 * （如 OSS 预览图域名）。与其维护两份完整配置（会漂移），不如只维护一个
 * 小覆盖文件：deploy-main.yml 在 docker build 前执行本脚本，覆盖键以覆盖
 * 文件为准，其余配置始终跟随仓库主文件。
 *
 * 合并规则：递归深合并——普通对象逐键下沉；数组与其他值类型整体替换。
 * 本地一般不需要跑；若跑过请 git checkout public/config.json 还原。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const overridesPath = process.argv[2] ?? 'env/config.prod.overrides.json'
const targetPath = process.argv[3] ?? 'public/config.json'

function deepMerge(base, override) {
  const out = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const baseValue = out[key]
    const bothPlainObjects =
      value && typeof value === 'object' && !Array.isArray(value) &&
      baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)
    out[key] = bothPlainObjects ? deepMerge(baseValue, value) : value
  }
  return out
}

const target = JSON.parse(readFileSync(targetPath, 'utf8'))
const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'))
const merged = deepMerge(target, overrides)

writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
console.log(`[apply-prod-config] merged ${overridesPath} into ${targetPath}:`)
console.log(JSON.stringify(overrides))
