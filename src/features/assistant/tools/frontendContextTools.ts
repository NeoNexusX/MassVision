/**
 * 前端上下文工具集：从当前页面运行时数据读取统计摘要（全部只读）。
 *
 * 数据来源：
 * - services/zarr/zarrSharedState 的模块级共享状态（getSharedZarrContext / metadataAttrsRef）
 * - providers/analysisContext 的实例级 provider 注册表（selectedIon / kmeans / annotations）
 */

import type { Context, Plugin } from 'cordis'
import { defineTool } from './defineTool'
import {
  buildDatasetOverview,
  buildIonImageStats,
  buildMeanSpectrumTopPeaks,
  buildKmeansSummary,
  buildUmapSummary,
  buildPixelSpectrumPeaks,
  buildAnnotationTop,
  buildPageState,
  getAnnotationData,
} from '../providers/analysisContext'
import {
  isotopeEnvelope,
  chargeFromIonType,
} from '@/features/vizworkbench/utils/isotope'
import { DEFAULT_TOP_N, MAX_TOP_N } from '../agentconfig/defaults'
import type {
  DatasetOverview,
  IonImageStats,
  UmapSummary,
  KmeansSummary,
  SpectrumPeak,
  AnnotationRow,
  PageState,
} from '../agenttypes/assistant'

/** 数值格式化：科学计数法（紧凑）；null/undefined → N/A */
function fmt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'N/A'
  if (v === 0) return '0'
  if (Math.abs(v) >= 1000 || Math.abs(v) < 0.01) return v.toExponential(3)
  return v.toFixed(4).replace(/\.?0+$/, '')
}

// ---- 各工具的 render 函数 ----

/** 渲染数据集概览（get_dataset_overview 工具与 system prompt 静态段共用） */
export function renderDataset(d: DatasetOverview): string {
  const lines = [`dataMode: ${d.dataMode}`, `dimensions: ${d.width} x ${d.height}`]
  if (d.rowAxis) lines.push(`rowAxis: ${d.rowAxis}`)
  if (d.name) lines.push(`sampleName: ${d.name}`)
  if (d.filename) lines.push(`filename: ${d.filename}`)
  if (d.pixelCount != null) lines.push(`pixelCount: ${d.pixelCount}`)
  if (d.pixelSizeHorizontal != null)
    lines.push(`pixelSize: ${d.pixelSizeHorizontal} x ${d.pixelSizeVertical ?? '?'} um`)
  if (d.mzMin != null)
    lines.push(`mzRange: ${fmt(d.mzMin)} - ${fmt(d.mzMax)} (${d.mzCount} points)`)
  if (d.analyzer) lines.push(`analyzer: ${d.analyzer}`)
  if (d.ionisationSource) lines.push(`ionSource: ${d.ionisationSource}`)
  if (d.polarity) lines.push(`polarity: ${d.polarity}`)
  return lines.join('\n')
}

function renderIonImage(i: IonImageStats): string {
  const hot = i.hotspots.map((h) => `  (${h.x},${h.y})=${fmt(h.intensity)}`).join('\n')
  return [
    `mz: ${fmt(i.mz)} +/- ${i.tolerance}`,
    `max: ${fmt(i.max)}, mean: ${fmt(i.mean)}, min: ${fmt(i.min)}`,
    `nonzeroRatio: ${(i.nonzeroRatio * 100).toFixed(1)}%`,
    `p50: ${fmt(i.p50)}, p90: ${fmt(i.p90)}, p99: ${fmt(i.p99)}`,
    hot ? `hotspots:\n${hot}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function renderPeaks(peaks: SpectrumPeak[]): string {
  if (peaks.length === 0)
    return 'No spectrum data available (not in continuous mode, or not loaded).'
  return peaks.map((p, i) => `${i + 1}. mz=${fmt(p.mz)} intensity=${fmt(p.intensity)}`).join('\n')
}

function renderKmeans(k: KmeansSummary): string {
  const sizes = k.clusterSizes.map((n, i) => `  cluster ${i}: ${n} px`).join('\n')
  const sel =
    k.selectedIds.length > 0 ? `selected: [${k.selectedIds.join(', ')}]` : 'selected: none'
  return `k=${k.k}\n${sizes}\n${sel}`
}

function renderAnnotations(rows: AnnotationRow[]): string {
  if (rows.length === 0) return 'No annotation matches in current context.'
  // 排序口径头：与 buildAnnotationTop 同一判定（有综合分按其降序，否则
  // |massError| 升序）。写进输出让模型能向用户说明「前几个」按什么排，
  // 避免与注释面板（默认 massError 升序）顺序不一致时用户对不上号。
  const hasComposite = rows.some((r) => r.compositeScore != null)
  const sortNote = hasComposite
    ? 'Top matches sorted by composite evidence score (descending) — most confident first. Note: this differs from the annotation panel default (mass error ascending).'
    : 'Top matches sorted by |mass error| (ascending) — closest mass matches first (no composite evidence score available).'
  const body = rows
    .map((a, i) => {
      // name 截 36 字符：给证据 token 留预算（工具输出有 2000 字符截断）
      const raw = a.name || (a.candidates && a.candidates[0]) || a.formulaIon || '?'
      const name = raw.length > 36 ? `${raw.slice(0, 36)}…` : raw
      const ionType = a.ionType ? ` [${a.ionType}]` : ''
      const mz = a.matchedMz ?? a.expMz
      // 有综合分时 err 被 composite 吸收，改用紧凑证据 token：
      // L4 c=0.87 q=2% add=0.50×2 [msm=0.79 ch=0.95 sp=0.91 ar=0.83]
      let evidence = ''
      if (a.compositeScore != null) {
        const lvl = a.level != null ? ` L${a.level}` : ''
        const q = a.fdr != null ? ` q=${(a.fdr * 100).toFixed(1)}%` : ''
        const adduct =
          a.adductScore != null && (a.adductPeers?.length ?? 0) > 0
            ? ` add=${a.adductScore.toFixed(2)}×${(a.adductPeers?.length ?? 0) + 1}`
            : ''
        const msm = a.msm != null ? ` msm=${a.msm.toFixed(2)}` : ''
        const ch = a.chaos != null ? ` ch=${a.chaos.toFixed(2)}` : ''
        const sp = a.spatial != null ? ` sp=${a.spatial.toFixed(2)}` : ''
        const ar = a.adductCorr != null ? ` ar=${a.adductCorr.toFixed(2)}` : ''
        evidence = `${lvl} c=${a.compositeScore.toFixed(2)}${q}${adduct}${msm}${ch}${sp}${ar}`
      } else {
        evidence = a.massError != null ? ` err=${fmt(Math.abs(a.massError))}` : ''
      }
      return `${i + 1}. mz=${fmt(mz ?? undefined)} ${name}${ionType}${evidence}`
    })
    .join('\n')
  return [sortNote, body].join('\n')
}

/** 单条注释的完整证据（get_annotation_detail 工具的渲染体）：
 *  Tier-1 全字段 + Tier-2 chaos/spatial/spectral/MSM + 多加合物组 +
 *  理论同位素包络。peers 为同分子其他加合物行（供 m/z 与名称）。 */
export function renderAnnotationDetail(
  a: AnnotationRow,
  spatial:
    | { chaos?: number | null; spatial?: number | null; spectral?: number | null; msm?: number | null; adductCorr?: number | null }
    | null
    | undefined,
  peers: { ionType?: string | null; matchedMz?: number | null; expMz?: number }[],
): string {
  const lines: string[] = []
  lines.push(`name: ${a.name || a.candidates?.[0] || '?'}`)
  if (a.candidates && a.candidates.length > 1) {
    lines.push(`candidates (${a.candidates.length}): ${a.candidates.slice(0, 10).join(' | ')}`)
  }
  const id = [
    a.formulaIon ? `formula ${a.formulaIon}` : '',
    a.ionType ? `ion ${a.ionType}` : '',
    `expMz ${fmt(a.expMz)}`,
    a.matchedMz != null ? `matchedMz ${fmt(a.matchedMz)}` : '',
    a.massError != null ? `err ${fmt(Math.abs(a.massError))}` : '',
    a.avgIntensity != null ? `avgIntensity ${fmt(a.avgIntensity)}` : '',
  ]
    .filter(Boolean)
    .join(' | ')
  lines.push(id)
  lines.push(
    `status: ${a.matchStatus ?? 'unknown'}` +
      (a.matchStatus !== 'matched' ? ' (only matched rows carry evidence scores)' : ''),
  )
  if (a.matchStatus === 'matched') {
    lines.push(
      [
        `scores: L${a.level ?? '?'}`,
        `mass=${fmt(a.massScore)}`,
        a.isotopeScore != null ? `iso=${fmt(a.isotopeScore)}` : 'iso=N/A',
        a.isotopeObsCount != null ? `(${a.isotopeObsCount}/${a.isotopeExpCount ?? '?'} peaks)` : '',
        a.adductScore != null ? `adduct=${fmt(a.adductScore)}` : '',
        `composite=${fmt(a.compositeScore)}`,
        a.fdr != null ? `fdr=${(a.fdr * 100).toFixed(2)}%` : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    if (spatial) {
      lines.push(
        `spatial (Tier-2): chaos=${fmt(spatial.chaos)} sp=${fmt(spatial.spatial)} ` +
          `spec=${fmt(spatial.spectral)} msm=${fmt(spatial.msm)}` +
          (spatial.adductCorr != null ? ` adductCorr=${spatial.adductCorr.toFixed(2)}` : ''),
      )
    }
    if (peers.length > 0) {
      lines.push(
        `adduct group (M×${peers.length + 1}): ` +
          peers
            .map((p) => `${p.ionType ?? '?'} mz=${fmt(p.matchedMz ?? p.expMz)}`)
            .join(', ') +
          (spatial?.adductCorr != null
            ? spatial.adductCorr >= 0.7
              ? ' [spatially confirmed]'
              : ' [NOT co-localized — bonus questionable]'
            : ' [spatial confirmation pending]'),
      )
    }
    const z = chargeFromIonType(a.ionType ?? null)
    const env = isotopeEnvelope(a.formulaIon ?? null, z)
    if (env) {
      const anchor = a.matchedMz ?? a.expMz ?? 0
      lines.push(
        'isotope envelope (theory): ' +
          env
            .map((p) => {
              const k = Math.round((p.dm * z) / 1.0033548)
              return `${k <= 0 ? 'M' : `M+${k}`} ${(p.rel * 100).toFixed(1)}% (${(anchor + p.dm).toFixed(4)})`
            })
            .join(' | '),
      )
    }
  }
  return lines.join('\n')
}

function renderUmap(u: UmapSummary): string {
  const lines: string[] = [`ready: ${u.ready}`, `overlayVisible: ${u.visible}`]
  if (u.computing)
    lines.push('computing: true (backend task still in progress, results may change)')
  if (u.error) lines.push(`error: ${u.error}`)
  lines.push(`grid: ${u.grid.width} x ${u.grid.height}`)
  // 提示模型解读语义：UMAP 颜色是 3 维 embedding 的 RGB 编码，非物理量
  lines.push(
    'note: colors encode a 3-D UMAP embedding (dimensionality-reduced spectra), spatially contiguous colors indicate spectrally similar regions.',
  )
  return lines.join('\n')
}

function renderPageState(s: PageState): string {
  const hasAnything =
    s.dataset ||
    s.selectedIon ||
    s.kmeans ||
    s.umap ||
    (s.annotationCount ?? 0) > 0 ||
    s.meanSpectrumAvailable
  if (!hasAnything) {
    return unavailable('Page state')
  }
  const lines: string[] = []
  if (s.dataset) lines.push(renderDataset(s.dataset))
  if (s.selectedIon)
    lines.push(`selected ion: mz=${fmt(s.selectedIon.mz)} +/- ${s.selectedIon.tolerance}`)
  if (s.kmeans)
    lines.push(
      `kmeans: k=${s.kmeans.k}, ${s.kmeans.clusterCount} clusters, ${s.kmeans.selectedCount} selected`,
    )
  if (s.umap)
    lines.push(`umap: ${s.umap.ready ? (s.umap.computing ? 'computing' : 'ready') : 'not loaded'}`)
  if (s.annotationCount != null) lines.push(`annotation matches: ${s.annotationCount}`)
  lines.push(`mean spectrum: ${s.meanSpectrumAvailable ? 'available' : 'not loaded'}`)
  return lines.join('\n')
}

/** guard：无数据时返回提示而不是抛错（模型可理解并告知用户） */
function unavailable(what: string): string {
  return `${what} is not available in the current page context. Ask the user to open a result detail page and select an ion / enable annotations.`
}

/**
 * 前端上下文工具插件。
 *
 * 在 bootstrap 中：ctx.plugin(frontendContextTools)
 * 工具依赖 ctx.tools 服务（providers/tools.ts 先加载）。
 */
export const frontendContextTools: Plugin.Function<void> = (ctx: Context) => {
  // 页面状态主入口：轻量、实时（直接字段，不做重统计），数据相关问题的第一步
  ctx.tools.register(
    defineTool({
      category: 'page',
      name: 'get_page_state',
      description:
        'Get the live state of the current page: dataset overview (dimensions, data mode, m/z range), currently selected ion, clustering summary, annotation match count. Lightweight and always current. Call this FIRST for any question about the loaded data, then use specialized get_* tools for detailed statistics.',
      parameters: {},
      async execute() {
        return renderPageState(buildPageState())
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      category: 'page',
      name: 'get_dataset_overview',
      description:
        'Get an overview of the currently loaded MSI dataset: dimensions, data mode, m/z range, instrument metadata. Note: static sample metadata is already in the system prompt (Dataset Context section) — use this only to verify or when the user asks about it explicitly.',
      parameters: {},
      async execute() {
        const d = buildDatasetOverview()
        return d ? renderDataset(d) : unavailable('Dataset overview')
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      category: 'page',
      name: 'get_ion_image_stats',
      description:
        'Get statistics of the currently selected ion image: m/z, tolerance, max/mean/min intensity, nonzero ratio, percentiles, hotspots.',
      parameters: {},
      async execute() {
        const i = buildIonImageStats()
        return i ? renderIonImage(i) : unavailable('Ion image statistics')
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      category: 'page',
      name: 'get_mean_spectrum_top_peaks',
      description: 'Get the top-N peaks of the mean spectrum (continuous mode only).',
      parameters: {
        topN: {
          type: 'integer',
          description: `Number of peaks to return (default ${DEFAULT_TOP_N}, max ${MAX_TOP_N})`,
        },
      },
      async execute(args) {
        const n = Math.min(Math.max(args.topN ?? DEFAULT_TOP_N, 1), MAX_TOP_N)
        return renderPeaks(buildMeanSpectrumTopPeaks(n))
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      category: 'page',
      name: 'get_kmeans_summary',
      description:
        'Get KMeans clustering summary: k, cluster sizes, currently selected cluster ids.',
      parameters: {},
      async execute() {
        const k = buildKmeansSummary()
        return k ? renderKmeans(k) : unavailable('KMeans clustering')
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      category: 'page',
      name: 'get_umap_summary',
      description:
        'Get the UMAP clustering overlay status: whether the UMAP zarr is loaded (ready), the backend task is still computing, any load error, the raster grid size, and whether the overlay currently shows on the ion image. Use before discussing UMAP dimensionality reduction or spatial clustering.',
      parameters: {},
      async execute() {
        const u = buildUmapSummary()
        return u ? renderUmap(u) : unavailable('UMAP clustering overlay')
      },
    }),
  )
  ctx.tools.register(
    defineTool({
      category: 'page',
      name: 'get_pixel_spectrum',
      description:
        'Get the top-N peaks of the currently loaded single-pixel spectrum (the spectrum shown in the spectrum panel when the user clicks a pixel of the ion image). Only the spectrum of the last-clicked pixel is kept in page state — if no pixel was clicked yet (or it is still loading), this returns that hint and the user should click a pixel first.',
      parameters: {
        topN: {
          type: 'integer',
          description: `Number of peaks to return (default ${DEFAULT_TOP_N}, max ${MAX_TOP_N})`,
        },
      },
      async execute(args) {
        const n = Math.min(Math.max(args.topN ?? DEFAULT_TOP_N, 1), MAX_TOP_N)
        const ps = buildPixelSpectrumPeaks(n)
        if (!ps) {
          return 'No single-pixel spectrum loaded yet. Ask the user to click a pixel on the ion image, then call this again.'
        }
        const header = `pixel #${ps.pixel.index} (x=${ps.pixel.x}, y=${ps.pixel.y}) top peaks:`
        return [header, renderPeaks(ps.peaks)].join('\n')
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      category: 'page',
      name: 'get_annotation_top',
      description:
        'Get top annotation matches (sorted by composite evidence score descending - mass x isotope with target-decoy FDR - when available, else by |mass error|). Rows carry tokens like "L4 c=0.87 q=2% msm=0.79 ch=0.95 sp=0.91" (confidence level, composite, FDR q-value, pySM MSM, level-set chaos, isotope image correlation).',
      parameters: {
        topN: {
          type: 'integer',
          description: `Number of matches to return (default ${DEFAULT_TOP_N}, max ${MAX_TOP_N})`,
        },
      },
      async execute(args) {
        const n = Math.min(Math.max(args.topN ?? DEFAULT_TOP_N, 1), MAX_TOP_N)
        return renderAnnotations(buildAnnotationTop(n))
      },
    }),
  )

  // 单条注释的完整证据：get_annotation_top 为省字符做了精简（紧凑 token），
  // 模型深挖某一行（复核可信度/写报告）时用本工具拿全字段
  ctx.tools.register(
    defineTool({
      category: 'page',
      name: 'get_annotation_detail',
      description:
        'Get the FULL evidence for one annotation row (get_annotation_top truncates for space): ' +
        'all Tier-1 scores (mass/isotope/adduct/composite/FDR/level), Tier-2 chaos/spatial/' +
        'spectral/MSM, the same-molecule adduct group with peer m/z values and co-localization, ' +
        'all candidate names, and the theoretical isotope envelope. Identify the row by its ' +
        'matched m/z (as listed by get_annotation_top) or by rowId.',
      parameters: {
        mz: { type: 'number', description: 'Matched m/z of the row (from get_annotation_top)' },
        rowId: { type: 'integer', description: 'Row id if known (takes precedence over mz)' },
      },
      async execute(args) {
        if (args.mz == null && args.rowId == null) {
          throw new Error('Provide "mz" or "rowId" to identify the annotation row')
        }
        const data = getAnnotationData()
        if (!data || data.matchedRows.length === 0) {
          return unavailable('Annotation data')
        }
        const rows = data.matchedRows
        let row: AnnotationRow | undefined
        if (args.rowId != null) {
          row = rows.find((r) => r.id === args.rowId)
        } else {
          let best: AnnotationRow | undefined
          let bestD = Infinity
          for (const r of rows) {
            const d = Math.abs((r.matchedMz ?? r.expMz ?? NaN) - args.mz!)
            if (Number.isFinite(d) && d < bestD) {
              bestD = d
              best = r
            }
          }
          // 最近峰也不在 0.5 Da 内 → 视为没有对应注释行
          row = bestD <= 0.5 ? best : undefined
        }
        if (!row) {
          return args.rowId != null
            ? `No annotation row with rowId ${args.rowId}. Call get_annotation_top to list valid rows.`
            : `No annotation row matched near m/z ${args.mz}. Call get_annotation_top to list valid rows.`
        }
        const spatial = data.spatial?.get(row.id ?? -1) ?? null
        const peers = (row.adductPeerIds ?? [])
          .map((id) => rows.find((r) => r.id === id))
          .filter((p): p is AnnotationRow => p != null)
          .map((p) => ({ ionType: p.ionType, matchedMz: p.matchedMz, expMz: p.expMz }))
        return renderAnnotationDetail(row, spatial, peers)
      },
    }),
  )

  // ---- skill 工具 ----
  ctx.tools.register(
    defineTool({
      category: 'system',
      name: 'skill',
      description:
        'Load a domain skill by name to get detailed analysis instructions. Available skill names are listed in the system prompt.',
      parameters: {
        name: { type: 'string', required: true, description: 'Skill name from the catalog' },
      },
      async execute(args) {
        return await ctx.skills.load(args.name!)
      },
    }),
  )
}

// cordis 4：fiber 内访问兄弟服务（ctx.tools / ctx.skills）必须声明 inject，
// 否则 fiber 静默失败、工具一个都注册不上（机制同 agentLoopProvider 的 ctx.inject 包裹）。
frontendContextTools.inject = ['tools', 'skills']
