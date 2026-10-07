/**
 * 生物信息工具集（离线索引，只读）：HMDB 代谢物档案 + KEGG 通路。
 *
 * 数据源（均由 scripts/build-*-index.mjs 预构建为同源静态资源）：
 * - HMDB（hmdb.ca）：组织定位/疾病关联/生物功能是 MSI 生物学解读的关键
 *   语义层。hmdb.ca 对程序化下载返回 403，索引脚本消费**手动下载**的
 *   `hmdb_metabolites.xml`（或按体液的子集 XML）生成
 *   public/data/hmdb-index.json。未构建时工具返回可读指引而不是报错。
 * - KEGG REST（rest.kegg.jp，Node 侧可直连但无 CORS 头）：
 *   list/compound + link/pathway/compound + list/pathway/hsa →
 *   public/data/kegg-pathway-index.json（化合物 → 参考通路）。
 *
 * 设计约束同 knowledgeTools：懒加载 + 模块级缓存；结果摘要化；
 * 索引缺失/未构建 → 可读错误（isError 回喂模型）。
 */

import type { Context, Plugin } from 'cordis'
import { defineTool } from './defineTool'
import { createLazyJsonLoader } from './httpJson'
import { ADDUCTS } from './knowledgeTools'

/** HMDB 索引行：[accession, name, formula, monoMass, keggId, tissues[], diseases[], biofunction] */
export type HmdbRow = [
  string,
  string,
  string | null,
  number,
  string | null,
  string[],
  string[],
  string | null,
]

/** KEGG 索引（build-kegg-index.mjs 生成）：id/名称 归一小写 */
export interface KeggIndex {
  /** map 编号 → 通路名 */
  pathways: Record<string, string>
  /** 小写归一 C-id → [C-id, ...names] */
  compounds: Record<string, string[]>
  /** 小写 C-id → [map 编号, ...] */
  links: Record<string, string[]>
}

// ---- 懒加载（共享工厂，见 httpJson.createLazyJsonLoader） ----

const loadHmdbIndex = createLazyJsonLoader<HmdbRow[]>(
  'hmdb-index.json',
  () => 'HMDB offline index not found in this deployment (needs public/data/hmdb-index.json).',
)

const loadKeggIndex = createLazyJsonLoader<KeggIndex>(
  'kegg-pathway-index.json',
  () => 'KEGG offline index not found in this deployment (needs public/data/kegg-pathway-index.json).',
)

/** 索引缺失时的统一指引文案（拼接在 loadJson 的错误信息后） */
function notBuiltHint(script: string): string {
  return ` Build it with: node scripts/${script} (see the script header for the data source), then redeploy.`
}

// ---- 检索（纯函数，供测试） ----

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_/(),-]/g, '')
}

/** 名称/HMDB id 子串检索 */
export function searchHmdbIndex(index: HmdbRow[], query: string, max: number): HmdbRow[] {
  const q = norm(query)
  const out: HmdbRow[] = []
  for (const row of index) {
    if (norm(row[1]).includes(q) || row[0].toLowerCase().includes(q)) {
      out.push(row)
      if (out.length >= max) break
    }
  }
  return out
}

/** m/z ± 加合物质量检索（与 library_mass_search 同表） */
export function massSearchHmdbIndex(
  index: HmdbRow[],
  mz: number,
  polarity: 'positive' | 'negative',
  ppm: number,
  max: number,
): { row: HmdbRow; adduct: string; ppm: number }[] {
  const table = ADDUCTS[polarity]
  const out: { row: HmdbRow; adduct: string; ppm: number }[] = []
  const window = (mz * ppm) / 1e6
  for (const [name, shift] of Object.entries(table)) {
    const neutral = mz - shift
    for (const row of index) {
      const m = row[3]
      if (!Number.isFinite(m) || m === 0) continue
      if (Math.abs(m - neutral) <= window) {
        out.push({ row, adduct: name, ppm: ((m - neutral) / mz) * 1e6 })
      }
    }
  }
  out.sort((a, b) => Math.abs(a.ppm) - Math.abs(b.ppm))
  return out.slice(0, max)
}

function formatHmdbRow(r: HmdbRow, adduct?: string, ppm?: number): string {
  const parts = [`- ${r[1]} (${r[0]})`]
  if (r[2]) parts.push(`| ${r[2]}`)
  if (r[3] > 0) parts.push(`| M ${r[3]}`)
  if (r[4]) parts.push(`| KEGG ${r[4]}`)
  if (adduct) parts.push(`| ${adduct} Δ${ppm!.toFixed(1)} ppm`)
  if (r[5].length > 0) parts.push(`\n  tissues: ${r[5].slice(0, 8).join('; ')}`)
  if (r[6].length > 0) parts.push(`\n  diseases: ${r[6].slice(0, 8).join('; ')}`)
  if (r[7]) parts.push(`\n  biofunction: ${r[7]}`)
  return parts.join(' ')
}

/** HMDB 查询（名称/id 或 m/z 质量模式） */
export async function hmdbLookup(
  query: string | null,
  mz: number | null,
  polarity: 'positive' | 'negative',
  ppm: number,
  max: number,
): Promise<string> {
  let index: HmdbRow[]
  try {
    index = await loadHmdbIndex()
  } catch (err) {
    throw new Error(`${(err as Error).message}${notBuiltHint('build-hmdb-index.mjs')}`)
  }

  if (mz != null) {
    const hits = massSearchHmdbIndex(index, mz, polarity, ppm, max)
    if (hits.length === 0) {
      return `No HMDB metabolites match m/z ${mz} within ${ppm} ppm (${polarity} adducts scanned).`
    }
    const lines = [`m/z ${mz} (${polarity}, ${ppm} ppm) — top HMDB metabolites:`]
    for (const h of hits) lines.push(formatHmdbRow(h.row, h.adduct, h.ppm))
    lines.push('source: HMDB (local offline index; https://hmdb.ca)')
    return lines.join('\n')
  }

  const q = query ?? ''
  const hits = searchHmdbIndex(index, q, max)
  if (hits.length === 0) {
    return `No HMDB entries match "${q}". Try a common metabolite name or an HMDB id (HMDB00001).`
  }
  const lines = hits.map((r) => formatHmdbRow(r))
  lines.push('source: HMDB (local offline index; https://hmdb.ca)')
  return lines.join('\n')
}

/** 化合物/通路名 → KEGG 通路（正反向） */
export async function keggLookup(query: string, max: number): Promise<string> {
  let index: KeggIndex
  try {
    index = await loadKeggIndex()
  } catch (err) {
    throw new Error(`${(err as Error).message}${notBuiltHint('build-kegg-index.mjs')}`)
  }

  const q = norm(query)
  const lines: string[] = []

  // 1) 通路名/编号查询 → 通路下的化合物
  const pathwayIds = Object.entries(index.pathways)
    .filter(([id, name]) => norm(name).includes(q) || id.includes(q.replace(/^path:/, '')))
    .slice(0, 3)
  for (const [pid, pname] of pathwayIds) {
    const comps = Object.entries(index.links)
      .filter(([, maps]) => maps.includes(pid))
      .slice(0, max)
      .map(([cid]) => (index.compounds[cid]?.[0] ?? cid) + ' ' + (index.compounds[cid]?.[1] ?? ''))
    lines.push(`pathway ${pid} ${pname}`)
    lines.push(`  compounds (${comps.length >= max ? `${max}+` : comps.length}): ${comps.join('; ')}`)
  }

  // 2) 化合物名/C-id 查询 → 所属通路
  const cidMatches = Object.entries(index.compounds)
    .filter(([key, names]) => key === q || names.some((n) => norm(n).includes(q)))
    .slice(0, 5)
  for (const [key, names] of cidMatches) {
    const cid = names[0]
    const maps = index.links[key] ?? []
    if (maps.length === 0) {
      lines.push(`- ${names.slice(1, 3).join(' / ')} (${cid}): no pathway links`)
      continue
    }
    lines.push(`- ${names.slice(1, 3).join(' / ')} (${cid}) — ${maps.length} pathway(s):`)
    for (const m of maps.slice(0, max)) {
      lines.push(`  ${m} ${index.pathways[m] ?? '(reference pathway)'}`)
    }
  }

  if (lines.length === 0) {
    return (
      `No KEGG entries match "${query}". Try a compound name ("glucose", "palmitic acid"), ` +
      `a C number ("C00031"), or a pathway ("glycolysis", "map00010").`
    )
  }
  lines.push('source: KEGG (local offline index; https://www.kegg.jp, Kanehisa et al. NAR)')
  return lines.join('\n')
}

// ---- 插件 ----

/**
 * 生物信息工具插件。在 bootstrap 中：ctx.plugin(bioTools)
 * 面向"这个分子在这类组织/疾病/通路里意味着什么"的解读。
 */
export const bioTools: Plugin.Function<void> = (ctx: Context) => {
  ctx.tools.register(
    defineTool({
      name: 'hmdb_lookup',
      category: 'biology',
      description:
        'Look up metabolites in the Human Metabolome Database (offline local index): tissue ' +
        'localization, disease associations, biological function, formula/mass, KEGG id. Query by ' +
        'name / HMDB id, or by observed m/z (+polarity) for adduct-aware mass matching of small ' +
        'molecules (non-lipid). The biology layer behind "what does this molecule do here".',
      parameters: {
        query: { type: 'string', description: 'Metabolite name or HMDB id (e.g. "glucose", "HMDB00165")' },
        mz: { type: 'number', description: 'Observed m/z for mass-based search (needs polarity)' },
        polarity: {
          type: 'string',
          description: 'Ion mode for mz search: "positive" or "negative"',
        },
        ppm: { type: 'integer', description: 'Mass tolerance in ppm (default 10, max 50)' },
        maxResults: { type: 'integer', description: 'Max entries (default 10, max 25)' },
      },
      async execute(args) {
        if (args.query == null && args.mz == null) {
          throw new Error('Provide either "query" (name/id) or "mz" (+ "polarity")')
        }
        const polarity = args.polarity === 'negative' ? 'negative' : 'positive'
        return hmdbLookup(
          args.query ?? null,
          args.mz ?? null,
          polarity,
          Math.min(Math.max(args.ppm ?? 10, 1), 50),
          Math.min(Math.max(args.maxResults ?? 10, 1), 25),
        )
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'kegg_pathway_lookup',
      category: 'biology',
      description:
        'Map a metabolite to its KEGG metabolic pathways (offline index): query a compound name or ' +
        'C number to list pathways (e.g. "what pathway is palmitic acid in"), or a pathway name/map ' +
        'id to list member compounds — supports "which pathways are enriched in this annotation set".',
      parameters: {
        query: {
          type: 'string',
          required: true,
          description: 'Compound name / C number / pathway name or map id',
        },
        maxResults: { type: 'integer', description: 'Max pathways or compounds (default 10, max 20)' },
      },
      async execute(args) {
        return keggLookup(args.query!, Math.min(Math.max(args.maxResults ?? 10, 1), 20))
      },
    }),
  )
}

// cordis 4：fiber 内访问兄弟服务（ctx.tools）必须声明 inject。
bioTools.inject = ['tools']
