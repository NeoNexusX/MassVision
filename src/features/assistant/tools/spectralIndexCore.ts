/**
 * 谱库检索核心（纯函数，无 DOM/Worker 依赖）。
 *
 * spectralTools.ts（工具插件 + 无 Worker API 时的主线程兜底）与
 * spectralIndex.worker.ts（生产路径）共用：33MB 索引的 fetch + JSON.parse
 * 在 worker 里做（主线程不冻结、87k 条解析对象不进主堆），两边跑的必须是
 * 同一份检索/排序/格式化逻辑——放这里一份，别再抄。
 */

/** 谱库条目（索引 JSON 的紧凑形态） */
export interface SpectralLibEntry {
  /** MassBank accession（如 MSBNK-RIKEN-RI PR100043 简化为无空格 id） */
  a: string
  /** 化合物名 */
  n: string
  /** 分子式 */
  f: string | null
  /** 离子模式 */
  mode: 'positive' | 'negative'
  /** 前驱体 m/z（无则 null） */
  mz: number | null
  /** 仪器类型（LC-ESI-QTOF 等） */
  ins: string | null
  /** 参考谱峰 [mz, 相对强度]，按 m/z 升序 */
  pk: number[][]
}

/** 索引缺失时的部署提示（worker 与主线程兜底共用） */
export function spectralIndexNotFound(status: number): string {
  return (
    'MassBank offline index not found in this deployment (needs public/data/massbank-index.json).' +
    ' Build it with: node scripts/build-massbank-index.mjs, then redeploy.' +
    (status !== 404 ? ` (HTTP ${status})` : '')
  )
}

/** 解析用户/模型提供的峰列表："123.4:100, 125.2:55" 或 JSON [[mz,int],...] */
export function parsePeakList(s: string): { mz: number; intensity: number }[] {
  const out: { mz: number; intensity: number }[] = []
  for (const part of s.split(/[,;\n]/)) {
    const m = part.trim().match(/^(\d+(?:\.\d+)?)\s*[:\s]\s*(\d+(?:\.\d+)?)$/)
    if (m) out.push({ mz: Number(m[1]), intensity: Number(m[2]) })
  }
  return out
}

/** 库谱 vs 实测峰的共有峰计数（±0.5 Da 窗口，实测峰取窗口内库峰最强匹配） */
export function matchedPeakCount(
  libPeaks: number[][],
  query: { mz: number; intensity: number }[],
  windowDa = 0.5,
): { matched: number; libTotal: number; queryTotal: number } {
  let matched = 0
  for (const [mz] of libPeaks) {
    if (mz == null) continue
    if (query.some((q) => Math.abs(q.mz - mz) <= windowDa)) matched++
  }
  return { matched, libTotal: libPeaks.length, queryTotal: query.length }
}

/**
 * 前驱体 ± ppm 检索谱库；提供实测峰时按共有峰数排序，否则按 |Δppm|。
 * 纯函数：索引由调用方给（worker 里加载或主线程兜底加载）。
 */
export function searchSpectralIndex(
  index: SpectralLibEntry[],
  precursorMz: number,
  tolerancePpm: number,
  polarity: 'positive' | 'negative' | null,
  peaks: { mz: number; intensity: number }[],
  max: number,
): string {
  const window = (precursorMz * tolerancePpm) / 1e6
  const cands = index.filter(
    (e) =>
      e.mz != null &&
      Math.abs(e.mz - precursorMz) <= window &&
      (polarity == null || e.mode === polarity),
  )
  if (cands.length === 0) {
    return (
      `No reference spectra match precursor m/z ${precursorMz} within ${tolerancePpm} ppm` +
      `${polarity ? ` (${polarity})` : ''}. Consider widening the tolerance.`
    )
  }

  const scored = cands.map((e) => {
    const ppm = e.mz != null ? ((e.mz - precursorMz) / precursorMz) * 1e6 : 0
    const mp = peaks.length > 0 ? matchedPeakCount(e.pk, peaks) : null
    return { e, ppm, mp }
  })
  scored.sort((a, b) => {
    // 有峰列表时：共有峰数优先（归一到库峰数，避免长谱占便宜）
    if (a.mp && b.mp) {
      const ra = a.mp.matched / Math.max(1, Math.min(a.mp.libTotal, a.mp.queryTotal))
      const rb = b.mp.matched / Math.max(1, Math.min(b.mp.libTotal, b.mp.queryTotal))
      if (rb !== ra) return rb - ra
    }
    return Math.abs(a.ppm) - Math.abs(b.ppm)
  })

  const lines = [
    `precursor m/z ${precursorMz} (${tolerancePpm} ppm window) — ${cands.length} reference spectra, top ${Math.min(max, scored.length)}:`,
  ]
  for (const s of scored.slice(0, max)) {
    const e = s.e
    const parts = [`- ${e.n} | ${e.f ?? '?'} | ${e.mode} | Δ${s.ppm.toFixed(1)} ppm`]
    if (e.ins) parts.push(`| ${e.ins}`)
    if (s.mp) parts.push(`| peaks ${s.mp.matched}/${s.mp.libTotal} matched`)
    parts.push(`\n  record: https://massbank.eu/MassBank/Record?id=${encodeURIComponent(e.a)}`)
    lines.push(parts.join(' '))
  }
  lines.push('source: MassBank (local offline index; https://massbank.eu, doi:10.1002/jms.1777)')
  return lines.join('\n')
}
