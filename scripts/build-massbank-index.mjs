/**
 * 从 MassBank-data GitHub 仓库构建参考 MS/MS 谱库离线索引
 * （public/data/massbank-index.json）。
 *
 * 用途：AI 助手 spectral_library_search 工具（spectralTools.ts）的离线
 * 数据源——注释行的 precursor m/z（+实测峰列表）与库内参考谱匹配，
 * 提供碎片证据（阶段③）。MassBank 新版 REST 无公开文档、GNPS 无 CORS
 * 头，浏览器无法直连，故照 LIPID MAPS 先例离线化。
 *
 * 数据来源与许可：MassBank，https://massbank.eu（Horai et al., J Mass
 * Spectrom 2010, doi:10.1002/jms.1777；各记录 LICENSE 多为 CC BY-SA）。
 *
 * 下载：GitHub codeload zip（https://codeload.github.com/MassBank/
 * MassBank-data/zip/refs/heads/dev，~几百 MB，缓存在
 * scripts/.massbank-cache.zip，重跑不重复下载；删掉该文件即可强制刷新）。
 *
 * 用法：node scripts/build-massbank-index.mjs [--dir <repo路径> | --keep-download]
 *   --dir  从已 clone 的 MassBank-data 仓库目录读取（跳过 zip 下载；
 *          推荐：git clone --depth 1 https://github.com/MassBank/MassBank-data.git）
 * 过滤：有 PRECURSOR_M/Z（50–2000）与 ION_MODE，峰数 ≥5；每谱保留
 * 按强度 top-30 峰（m/z 3 位小数 + 相对强度）。
 * 输出格式（JSON 数组的对象）：
 *   { a: accession, n: name, f: formula, mode: 'positive'|'negative',
 *     mz: precursorMz, ins: instrumentType, pk: [[mz, relInt], ...] }
 */

import { statSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { BlobReader, TextWriter, ZipReader, configure } from '@zip.js/zip.js'

// Node 环境：禁用 web worker（zip.js 否则会尝试创建 DOM worker）
configure({ useWebWorkers: false })

const ZIP_URL = 'https://codeload.github.com/MassBank/MassBank-data/zip/refs/heads/dev'
const CACHE = path.resolve('scripts/.massbank-cache.zip')
const OUT_DIR = path.resolve('public/data')
const OUT_FILE = path.join(OUT_DIR, 'massbank-index.json')

const PRECURSOR_MIN = 50
const PRECURSOR_MAX = 2000
const MIN_PEAKS = 5
const TOP_PEAKS = 30

/** 解析一条 MassBank 记录 → 索引条目（不满足过滤条件返回 null） */
function parseRecord(text) {
  let accession = null
  let name = null
  let formula = null
  let mode = null
  let precursor = null
  let instrument = null
  /** PK$PEAK 区之后的行 → [mz, relInt] */
  const peaks = []

  const lines = text.split(/\r?\n/)
  let inPeaks = false
  for (const line of lines) {
    if (!inPeaks) {
      if (line.startsWith('ACCESSION: ')) accession = line.slice(11).trim()
      else if (line.startsWith('CH$NAME: ') && !name) name = line.slice(9).trim()
      else if (line.startsWith('CH$FORMULA: ')) formula = line.slice(12).trim()
      else if (line.startsWith('AC$INSTRUMENT_TYPE: ')) instrument = line.slice(20).trim()
      else if (line.startsWith('AC$MASS_SPECTROMETRY: ION_MODE '))
        mode = line.includes('POSITIVE') ? 'positive' : 'negative'
      else if (line.startsWith('MS$FOCUSED_ION: PRECURSOR_M/Z ')) {
        const v = Number(line.slice(29))
        if (Number.isFinite(v)) precursor = v
      } else if (line.startsWith('PK$PEAK:')) inPeaks = true
    } else {
      const m = line.match(/^\s+(\d+(?:\.\d+)?)\s+\d+(?:\.\d+)?\s+(\d+)\s*$/)
      if (!m) {
        if (line.trim() === '') continue
        inPeaks = false // 下一个标签段开始
        continue
      }
      peaks.push([Number(m[1]), Number(m[2])])
    }
  }

  if (
    !accession ||
    !mode ||
    precursor == null ||
    precursor < PRECURSOR_MIN ||
    precursor > PRECURSOR_MAX ||
    peaks.length < MIN_PEAKS
  )
    return null

  // top-N 峰按强度，再按 m/z 升序（匹配窗扫描友好）
  const top = peaks
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_PEAKS)
    .sort((a, b) => a[0] - b[0])

  return {
    a: accession,
    n: name ?? accession,
    f: formula ?? null,
    mode,
    mz: precursor,
    ins: instrument ?? null,
    pk: top,
  }
}

/** 递归收集 .txt 记录文件 */
function collectTxtFiles(dir, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (ent.name === '.git' || ent.name === '.scripts' || ent.name === '.github') continue
      collectTxtFiles(path.join(dir, ent.name), acc)
    } else if (ent.isFile() && ent.name.endsWith('.txt')) {
      acc.push(path.join(dir, ent.name))
    }
  }
  return acc
}

/** 写索引 + 统计日志（zip / dir 两条路径共用） */
async function writeIndex(rows) {
  rows.sort((a, b) => a.mz - b.mz)
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(rows))

  const pos = rows.filter((r) => r.mode === 'positive').length
  console.log(`eligible records (precursor+mode+peaks): ${rows.length}`)
  console.log(`  positive: ${pos}, negative: ${rows.length - pos}`)
  console.log(`wrote ${OUT_FILE} (${(statSync(OUT_FILE).size / 1e6).toFixed(1)} MB)`)
}

/** --dir 模式：解析已 clone 的仓库目录 */
async function buildFromDirectory(repoDir) {
  if (!existsSync(repoDir)) throw new Error(`directory not found: ${repoDir}`)
  const files = collectTxtFiles(repoDir)
  console.log(`records in repo: ${files.length}`)

  const rows = []
  let parsed = 0
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    parsed++
    if (parsed % 5000 === 0) console.log(`  parsed ${parsed}/${files.length}…`)
    const row = parseRecord(text)
    if (row) rows.push(row)
  }
  await writeIndex(rows)
}

async function main() {
  // 0) --dir 模式：直接读已 clone 的仓库目录
  const dirIdx = process.argv.indexOf('--dir')
  if (dirIdx !== -1 && process.argv[dirIdx + 1]) {
    const repoDir = path.resolve(process.argv[dirIdx + 1])
    await buildFromDirectory(repoDir)
    return
  }
  // 1) 下载（缓存可复用）
  if (!existsSync(CACHE)) {
    console.log(`downloading ${ZIP_URL} …`)
    const res = await fetch(ZIP_URL)
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(CACHE, buf)
    console.log(`cached ${(buf.length / 1e6).toFixed(0)} MB -> ${CACHE}`)
  } else {
    console.log(`using cached zip ${CACHE} (${(statSync(CACHE).size / 1e6).toFixed(0)} MB)`)
  }

  // 2) 解包 + 解析（zip.js 无 worker 模式，逐条流式 getText；
  //    getEntries() 返回 Promise<Entry[]>，不能直接 for-await 迭代 Promise）
  const entries = []
  const reader = new ZipReader(new BlobReader(new Blob([await readFile(CACHE)])))
  for (const entry of await reader.getEntries()) {
    if (entry.directory || !entry.filename.endsWith('.txt')) continue
    entries.push(entry)
  }
  console.log(`records in repo: ${entries.length}`)

  const rows = []
  let parsed = 0
  for (const entry of entries) {
    const text = await entry.getData(new TextWriter())
    parsed++
    if (parsed % 5000 === 0) console.log(`  parsed ${parsed}/${entries.length}…`)
    const row = parseRecord(text)
    if (row) rows.push(row)
  }
  await reader.close()
  await writeIndex(rows)

  // 默认删缓存（几百 MB 磁盘；--keep-download 保留以便重跑）
  if (!process.argv.includes('--keep-download') && existsSync(CACHE)) {
    rmSync(CACHE)
    console.log('removed zip cache (pass --keep-download to keep it)')
  }
}

main()
