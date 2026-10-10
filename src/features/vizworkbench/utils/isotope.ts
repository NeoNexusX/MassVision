/**
 * 理论同位素包络计算（纯函数，worker 安全）。
 *
 * 底层用 cheminfo 的 `isotopic-distribution` 做自然丰度卷积；本模块只取
 * **峰间距（Δm/z）与相对强度**，丢弃其绝对 m/z——CSV 的 `formula_ion` 是
 * 离子式，直接按整式带电计算会得到"自由基阳离子"质量（比 [M+H]⁺ 少一个
 * H 原子质量），而匹配锚点必须用 CSV 自身的 `Exp. m/z`。包络内所有峰相对
 * 单同位素峰的间距与锚点偏移无关（差一个常数），因此间距 + 相对强度就是
 * 全部所需信息；多电荷（z>1）时间距除以 z。
 */

import { IsotopicDistribution } from 'isotopic-distribution'

/** 理论同位素峰：dm = 相对单同位素峰的 m/z 间距（已除以电荷），rel = 相对强度（M=1） */
export interface IsotopeEnvelopePeak {
  dm: number
  rel: number
}

/** 包络剪枝：低于该相对强度（对 M）的峰直接不返回 */
const MIN_REL = 0.01
/** 包络最多保留的峰数——对齐 pySM 参考实现的 top-4 约定
 *  （spatial_metabolomics.generate_isotope_patterns: n = min(4, len(peaks))） */
const MAX_PEAKS = 4
/** 包络计算缓存上限；CSV 内分子式大量重复，命中后为 ~0 成本 */
const CACHE_CAP = 5000

/** z=1 的原始间距缓存（formula → peaks | null）。null 也缓存（解析失败的串重复出现）。 */
const envelopeCache = new Map<string, IsotopeEnvelopePeak[] | null>()

/**
 * 从加合物/离子类型串解析电荷数。识别常见写法：
 * `[M+2H]2+`、`[M-H]-`、`[M+H]+`、`M-H`、`[2M+Na]+`（前系数是聚合度，不影响电荷）。
 * 无法识别时返回 1（绝大多数 s2fmt 库都是单电荷）。
 */
export function chargeFromIonType(ionType: string | null | undefined): number {
  if (!ionType) return 1
  // 形如 `2+` / `2-` 的电荷数字（可在末尾或方括号后），`+`/`-` 单独出现按 1
  const m = /(\d*)[+-]\s*$/.exec(ionType.trim())
  if (!m) return 1
  const n = m[1] ? Number(m[1]) : 1
  return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 1
}

/** 计算 z=1 原始包络（内部，带缓存）。null = 分子式不可解析或含未知元素。 */
function rawEnvelope(formulaIon: string): IsotopeEnvelopePeak[] | null {
  const cached = envelopeCache.get(formulaIon)
  if (cached !== undefined) return cached
  let result: IsotopeEnvelopePeak[] | null = null
  try {
    const dist = new IsotopicDistribution(formulaIon, {
      threshold: MIN_REL,
      limit: MAX_PEAKS,
    })
    dist.getDistribution()
    const points = dist.getParts()[0]?.isotopicDistribution
    if (points && points.length > 0 && points[0]!.y > 0) {
      const y0 = points[0]!.y
      const x0 = points[0]!.x
      result = points
        .map((p) => ({ dm: p.x - x0, rel: p.y / y0 }))
        .filter((p) => p.rel >= MIN_REL && p.dm >= 0)
        .slice(0, MAX_PEAKS)
      if (result.length === 0) result = [{ dm: 0, rel: 1 }]
    }
  } catch {
    result = null
  }
  if (envelopeCache.size >= CACHE_CAP) envelopeCache.clear()
  envelopeCache.set(formulaIon, result)
  return result
}

/**
 * 理论同位素包络（峰间距 + 相对强度），M 的 dm=0、rel=1 恒在首位。
 *
 * @param formulaIon 离子式（如 `C40H66O5`，可带 +/- 电荷后缀）
 * @param charge 电荷数（间距除以 z），默认 1
 * @returns 峰数组（M 起按 dm 升序，≤5 个）或 null（不可解析/未知元素/无有效峰）
 */
export function isotopeEnvelope(
  formulaIon: string | null | undefined,
  charge = 1,
): IsotopeEnvelopePeak[] | null {
  if (!formulaIon) return null
  const raw = rawEnvelope(formulaIon.trim())
  if (!raw) return null
  const z = charge >= 1 ? charge : 1
  if (z === 1) return raw
  return raw.map((p) => ({ dm: p.dm / z, rel: p.rel }))
}
