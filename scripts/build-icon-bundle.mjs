// 离线图标打包脚本：从本地 @iconify-json/* 数据里抽取项目实际用到的图标子集，
// 写成一个小文件给 src/shared/icons/offlineRegistry.ts 直接 import，
// 避免把整套图标集（数 MB）打进生产包。改了 scripts/iconNames.mjs 后重跑本脚本。
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getIcons } from '@iconify/utils'
import { ICON_SETS } from './iconNames.mjs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outFile = path.join(__dirname, '../src/shared/icons/iconBundle.generated.json')

const bundle = Object.entries(ICON_SETS).map(([prefix, names]) => {
  const data = require(`@iconify-json/${prefix}/icons.json`)
  const subset = getIcons(data, names)
  if (!subset) throw new Error(`Failed to extract icons for prefix "${prefix}"`)
  return subset
})

writeFileSync(outFile, JSON.stringify(bundle))

const total = bundle.reduce((n, c) => n + Object.keys(c.icons).length, 0)
console.log(`Wrote ${path.relative(process.cwd(), outFile)} (${total} icons across ${bundle.length} sets)`)
