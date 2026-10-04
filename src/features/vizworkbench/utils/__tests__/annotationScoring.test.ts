import { describe, it, expect } from 'vitest'
import {
  massScoreOf,
  isotopeScoreOf,
  parseAdduct,
  neutralMassOf,
  IMPLAUSIBLE_ADDUCTS,
  assignFdr,
  scoreRows,
  applyAdductBonus,
  applyAdductConfirmation,
  applyAdductGroupConfirmation,
  ANNOTATION_SCORING,
} from '../annotationScoring'
import { matchAnnotations, type MatchedAnnotationRow } from '../csvAnnotation'
import { ELECTRON_MASS } from 'chemical-elements'

// ---- 测试件 ---------------------------------------------------------------

let nextId = 0
/** 构造一个已匹配的折叠行（其余字段走默认）。 */
function matchedRow(p: Partial<MatchedAnnotationRow>): MatchedAnnotationRow {
  return {
    id: nextId++,
    candidates: [p.name ?? 'Test'],
    name: p.name ?? 'Test',
    formulaIon: null,
    ionType: '[M+H]+',
    expMz: 500,
    valid: true,
    matchStatus: 'matched',
    matchedMz: 500,
    matchedIndex: 0,
    massError: 0,
    avgIntensity: 100,
    altFormulas: [],
    altAdducts: [],
    massScore: null,
    isotopeScore: null,
    isotopeObsCount: null,
    isotopeExpCount: null,
    compositeScore: null,
    fdr: null,
    level: null,
    adductScore: null,
    adductPeers: [],
    adductPeerIds: [],
    ...p,
  }
}

/** 中性质量 → 指定加合物下的离子 m/z（neutralMassOf 的逆，测试造数用）。
 *  聚合加合（[2M-H]-）含 nmol 个分子，中性项要乘回。 */
function ionMzOf(neutral: number, ionType: string): number {
  const a = parseAdduct(ionType)!
  return (neutral * a.nmol + a.deltaSum - a.z * ELECTRON_MASS) / Math.abs(a.z)
}

/** 细网格 m/z 轴 + 可控峰强度的平均谱。 */
function buildSpectrum(
  from: number,
  to: number,
  step: number,
  peaks: [mz: number, intensity: number][],
): { axis: Float64Array; mean: Float32Array } {
  const n = Math.floor((to - from) / step) + 1
  const axis = new Float64Array(n)
  for (let i = 0; i < n; i++) axis[i] = from + i * step
  const mean = new Float32Array(n)
  for (const [mz, v] of peaks) {
    const i = Math.round((mz - from) / step)
    mean[i] = v
  }
  return { axis, mean }
}

// ---- massScoreOf -----------------------------------------------------------

describe('massScoreOf', () => {
  it('decays linearly with the error', () => {
    expect(massScoreOf(0, 10)).toBe(1)
    expect(massScoreOf(10, 10)).toBe(0)
    expect(massScoreOf(5, 10)).toBe(0.5)
  })

  it('returns null for unusable inputs', () => {
    expect(massScoreOf(null, 10)).toBeNull()
    expect(massScoreOf(Number.NaN, 10)).toBeNull()
    expect(massScoreOf(1, 0)).toBeNull()
    expect(massScoreOf(1, -1)).toBeNull()
  })
})

// ---- isotopeScoreOf --------------------------------------------------------

describe('isotopeScoreOf (pySM isotope_pattern_match 参考公式)', () => {
  const TOL = 10
  const M = 600

  it('scores a cholesterol-consistent envelope high', () => {
    // C27H46O 理论 M+1 ≈ 30%、M+2 ≈ 3.3%（都在 top-4 包络内）
    const { axis, mean } = buildSpectrum(M - 1, M + 4, 0.0005, [
      [M, 1000],
      [M + 1.00336, 298],
      [M + 2.00671, 33],
    ])
    const r = isotopeScoreOf(axis, mean, M, 'C27H46O', 1, TOL, 'ppm')
    expect(r.score).not.toBeNull()
    expect(r.score!).toBeGreaterThan(0.95)
    expect(r.obsCount).toBe(3)
    expect(r.expectedCount).toBe(3)
  })

  it('orders perfect > halved > absent (reference L1-on-L2-norm magnitudes)', () => {
    const perfect = buildSpectrum(M - 1, M + 4, 0.0005, [
      [M, 1000],
      [M + 1.00336, 298],
      [M + 2.00671, 33],
    ])
    const halved = buildSpectrum(M - 1, M + 4, 0.0005, [
      [M, 1000],
      [M + 1.00336, 150],
      [M + 2.00671, 33],
    ])
    const absent = buildSpectrum(M - 1, M + 4, 0.0005, [[M, 1000]])
    const s0 = isotopeScoreOf(perfect.axis, perfect.mean, M, 'C27H46O', 1, TOL, 'ppm').score!
    const s1 = isotopeScoreOf(halved.axis, halved.mean, M, 'C27H46O', 1, TOL, 'ppm').score!
    const s2 = isotopeScoreOf(absent.axis, absent.mean, M, 'C27H46O', 1, TOL, 'ppm').score!
    expect(s0).toBeGreaterThan(0.95)
    expect(s1).toBeLessThan(s0)
    expect(s2).toBeLessThan(s1)
    // 参考公式的宽容性：完全缺 M+1 也只降到 ~0.84（真实区分靠 ρ_spatial）
    expect(s2).toBeGreaterThan(0.8)
  })

  it('punishes an over-strong satellite strongly', () => {
    const tenx = buildSpectrum(M - 1, M + 4, 0.0005, [
      [M, 1000],
      [M + 1.00336, 2980],
    ])
    const s = isotopeScoreOf(tenx.axis, tenx.mean, M, 'C27H46O', 1, TOL, 'ppm').score!
    expect(s).toBeLessThan(0.6)
  })

  it('counts obsCount against the 1% floor of observed M', () => {
    // M+2 峰缺失 → obsCount 2 < expected 3（Level 4 的"峰全观测"条件不满足）
    const { axis, mean } = buildSpectrum(M - 1, M + 4, 0.0005, [
      [M, 1000],
      [M + 1.00336, 298],
    ])
    const r = isotopeScoreOf(axis, mean, M, 'C27H46O', 1, TOL, 'ppm')
    expect(r.obsCount).toBe(2)
    expect(r.expectedCount).toBe(3)
  })

  it('returns null for missing formula / spectrum', () => {
    const { axis, mean } = buildSpectrum(M - 1, M + 4, 0.0005, [[M, 1000]])
    expect(isotopeScoreOf(axis, mean, M, null, 1, TOL, 'ppm').score).toBeNull()
    expect(isotopeScoreOf(axis, null, M, 'C27H46O', 1, TOL, 'ppm').score).toBeNull()
    expect(isotopeScoreOf(null, mean, M, 'C27H46O', 1, TOL, 'ppm').score).toBeNull()
    expect(isotopeScoreOf(axis, mean, M, 'garbage', 1, TOL, 'ppm').score).toBeNull()
  })

  it('scores 0 when M itself is not observed', () => {
    const { axis, mean } = buildSpectrum(M - 1, M + 4, 0.0005, [[M + 1.00336, 298]])
    const r = isotopeScoreOf(axis, mean, M, 'C27H46O', 1, TOL, 'ppm')
    expect(r.score).toBe(0)
    expect(r.obsCount).toBe(0)
  })
})

// ---- parseAdduct / neutralMassOf / decoys -----------------------------------

describe('parseAdduct', () => {
  it('parses common positive adducts', () => {
    const h = parseAdduct('[M+H]+')!
    expect(h.z).toBe(1)
    expect(h.polarity).toBe('positive')
    expect(h.deltaSum).toBeCloseTo(1.00782503223, 6)
    const na = parseAdduct('[M+Na]+')!
    expect(na.deltaSum).toBeCloseTo(22.989769282, 6)
    expect(parseAdduct('[M+2H]2+')!.z).toBe(2)
    expect(parseAdduct('[2M+Na]+')!.deltaSum).toBeCloseTo(22.989769282, 6)
    // 无尾符号的正加合：按阳离子规则推断
    expect(parseAdduct('M+H')!.polarity).toBe('positive')
  })

  it('parses negative adducts including bare M-H', () => {
    const h = parseAdduct('M-H')!
    expect(h.polarity).toBe('negative')
    expect(h.z).toBe(-1)
    expect(h.deltaSum).toBeCloseTo(-1.00782503223, 6)
    const cl = parseAdduct('[M+Cl]-')!
    expect(cl.polarity).toBe('negative')
    expect(cl.deltaSum).toBeCloseTo(34.968852682, 5)
    expect(parseAdduct('[M+HCOO]-')!.polarity).toBe('negative')
    expect(parseAdduct('[M+OAc]-')!.deltaSum).toBeCloseTo(59.013304, 4)
  })

  it('handles neutral losses and returns null for garbage', () => {
    const p = parseAdduct('[M+H-H2O]+')!
    expect(p.polarity).toBe('positive')
    expect(p.deltaSum).toBeCloseTo(1.00782503223 - 18.010564684, 5)
    expect(parseAdduct('garbage')).toBeNull()
    expect(parseAdduct('')).toBeNull()
    expect(parseAdduct(null)).toBeNull()
    expect(parseAdduct('[M+Xx]+')).toBeNull()
  })
})

describe('neutralMassOf', () => {
  it('inverts [M+H]+ and M-H correctly (electron mass included)', () => {
    const h = parseAdduct('[M+H]+')!
    expect(neutralMassOf(627.498302, h)).toBeCloseTo(626.491026, 4)
    const d = parseAdduct('M-H')!
    expect(neutralMassOf(87.0091, d)).toBeCloseTo(88.016376, 4)
  })

  it('divides aggregation adducts back to per-molecule neutral mass (nmol)', () => {
    // python 参考 _neutral_mass：( |z|·mz − massdiff ) / nmol。
    // 不除 nmol 时 [2M-H]- 算出 2M，永远无法与同分子的 [M-H]- 聚簇。
    const d = parseAdduct('[2M-H]-')!
    expect(d.nmol).toBe(2)
    const M = 256.240231 // 棕榈酸
    expect(neutralMassOf(ionMzOf(M, '[2M-H]-'), d)).toBeCloseTo(M, 6)
    expect(neutralMassOf(ionMzOf(M, '[2M+Na]+'), parseAdduct('[2M+Na]+')!)).toBeCloseTo(M, 6)
    // 普通加合物 nmol=1，行为不变
    expect(parseAdduct('[M+H]+')!.nmol).toBe(1)
    expect(parseAdduct('M-H')!.nmol).toBe(1)
  })
})

describe('IMPLAUSIBLE_ADDUCTS', () => {
  it('deltas are atom mass ± electron', () => {
    expect(IMPLAUSIBLE_ADDUCTS.positive[0]!.delta).toBeCloseTo(54.937496, 5) // Mn − e
    expect(IMPLAUSIBLE_ADDUCTS.negative[0]!.delta).toBeCloseTo(54.938594, 5) // Mn + e
  })
})

// ---- scoreRows + assignFdr ---------------------------------------------------

describe('scoreRows', () => {
  it('fills Tier-1 fields on matched rows and nulls everything else', () => {
    const { axis, mean } = buildSpectrum(599, 604, 0.0005, [
      [600, 1000],
      [600 + 1.00336, 298],
      [600 + 2.00671, 33],
    ])
    const rows = [
      matchedRow({ id: 1, expMz: 600, formulaIon: 'C27H46O', massError: 0 }),
      // 无分子式：isotopeScore null，composite 按 compositeIsoDefault 折算（level 5）
      matchedRow({ id: 2, expMz: 600, formulaIon: null, massError: 8.33 }),
      matchedRow({
        id: 3,
        expMz: 500,
        matchStatus: 'unmatched',
        matchedMz: null,
        matchedIndex: null,
        massError: null,
      }),
    ]
    scoreRows(rows, { mzAxis: axis, meanIntensity: mean, tolerance: 10, mode: 'ppm' })
    expect(rows[0]!.massScore).toBe(1)
    expect(rows[0]!.isotopeScore!).toBeGreaterThan(0.95)
    expect(rows[0]!.compositeScore).toBeCloseTo(rows[0]!.isotopeScore!, 2)
    // L4：iso ≥ 0.9 且期望峰（M/M+1/M+2）全部观测到
    expect(rows[0]!.level).toBe(4)
    expect(rows[1]!.massScore).toBeCloseTo(1 - 8.33 / 10, 3)
    expect(rows[1]!.isotopeScore).toBeNull()
    // iso null 按 compositeIsoDefault 0.7 折算（见 scoreRows 注释）
    expect(rows[1]!.compositeScore).toBeCloseTo((1 - 8.33 / 10) * 0.7, 3)
    expect(rows[1]!.level).toBe(5)
    for (const f of ['massScore', 'isotopeScore', 'compositeScore', 'fdr', 'level'] as const) {
      expect(rows[2]![f]).toBeNull()
    }
  })
})

describe('assignFdr', () => {
  const TOL = 10 // ppm
  /**
   * 稀疏峰位轴（centroid 语义：轴 = 峰位列表，非稠密网格）。5 个 target 的
   * 质量误差 0/2/4/6/8 ppm（composite = 1/.8/.6/.4/.2，分子式 null 无同位素
   * 证据）；只给前 3 个 target 的 Mn decoy 摆峰，误差 4/6/8 ppm（decoy 分数
   * .6/.4/.2），Co decoy 与后两个 Mn decoy 无峰不匹配。
   */
  function scenario() {
    const mn = IMPLAUSIBLE_ADDUCTS.positive[0]!.delta
    const peaks: [number, number][] = []
    const targetMz: number[] = []
    for (let k = 0; k < 5; k++) {
      const base = 300 + k * 40
      const expMz = base * (1 - k * 2 * 1e-6) // 误差 k·2 ppm
      targetMz.push(expMz)
      peaks.push([base, 1000])
      if (k < 3) {
        const decoyTrueMz = expMz - 1.007276 + mn
        const decoyPeak = decoyTrueMz * (1 + (2 + k * 2) * 1e-6) // 误差 4/6/8 ppm
        peaks.push([decoyPeak, 1000])
      }
    }
    peaks.sort((a, b) => a[0] - b[0])
    const axis = new Float64Array(peaks.map((p) => p[0]))
    const mean = new Float32Array(peaks.map((p) => p[1]))
    const rows = targetMz.map((mz, i) =>
      matchedRow({
        id: i,
        expMz: mz,
        ionType: '[M+H]+',
        formulaIon: null,
        matchStatus: 'unmatched',
        matchedMz: null,
        matchedIndex: null,
        massError: null,
      }),
    )
    return { axis, mean, rows }
  }

  it('assigns monotone q-values with the 1/nD floor', () => {
    const { axis, mean, rows } = scenario()
    const inputs = { mzAxis: axis, meanIntensity: mean, tolerance: TOL, mode: 'ppm' as const }
    // 走真实管线语义：先匹配出 matchedMz/massError，再打分 + FDR
    const matched = matchAnnotations(rows, axis, mean, TOL, 'ppm')
    scoreRows(matched, inputs)
    const stats = assignFdr(matched, inputs, 'positive')
    expect(stats).not.toBeNull()
    expect(stats!.targetsScored).toBe(5)
    expect(stats!.decoysScored).toBe(3)

    // composite = 1/.75/.5/.25/0；q 期望 [1/3, 1/3, 5/9, 5/6, 1]（手算：
    // decoy≥s 计数 0/0/1/2/3，scale = 5/3，尾部前缀最小 + 1/3 下限）
    const sorted = [...matched].sort((a, b) => b.compositeScore! - a.compositeScore!)
    const qs = sorted.map((r) => r.fdr!)
    expect(qs[0]!).toBeCloseTo(1 / 3, 2)
    expect(qs[1]!).toBeCloseTo(1 / 3, 2)
    expect(qs[2]!).toBeCloseTo(5 / 9, 2)
    expect(qs[3]!).toBeCloseTo(5 / 6, 2)
    expect(qs[4]!).toBeCloseTo(1, 2)
    for (let i = 1; i < qs.length; i++) expect(qs[i]!).toBeGreaterThanOrEqual(qs[i - 1]! - 1e-9)
  })

  it('returns null without decoys or targets and leaves fdr null', () => {
    const axis = new Float64Array([500])
    const mean = new Float32Array([100])
    const rows = [matchedRow({ id: 0, expMz: 500, formulaIon: null })]
    scoreRows(rows, { mzAxis: axis, meanIntensity: mean, tolerance: 10, mode: 'ppm' })
    // 没有任何 decoy 峰 → nD=0 → null，fdr 保持 null
    expect(
      assignFdr(
        rows,
        { mzAxis: axis, meanIntensity: mean, tolerance: 10, mode: 'ppm' },
        'positive',
      ),
    ).toBeNull()
    expect(rows[0]!.fdr).toBeNull()
  })

  it('returns null when the axis is missing', () => {
    const rows = [matchedRow({ id: 0 })]
    expect(assignFdr(rows, { tolerance: 10, mode: 'ppm' }, null)).toBeNull()
  })
})

// ---- applyAdductBonus（多加合物证据，CAMERA adduct_filter 移植）-----------

describe('applyAdductBonus', () => {
  const N = 600 // 中性质量

  /** 同分子（C27H46O）多加合物行：各加合物按精确离子 m/z 匹配到不同峰 */
  function groupRow(id: number, ionType: string, matchedIndex: number): MatchedAnnotationRow {
    const mz = ionMzOf(N, ionType)
    return matchedRow({
      id,
      formulaIon: 'C27H46O',
      ionType,
      expMz: mz,
      matchedMz: mz,
      matchedIndex,
      compositeScore: 0.5, // 打分已完成（FDR 之后）的基线
    })
  }

  it('two primary adducts on distinct peaks: adductScore 0.5, composite ×1.1', () => {
    const rows = [groupRow(1, '[M+H]+', 10), groupRow(2, '[M+Na]+', 20)]
    applyAdductBonus(rows)
    expect(rows[0]!.adductScore).toBeCloseTo(0.5, 6)
    expect(rows[1]!.adductScore).toBeCloseTo(0.5, 6)
    expect(rows[0]!.adductPeers).toEqual(['[M+Na]+'])
    expect(rows[0]!.adductPeerIds).toEqual([2])
    expect(rows[1]!.adductPeers).toEqual(['[M+H]+'])
    expect(rows[0]!.compositeScore).toBeCloseTo(0.5 * (1 + 0.2 * 0.5), 6)
    expect(rows[1]!.compositeScore).toBeCloseTo(0.5 * (1 + 0.2 * 0.5), 6)
  })

  it('three primary adducts: adductScore capped at 1, composite ×1.2', () => {
    const rows = [
      groupRow(1, '[M+H]+', 10),
      groupRow(2, '[M+Na]+', 20),
      groupRow(3, '[M+K]+', 30),
    ]
    applyAdductBonus(rows)
    for (const r of rows) {
      expect(r.adductScore).toBeCloseTo(1, 6)
      expect(r.compositeScore).toBeCloseTo(0.5 * 1.2, 6)
      expect(r.adductPeerIds).toHaveLength(2)
    }
  })

  it('secondary adduct scales Σips: [M-H]- + [M-2H+Na]- → 0.25', () => {
    const rows = [groupRow(1, '[M-H]-', 10), groupRow(2, '[M-2H+Na]-', 20)]
    applyAdductBonus(rows)
    expect(rows[0]!.adductScore).toBeCloseTo(0.25, 6)
  })

  it('dimer adduct clusters with its monomer ([2M-H]- + [M-H]- → 0.25)', () => {
    // nmol 除法 + core 保留聚合度系数，二者缺一：二聚体算出 2M 聚不进同组，
    // 或被组内 core 去重吞掉——都拿不到多加合物加分
    const rows = [groupRow(1, '[M-H]-', 10), groupRow(2, '[2M-H]-', 20)]
    applyAdductBonus(rows)
    expect(rows[0]!.adductScore).toBeCloseTo(0.25, 6) // 1.0(quasi) + 0.5(二聚体规则) → (1.5−1)/2
    expect(rows[1]!.adductScore).toBeCloseTo(0.25, 6)
    expect(rows[0]!.adductPeers).toEqual(['[2M-H]-'])
    expect(rows[1]!.adductPeers).toEqual(['[M-H]-'])
  })

  it('off-table metal adduct joins no group (closed rule table, as the reference)', () => {
    // 参考实现只在 PRIMARY 规则表上建立加合物组假设：[M+Fe]+ 这类表外金属
    // 加合物即使中性质量与真 [M+H]+ 行一致，也不得贡献 ips / 搭 quasi 便车
    const rows = [groupRow(1, '[M+H]+', 10), groupRow(2, '[M+Fe]+', 20)]
    applyAdductBonus(rows)
    expect(rows[0]!.adductScore).toBeNull()
    expect(rows[1]!.adductScore).toBeNull()
    expect(rows[0]!.adductPeerIds).toEqual([])
    expect(rows[0]!.compositeScore).toBeCloseTo(0.5, 6)
  })

  it('non-quasi-only pair gets no bonus (require_quasi gate)', () => {
    const rows = [groupRow(1, '[M-2H+Na]-', 10), groupRow(2, '[M-2H+K]-', 20)]
    applyAdductBonus(rows)
    expect(rows[0]!.adductScore).toBeNull()
    expect(rows[0]!.compositeScore).toBeCloseTo(0.5, 6)
  })

  it('same-peak collision voids the group', () => {
    // 两种加合物挤进同一容差窗（同 matchedIndex）→ 不是独立谱峰证据
    const rows = [groupRow(1, '[M+H]+', 10), groupRow(2, '[M+Na]+', 10)]
    applyAdductBonus(rows)
    expect(rows[0]!.adductScore).toBeNull()
  })

  it('different formulas never group even at the same neutral mass', () => {
    const a = groupRow(1, '[M+H]+', 10)
    a.formulaIon = 'C27H46O'
    const b = groupRow(2, '[M+Na]+', 20)
    b.formulaIon = 'C28H48O2'
    applyAdductBonus([a, b])
    expect(a.adductScore).toBeNull()
    expect(b.adductScore).toBeNull()
  })

  it('formula-less rows fall back to neutral-mass clustering', () => {
    const a = groupRow(1, '[M+H]+', 10)
    a.formulaIon = null
    const b = groupRow(2, '[M+Na]+', 20)
    b.formulaIon = null
    applyAdductBonus([a, b])
    expect(a.adductScore).toBeCloseTo(0.5, 6)
    expect(b.adductScore).toBeCloseTo(0.5, 6)
  })

  it('cluster cut follows the reference ppm=5 hyperparameter, not the panel tolerance (A1)', () => {
    // 无分子式行按中性质量聚类：切割高度 = 2·5e-6·M + 0.015。M≈600 时
    // cut ≈ 0.021 Da——中性质量差 0.03 Da 的两行不该聚为「同分子」。
    // （回归：旧实现把面板容差当切割容差，面板 20ppm 时差 ~40mDa 的
    // 不同分子会互相授予加成。）
    const a = groupRow(1, '[M+H]+', 10)
    a.formulaIon = null
    a.matchedMz = N + 1.007276 // 中性 600.0
    const b = groupRow(2, '[M+Na]+', 20)
    b.formulaIon = null
    b.matchedMz = N + 0.03 + 22.989218 // 中性 600.03（超出 0.021 的切割）
    applyAdductBonus([a, b])
    expect(a.adductScore).toBeNull()
    expect(b.adductScore).toBeNull()

    // 差 0.01 Da（切割内）→ 聚为一组，加分生效
    const c = groupRow(3, '[M+H]+', 30)
    c.formulaIon = null
    c.matchedMz = N + 1.007276
    const d = groupRow(4, '[M+Na]+', 40)
    d.formulaIon = null
    d.matchedMz = N + 0.01 + 22.989218
    applyAdductBonus([c, d])
    expect(c.adductScore).toBeCloseTo(0.5, 6)
    expect(d.adductScore).toBeCloseTo(0.5, 6)
  })

  it('cross-group Σips competition drops the lower-scoring group sharing a peak (checkIps, A3)', () => {
    // F1（Σips 3.0：H/Na/K 三种一级）与 F2（Σips 2.0：H/Na）共享峰 p0
    // —— 同一实测峰不得同时充当两个分子的独立佐证，F2 整组弃权
    const f1 = [
      groupRow(1, '[M+H]+', 0),
      groupRow(2, '[M+Na]+', 20),
      groupRow(3, '[M+K]+', 30),
    ]
    for (const r of f1) r.formulaIon = 'C27H46O'
    const f2 = [groupRow(4, '[M+Na]+', 0), groupRow(5, '[M+H]+', 50)]
    for (const r of f2) r.formulaIon = 'C28H48O2'
    applyAdductBonus([...f1, ...f2])
    for (const r of f1) {
      expect(r.adductScore).toBeCloseTo(1, 6) // Σips 3 → min(1,(3−1)/2)
    }
    for (const r of f2) {
      expect(r.adductScore).toBeNull() // Σips 2 < 3 且共享峰 0 → 弃权
      expect(r.compositeScore).toBeCloseTo(0.5, 6)
    }
  })

  it('keeps fdr computed on the un-boosted composite', () => {
    // 两个 target（同分子 H/Na 两种加合物，各自命中）+ 一个可匹配的 Mn
    // decoy 峰：q 值按加成前的基础分计算，加成后不得漂移
    const mzH = ionMzOf(N, '[M+H]+')
    const mzNa = ionMzOf(N, '[M+Na]+')
    const decoyMz = N + IMPLAUSIBLE_ADDUCTS.positive[0]!.delta
    const peaks = [mzH, mzNa, decoyMz].sort((x, y) => x - y)
    const axis = new Float64Array(peaks)
    const mean = new Float32Array([1000, 1000, 1000])
    const rows = [
      matchedRow({ id: 1, formulaIon: 'C27H46O', expMz: mzH }),
      matchedRow({
        id: 2,
        formulaIon: 'C27H46O',
        ionType: '[M+Na]+',
        expMz: mzNa,
      }),
    ]
    const matched = matchAnnotations(rows, axis, mean, 10, 'ppm')
    expect(matched[0]!.matchStatus).toBe('matched')
    expect(matched[1]!.matchStatus).toBe('matched')
    const inputs = { mzAxis: axis, meanIntensity: mean, tolerance: 10, mode: 'ppm' as const }
    scoreRows(matched, inputs)
    assignFdr(matched, inputs, 'positive')
    const fdrBefore = [...matched.map((r) => r.fdr)]
    const compositeBefore = [...matched.map((r) => r.compositeScore)]
    applyAdductBonus(matched)
    // 加成生效（composite 提升）且 FDR 保持基础分口径
    expect(matched[0]!.adductScore).toBeCloseTo(0.5, 6)
    expect(matched[0]!.compositeScore!).toBeGreaterThan(compositeBefore[0]!)
    for (let i = 0; i < matched.length; i++) {
      expect(matched[i]!.fdr).toBe(fdrBefore[i])
    }
  })
})

// ---- applyAdductConfirmation（Tier-2 空间确认回馈）-------------------------

describe('applyAdductConfirmation', () => {
  /** 已获多加合物加分的行：adductScore 0.5、composite 已 ×1.1 */
  function boostedRow(): MatchedAnnotationRow {
    const row = matchedRow({ id: 1 })
    row.adductScore = 0.5
    row.adductPeers = ['[M+Na]+']
    row.adductPeerIds = [2]
    row.compositeScore = 0.5 * (1 + ANNOTATION_SCORING.adductBonusWeight * 0.5)
    return row
  }

  it('corr >= 0.7 confirms: bonus kept, flagged, not revoked', () => {
    const row = boostedRow()
    const composite = row.compositeScore
    expect(applyAdductConfirmation(row, 0.83)).toBe(false)
    expect(row.adductConfirmed).toBe(true)
    expect(row.adductScore).toBeCloseTo(0.5, 6)
    expect(row.compositeScore).toBe(composite)
  })

  it('corr < 0.7 revokes: composite divided back, score zeroed, flagged', () => {
    const row = boostedRow()
    expect(applyAdductConfirmation(row, 0.31)).toBe(true)
    expect(row.adductUnconfirmed).toBe(true)
    expect(row.adductScore).toBe(0)
    expect(row.compositeScore).toBeCloseTo(0.5, 6) // ÷ (1 + 0.2·0.5) 回到基线
  })

  it('null corr (unmeasured) is not counter-evidence: no change', () => {
    const row = boostedRow()
    expect(applyAdductConfirmation(row, null)).toBe(false)
    expect(row.adductScore).toBeCloseTo(0.5, 6)
    expect(row.adductUnconfirmed).toBeUndefined()
  })

  it('is idempotent after revocation', () => {
    const row = boostedRow()
    applyAdductConfirmation(row, 0.1)
    const after = row.compositeScore
    expect(applyAdductConfirmation(row, 0.05)).toBe(false)
    expect(row.compositeScore).toBe(after)
    expect(row.adductScore).toBe(0)
  })

  it('rows without a bonus are untouched', () => {
    const row = matchedRow({ id: 1 })
    expect(applyAdductConfirmation(row, 0.1)).toBe(false)
    expect(row.adductUnconfirmed).toBeUndefined()
  })
})

// ---- applyAdductGroupConfirmation（Tier-2 组级确认：连通分量语义）--------

describe('applyAdductGroupConfirmation', () => {
  /** 带加成的成员行（ionType 决定 quasi/加合核心） */
  function memberRow(id: number, ionType: string): MatchedAnnotationRow {
    const row = matchedRow({ id, ionType })
    row.adductScore = 0.5
    row.compositeScore = 0.5 * (1 + ANNOTATION_SCORING.adductBonusWeight * 0.5)
    return row
  }

  it('re-checks require_quasi per connected component (reference semantics)', () => {
    // 组 {[M-H]-, [M-2H+Na]-, [M-2H+K]-}：H-Na 0.1 / H-K 0.1 / Na-K 0.9。
    // 逐行最大 Pearson 会让 Na/K（0.9）过线保留加成；分量语义下 {Na,K}
    // 无 quasi 成员整段撤销，H 孤立且测过 → 反证撤销——与 Python 一致
    const rows = [
      memberRow(1, '[M-H]-'),
      memberRow(2, '[M-2H+Na]-'),
      memberRow(3, '[M-2H+K]-'),
    ]
    const m = [
      [null, 0.1, 0.1],
      [0.1, null, 0.9],
      [0.1, 0.9, null],
    ]
    expect(applyAdductGroupConfirmation(rows, m)).toBe(true)
    for (const r of rows) {
      expect(r.adductScore).toBe(0)
      expect(r.adductUnconfirmed).toBe(true)
      expect(r.compositeScore).toBeCloseTo(0.5, 6)
    }
  })

  it('quasi member connected by a passing edge confirms the component', () => {
    const rows = [memberRow(1, '[M-H]-'), memberRow(2, '[M-2H+Na]-')]
    const m = [
      [null, 0.8],
      [0.8, null],
    ]
    expect(applyAdductGroupConfirmation(rows, m)).toBe(false)
    expect(rows[0]!.adductConfirmed).toBe(true)
    expect(rows[1]!.adductConfirmed).toBe(true)
    expect(rows[0]!.adductScore).toBeCloseTo(0.5, 6)
    expect(rows[1]!.compositeScore).toBeCloseTo(0.5 * 1.1, 6)
  })

  it('isolated member with all-null row keeps the prior (未测 ≠ 反证)', () => {
    const rows = [memberRow(1, '[M-H]-'), memberRow(2, '[M+Na]+')]
    const m = [
      [null, null],
      [null, null],
    ]
    expect(applyAdductGroupConfirmation(rows, m)).toBe(false)
    expect(rows[0]!.adductScore).toBeCloseTo(0.5, 6)
    expect(rows[0]!.adductUnconfirmed).toBeUndefined()
  })

  it('isolated member with measured-but-failing corr is revoked', () => {
    const rows = [memberRow(1, '[M-H]-'), memberRow(2, '[M+Na]+')]
    const m = [
      [null, 0.3],
      [0.3, null],
    ]
    expect(applyAdductGroupConfirmation(rows, m)).toBe(true)
    expect(rows[0]!.adductUnconfirmed).toBe(true)
    expect(rows[1]!.adductUnconfirmed).toBe(true)
  })
})

describe('ANNOTATION_SCORING constants', () => {
  it('exposes the Level 4 gate', () => {
    expect(ANNOTATION_SCORING.level4IsotopeMin).toBeGreaterThan(0)
    expect(ANNOTATION_SCORING.decoysPerRow).toBeGreaterThanOrEqual(1)
  })
})
