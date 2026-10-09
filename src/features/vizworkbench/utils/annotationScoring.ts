/**
 * 注释匹配的多证据打分（Tier-1：纯谱图证据）+ target-decoy FDR。
 *
 * 分数 + 一个 q 值，全部是 `MatchInputs` 既有字段（m/z 轴、平均谱、容差）
 * 的纯函数——worker 与主线程 fallback 走同一份代码，无需任何协议变更：
 *
 *  - `massScore`   质量误差线性衰减（1 − err/tol，夹到 [0,1]）。pySM 的
 *                  MSM 不含质量项（容差只做搜索窗），质量误差作为独立特征
 *                  是 METASPACE-ML 的做法；无图像的 Tier-1 需要它。
 *  - `isotopeScore` pySM `isotope_pattern_match` 公式（见
 *                  {@link ./spatialScore} 的参考对齐说明）：理论强度向量 vs
 *                  实测峰强向量各自 L2 归一后 1 − mean|a−b|。观测值以平均
 *                  谱窗口最大值近似参考的"同位素图像总强度"（Tier-2 的
 *                  useAnnotationSpatialScoring 用图像版，二者同公式）。
 *  - `compositeScore` = massScore × isotopeScore（isotopeScore 为 null——无
 *                  分子式/无平均谱——按 compositeIsoDefault 0.7 折算，见
 *                  scoreRows 内注释）
 *  - `fdr`         同一套打分跑在"不合理加合物"（Mn/Co 金属加合，真实 MSI
 *                  数据中不存在）生成的 decoy 离子上，按分数阈值估计经验
 *                  FDR，再转成每行的单调 q 值（pySM 式 target-decoy 的全局
 *                  变体：pySM 按 adduct 分组做等长对照、并列分数按比例拆分、
 *                  n_reps 取中位阈值；本实现为浏览器内存约束取全局曲线 +
 *                  nT/nD 规模校正 + 1/nD 下限，数学上同源）
 *  - `adductScore` 多加合物证据（Tier-1.5，CAMERA adduct_filter 移植）：
 *                  同一分子以 ≥2 种不同加合物落在不同谱峰 → 组分 Σips 折算
 *                  0..1，composite ×(1 + 0.2·adductScore)。FDR 仍按无加成的
 *                  基础分计算（applyAdductBonus 在 assignFdr 之后跑）；Tier-2
 *                  组内图像 Pearson ≥ 0.7 确认保留、< 0.7 反证撤销（见
 *                  {@link applyAdductConfirmation}，对齐参考的
 *                  min_spatial_correlation 门控）
 *
 * 本模块对 `csvAnnotation.ts` 只有 type 导入（运行时零依赖，避免循环）；
 * 极性取自加合物解析出的电荷符号，质量误差为本地实现。
 */

import { ELECTRON_MASS, elementsAndStableIsotopesObject } from 'chemical-elements'
import { isotopeEnvelope, chargeFromIonType } from './isotope'
import { normalizedIntensityMatch, ADDUCT_CORR_MIN } from './spatialScore'
import type { MatchedAnnotationRow, ToleranceMode } from './csvAnnotation'

/** 打分常量（v1 不开放用户调参） */
export const ANNOTATION_SCORING = {
  /** isotopeScore 达到该值才算 Level 4（参考 spec 公式判别力弱——缺 M+1
   *  也只降到 ~0.84——故门槛取 0.9 并要求期望峰全部被观测到） */
  level4IsotopeMin: 0.9,
  /** isotopeScore 为 null（无证据）时 compositeScore 的折算系数：低于
   *  参考公式可达的分数区间下沿（~0.84），使"无证据"排在一切有分值行之下 */
  compositeIsoDefault: 0.7,
  /** 实测峰"存在"判定：窗口内最大强度 ≥ 观测 M 强度 × 该系数 */
  obsFloorRel: 0.01,
  /** 每行生成的 decoy 数 */
  decoysPerRow: 2,
  /** 多加合物证据的 composite 加成权重：composite ×(1 + w·adductScore)，
   *  w=0.2 → 三种加合物全分时 +20%（CAMERA Σips 组分的折中系数） */
  adductBonusWeight: 0.2,
  /** 多加合物组必须含准分子离子（adduct_filter 的 require_quasi 门控） */
  adductRequireQuasi: true,
  /** 中性质量聚类的绝对容差底（Da，CAMERA mzabs 默认） */
  adductClusterMzabs: 0.015,
  /** 中性质量聚类的 ppm 超参（CAMERA cut height 2·ppm·1e-6·M + mzabs）。
   *  对齐参考 compute_adduct_annotations(ppm=5.0)，**独立于面板匹配容差**——
   *  面板容差是搜索窗，聚类切割是"同分子"判据：面板放宽到 20ppm 时切割
   *  若跟着放宽（2·20ppm·M），中性质量差 ~40mDa 的不同分子会互相授予加成 */
  adductClusterPpm: 5,
} as const

/** 打分所需的输入（MatchInputs 的子集——不引入任何新字段） */
export interface ScoringInputs {
  mzAxis?: ArrayLike<number> | null
  meanIntensity?: ArrayLike<number> | null
  tolerance: number
  mode: ToleranceMode
}

/** assignFdr 的规模统计 */
export interface FdrStats {
  targetsScored: number
  decoysScored: number
}

// ---- 基础件 --------------------------------------------------------------

/** 质量误差 → [0,1] 线性衰减分。err/tol 同单位（ppm 或 Da），越准越高。 */
export function massScoreOf(massError: number | null, tolerance: number): number | null {
  if (
    massError == null ||
    !Number.isFinite(massError) ||
    !Number.isFinite(tolerance) ||
    tolerance <= 0
  )
    return null
  return Math.max(0, 1 - massError / tolerance)
}

/** |exp − got|，单位同 tolerance（massErrorOf 的本地实现，避免循环依赖） */
function absMassError(expMz: number, matchedMz: number, mode: ToleranceMode): number {
  const d = Math.abs(expMz - matchedMz)
  return mode === 'ppm' ? (d / expMz) * 1e6 : d
}

/** m/z → 该模式下的容差半宽（Da） */
function tolDaOf(mz: number, tolerance: number, mode: ToleranceMode): number {
  return mode === 'ppm' ? Math.abs(mz) * tolerance * 1e-6 : tolerance
}
/** 升序轴上二分查找最接近 target 的下标 */
function closestIndex(axis: ArrayLike<number>, target: number): number {
  let lo = 0
  let hi = axis.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (axis[mid]! < target) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(axis[lo - 1]! - target) <= Math.abs(axis[lo]! - target)) return lo - 1
  return lo
}

/** [lo, hi] 窗口内平均谱的最大强度；窗口无采样点 → 0 */
function maxIntensityInWindow(
  axis: ArrayLike<number>,
  mean: ArrayLike<number>,
  lo: number,
  hi: number,
): number {
  let i = closestIndex(axis, lo)
  // 回退到第一个 ≥ lo 的点（closestIndex 可能落在 lo 左侧）
  while (i > 0 && axis[i]! > lo) i--
  if (axis[i]! < lo) i++
  let max = 0
  for (; i < axis.length && axis[i]! <= hi; i++) {
    const v = i < mean.length ? mean[i]! : 0
    if (v > max) max = v
  }
  return max
}

// ---- 同位素谱图分 ----------------------------------------------------------

export interface IsotopeMatchResult {
  /** 梯形重叠相似度 0..1；null = 无证据（无分子式/无平均谱/维度不足） */
  score: number | null
  /** 期望峰（≥1% 理论强度）中被观测到的个数（≥ 观测 M 的 1%） */
  obsCount: number | null
  /** 期望峰总数（≥1% 理论强度，M..M+3，上限 4 峰） */
  expectedCount: number | null
}

/**
 * 理论同位素包络 vs 实测平均谱。理论峰锚定在 `anchorMz`（行自身的
 * Exp. m/z），每个峰在 ±容差窗口内取平均谱最大强度作为观测值。分数是
 * 卫星峰（M+1、M+2…）实测/理论强度比的加权分（详见函数体注释）。
 */
export function isotopeScoreOf(
  axis: ArrayLike<number> | null | undefined,
  mean: ArrayLike<number> | null | undefined,
  anchorMz: number,
  formulaIon: string | null,
  charge: number,
  tolerance: number,
  mode: ToleranceMode,
): IsotopeMatchResult {
  const none: IsotopeMatchResult = { score: null, obsCount: null, expectedCount: null }
  const env = isotopeEnvelope(formulaIon, charge)
  if (!env || !axis || axis.length === 0 || !mean) return none
  if (!Number.isFinite(anchorMz) || tolerance <= 0) return none
  // 单峰包络（M+1 低于剪枝线）= 无同位素证据
  if (env.length < 2) return none

  const observedInt: number[] = []
  let obsM = -1
  for (const p of env) {
    const mzK = anchorMz + p.dm
    const w = tolDaOf(mzK, tolerance, mode)
    const o = maxIntensityInWindow(axis, mean, mzK - w, mzK + w)
    observedInt.push(o)
    if (p.dm === 0) obsM = o
  }
  if (obsM <= 0) {
    // M 本身无观测强度：不是"无证据"而是"明确不佳" → 0 分
    return { score: 0, obsCount: 0, expectedCount: env.length }
  }

  const floor = obsM * ANNOTATION_SCORING.obsFloorRel
  let obsCount = 0
  for (let k = 0; k < env.length; k++) {
    if (observedInt[k]! >= floor) obsCount++
  }
  // 参考公式（pySM isotope_pattern_match）：两个向量各自 L2 归一化后
  // 1 − mean|a−b|。观测值以平均谱窗口最大值近似参考的"图像总强度"。
  const score = normalizedIntensityMatch(
    env.map((p) => p.rel),
    observedInt,
  )
  return { score, obsCount, expectedCount: env.length }
}

// ---- 加合物解析（FDR decoy 生成用）----------------------------------------

export interface ParsedAdduct {
  /** 带符号电荷（[M+2H]2+ → +2）；无电荷符号 → 0 */
  z: number
  /** 加合/丢失的原子质量和（带符号；[M+H-H2O]+ → mass(H) − mass(H2O)） */
  deltaSum: number
  /** 聚合度（[2M-H]- → 2；普通加合物 → 1）。中性质量需除以它才是每分子口径 */
  nmol: number
  /** 极性（按电荷符号），z=0 → null */
  polarity: 'positive' | 'negative' | null
}

/** 加合 token：`+H`、`-H2O`、`+2H`、`+CH3COO`。内层用非捕获重复，捕获
 *  整个组式（嵌套捕获只会留下最后一次迭代，`H2O` 会退化成 `O`）；允许
 *  元素前带计数（`+2H`）。 */
const GROUP_TOKEN = /([+-])((?:\d*[A-Z][a-z]?\d*)+)/g
/** 元素项：可选前导计数 + 符号 + 可选尾随计数（`2H`、`H2`、`CH3`）。 */
const ELEMENT_TOKEN = /(\d*)([A-Z][a-z]?)(\d*)/g

/** 阴离子型加合基团（+Cl / +HCOO 等 → 负模式）。原始 token 串匹配。 */
const ANION_GROUPS = new Set([
  'Cl',
  'Br',
  'F',
  'I',
  'HCOO',
  'HCO2',
  'CH3COO',
  'C2H3O2',
  'NO3',
  'HSO4',
  'HCO3',
])
/** 阳离子型加合基团（+H / +Na 等 → 正模式） */
const CATION_GROUPS = new Set(['H', 'Na', 'K', 'Li', 'NH4', 'NaK' /* 罕见 */])

/**
 * 解析 s2fmt 风格的加合物串：`[M+H]+`、`M-H`、`[M+2H]2+`、`[M+H-H2O]+`、
 * `[2M+Na]+`（前系数是聚合度 nmol，delta 不变但中性质量要除回，见
 * {@link neutralMassOf}）。元素质量取自
 * chemical-elements；未知元素/无法解析 → null。
 *
 * 极性：尾部电荷符号优先；缺失时按化学规则推断——阴离子基团（+Cl…）→
 * 负模式，仅去质子（−H）→ 负模式，其余阳离子加合 → 正模式。`OAc` 归一化
 * 为 `CH3COO`（否则 'Ac' 会被当锕元素）。
 */
export function parseAdduct(ionType: string | null | undefined): ParsedAdduct | null {
  if (!ionType) return null
  let s = ionType.replace(/[\s[\]]/g, '').replace(/OAc/g, 'CH3COO')
  const chargeM = /(\d*)([+-])$/.exec(s)
  let z = 0
  if (chargeM) {
    z = chargeM[1] ? Number(chargeM[1]) : 1
    if (!Number.isFinite(z) || z < 1 || z > 4) return null
    z = chargeM[2] === '+' ? z : -z
    s = s.slice(0, chargeM.index)
  }
  // 聚合度系数（[2M-H]- 的 2）：先取出再剥离。CAMERA 规则表只收 nmol=1，
  // 这里宽容解析用户 CSV 里的 2M/3M 形式——中性质量必须除回 nmol 才与
  // 单体行同口径，否则 [2M-H]- 算出 2M，永远无法与同分子的 [M-H]- 聚簇。
  const coefM = /^(\d*)M/.exec(s)
  const nmol = coefM?.[1] ? Number(coefM[1]) : 1
  if (!Number.isFinite(nmol) || nmol < 1 || nmol > 4) return null
  s = s.replace(/^\d*/, '').replace(/^M/, '')
  let deltaSum = 0
  let sawAnion = false
  let sawCation = false
  let sawOnlyLossH = true
  for (const m of s.matchAll(GROUP_TOKEN)) {
    const sign = m[1] === '+' ? 1 : -1
    const raw = m[2]!
    if (sign > 0) {
      sawOnlyLossH = false
      if (ANION_GROUPS.has(raw)) sawAnion = true
      else if (CATION_GROUPS.has(raw)) sawCation = true
    } else if (raw !== 'H') {
      sawOnlyLossH = false // 中性丢失（H2O 等）不影响极性
    }
    let tokenMass = 0
    for (const e of raw.matchAll(ELEMENT_TOKEN)) {
      const lead = e[1] ? Number(e[1]) : 1
      const trail = e[3] ? Number(e[3]) : 1
      const info = elementsAndStableIsotopesObject[e[2]!]
      if (!info) return null
      tokenMass += lead * trail * info.monoisotopicMass
    }
    deltaSum += sign * tokenMass
  }
  // 残余未消费字符 = 解析失败
  const consumed = [...s.matchAll(GROUP_TOKEN)].map((m) => m[0]).join('')
  if (s !== consumed) return null
  let polarity: 'positive' | 'negative' | null = null
  if (z > 0) polarity = 'positive'
  else if (z < 0) polarity = 'negative'
  else if (sawAnion || (sawOnlyLossH && s.includes('-H'))) polarity = 'negative'
  else if (sawCation) polarity = 'positive'
  if (z === 0 && polarity) z = polarity === 'positive' ? 1 : -1
  return { z, deltaSum, nmol, polarity }
}

/**
 * 离子 m/z → 中性质量（单同位素，每分子口径）。z=1 常见式：neutral = expMz − delta；
 * 多电荷按 m/z = (neutral + deltaSum − z·e)/|z| 反解；聚合加合（[2M-H]- 等）
 * 最后除以 nmol——与 python 参考 adduct_filter_helper._neutral_mass 同式
 * （( |z|·mz − massdiff ) / nmol）。
 */
export function neutralMassOf(expMz: number, adduct: ParsedAdduct): number {
  const zAbs = Math.abs(adduct.z) || 1
  return (expMz * zAbs - adduct.deltaSum + adduct.z * ELECTRON_MASS) / adduct.nmol
}

/** 化学上不可能真实出现的 decoy 加合物（真实元素、从未观察到的加合形式） */
export const IMPLAUSIBLE_ADDUCTS: Record<
  'positive' | 'negative',
  readonly { label: string; delta: number }[]
> = (() => {
  const el = (sym: string) => elementsAndStableIsotopesObject[sym]!.monoisotopicMass
  // 正离子：金属阳离子加合（原子量 − e）；负离子：金属阴离子（原子量 + e）
  return {
    positive: [
      { label: '[M+Mn]+', delta: el('Mn') - ELECTRON_MASS },
      { label: '[M+Co]+', delta: el('Co') - ELECTRON_MASS },
    ],
    negative: [
      { label: '[M+Mn]-', delta: el('Mn') + ELECTRON_MASS },
      { label: '[M+Co]-', delta: el('Co') + ELECTRON_MASS },
    ],
  }
})()

// ---- 多加合物证据（CAMERA adduct_filter 移植）------------------------------

/** 加合物规则：ips = CAMERA 离子概率分（组得分 = Σips），quasi = 准分子离子 */
interface AdductRuleInfo {
  ips: number
  quasi: boolean
}

/** 聚合加合（[2M-H]- 等）的保守规则：CAMERA 扩展表对二聚体的一贯定级 */
const DIMER_ADDUCT_RULE: AdductRuleInfo = { ips: 0.5, quasi: false }

/**
 * 规则表（键 = 归一化加合核心，无括号/电荷后缀）。取值对齐
 * adduct_filter_helper.py 的 PRIMARY_ADDUCT_RULES：[M+H/Na/K/NH4]+ 与
 * [M-H/Cl]- 均 ips=1.0、quasi=true；[M-2H+Na]-/[M-2H+K]- 均 ips=0.5、
 * quasi=false（CAMERA 对杂二聚体的内建惩罚）。在此之上补充 s2fmt 库的
 * 常见形式（[M+Li]+、[M+HCOO]-、[M+CH3COO]-——DESI 常见，与 Cl 同类）。
 */
const ADDUCT_RULES: Record<string, AdductRuleInfo> = {
  'M+H': { ips: 1, quasi: true },
  'M+Na': { ips: 1, quasi: true },
  'M+K': { ips: 1, quasi: true },
  'M+NH4': { ips: 1, quasi: true },
  'M+Li': { ips: 1, quasi: true },
  'M-H': { ips: 1, quasi: true },
  'M+Cl': { ips: 1, quasi: true },
  'M+HCOO': { ips: 1, quasi: true },
  'M+CH3COO': { ips: 1, quasi: true },
  'M-2H+Na': { ips: 0.5, quasi: false },
  'M-2H+K': { ips: 0.5, quasi: false },
}

/**
 * 加合物串 → 规则表键：去括号/空白、OAc→CH3COO、去尾部电荷符号。
 * `[M+H]+`→`M+H`、`M-H`→`M-H`、`[M+2H]2+`→`M+2H`。
 * **保留**聚合度系数：`[2M-H]-`→`2M-H`——它与 `M-H` 是不同的观测离子
 * 形式（不同谱峰），组内去重键必须区分；规则表查不到的聚合形式落
 * DIMER_ADDUCT_RULE（ips=0.5、非准分子），与 CAMERA 对二聚体的保守
 * 定级一致。不以 M（可带前系数）开头 → null。
 */
function adductCoreOf(ionType: string | null | undefined): string | null {
  if (!ionType) return null
  let s = ionType.replace(/[\s[\]]/g, '').replace(/OAc/g, 'CH3COO')
  s = s.replace(/(\d*)([+-])$/, '')
  return /^\d*M/.test(s) && s.length > 1 ? s : null
}

/** 聚类候选行：matched + 加合物可解析 + 规则表（或聚合规则）收录 */
interface AdductCand {
  row: MatchedAnnotationRow
  /** 由匹配峰位反推的中性质量（观测口径） */
  neutral: number
  /** 归一化加合核心（组内去重键） */
  core: string
  info: AdductRuleInfo
}

/**
 * 同一中性质量内的成员按"锚点 + 容差"聚簇（CAMERA cut height
 * `2·ppm·1e-6·M + mzabs` 的锚点简化：以簇首为参考做链式合并）。
 * 切割高度用参考实现的独立超参 ppm=5（{@link ANNOTATION_SCORING.adductClusterPpm}），
 * **不随面板匹配容差/模式**。返回所有 ≥2 成员的簇。
 */
function clusterByNeutralMass(list: AdductCand[]): AdductCand[][] {
  const sorted = [...list].sort((a, b) => a.neutral - b.neutral)
  const out: AdductCand[][] = []
  let cur: AdductCand[] = []
  let anchor = 0
  for (const c of sorted) {
    if (cur.length === 0) {
      cur = [c]
      anchor = c.neutral
      continue
    }
    const tol =
      2 * Math.abs(anchor) * ANNOTATION_SCORING.adductClusterPpm * 1e-6 +
      ANNOTATION_SCORING.adductClusterMzabs
    if (c.neutral - anchor <= tol) cur.push(c)
    else {
      if (cur.length > 1) out.push(cur)
      cur = [c]
      anchor = c.neutral
    }
  }
  if (cur.length > 1) out.push(cur)
  return out
}

/**
 * 多加合物证据（Tier-1.5，CAMERA adduct_filter / checkIps 的注释版移植）：
 * 同一分子以 ≥2 种不同加合物形式落在**不同谱峰**上 → 组分 = Σips（每种
 * 独立加合物的离子概率分之和），adductScore = min(1, (Σips − 1)/2)（两种
 * 一级加合物 0.5，三种 1.0；含 0.5 分二级加合物的组按比例折半），
 * composite ×(1 + adductBonusWeight·adductScore)。
 *
 * 成组条件（对齐参考实现）：
 *  - 同分子：formulaIon 一致（s2fmt 库的天然口径）；无分子式的行退化为
 *    中性质量聚类（锚点链式，切割高度 2·5ppm·M + 0.015 Da，独立于面板容差）
 *  - ≥2 种不同加合核心，且各自锚定在不同谱峰（matchedIndex 互异——
 *    折叠后行本就互异，但同加合物重复行可能共享峰，此时整组放弃）
 *  - require_quasi：组内须含准分子离子（否则如 [M-2H+Na]-/[M-2H+K]- 的
 *    偶然配对不得分）
 *  - 跨组 Σips 竞争（CAMERA checkIps）：不同分子的组共享谱峰时，Σips
 *    严格较低者整组弃权——同一实测峰不得同时充当两个分子的独立佐证
 *
 * **必须在 assignFdr 之后调用**：FDR 按无加成的基础分计算——decoy 金属
 * 加合物不在规则表内、无法形成合规组，若先加成再算 q 值会系统性低估 FDR。
 * Tier-2 的空间确认（组内 M 图像 Pearson ≥ 0.7，adductCorr）由
 * useAnnotationSpatialScoring 渐进计算并经 {@link applyAdductConfirmation}
 * 回馈：< 0.7 的组撤销加分——Tier-1 的加成是把行排进 Top-K 打分队列的
 * 先验，Tier-2 的图像证据才是参考实现（min_spatial_correlation 门控）
 * 意义上的确认步骤；未测组的先验加成保留（渐进两层架构的固有局限，
 * 见 ANNOTATION-SCORING.md）。
 */
export function applyAdductBonus(rows: MatchedAnnotationRow[]): void {
  const cands: AdductCand[] = []
  for (const row of rows) {
    if (row.matchStatus !== 'matched' || row.matchedMz == null) continue
    const adduct = parseAdduct(row.ionType)
    const core = adductCoreOf(row.ionType)
    if (!adduct || !core) continue
    // 封闭规则表（对齐参考：只在 PRIMARY 规则上建立加合物组假设）。表外
    // 单加合物（[M+Fe]+ 等金属加合）不进组——否则垃圾加合物可搭真 quasi
    // 成员的便车贡献 ips、稀释 require_quasi 门控；表外聚合形式（2M/3M）
    // 是 CAMERA 扩展表的有据条目，按二聚体保守规则参与。
    const info = ADDUCT_RULES[core] ?? (adduct.nmol > 1 ? DIMER_ADDUCT_RULE : null)
    if (!info) continue
    const neutral = neutralMassOf(row.matchedMz, adduct)
    if (!Number.isFinite(neutral)) continue
    cands.push({ row, neutral, core, info })
  }
  if (cands.length < 2) return

  // 分组：有分子式 → 键 = 归一化分子式（内部再做中性质量聚簇防坏库）；
  // 无分子式 → 直接中性质量聚簇
  const byFormula = new Map<string, AdductCand[]>()
  const noFormula: AdductCand[] = []
  for (const c of cands) {
    const f = c.row.formulaIon?.replace(/\s+/g, '').toUpperCase()
    if (f) {
      const list = byFormula.get(f)
      if (list) list.push(c)
      else byFormula.set(f, [c])
    } else noFormula.push(c)
  }

  const groups: AdductCand[][] = []
  for (const list of byFormula.values()) {
    if (list.length > 1) groups.push(...clusterByNeutralMass(list))
  }
  groups.push(...clusterByNeutralMass(noFormula))

  // 先完整评估各组（组内门槛），再跨组竞争，最后统一授予
  interface Evaluated {
    cluster: AdductCand[]
    byCore: Map<string, AdductCand>
    members: AdductCand[]
    ipsSum: number
    score: number
  }
  const evaluated: Evaluated[] = []
  for (const g of groups) {
    // 每种加合核心取首行做代表（同加合物重复行共享证据，见下）
    const byCore = new Map<string, AdductCand>()
    for (const c of g) if (!byCore.has(c.core)) byCore.set(c.core, c)
    const members = [...byCore.values()]
    if (members.length < 2) continue
    if (ANNOTATION_SCORING.adductRequireQuasi && !members.some((m) => m.info.quasi)) continue
    // 同峰复用（不同加合物挤进同一容差窗）→ 证据无效，整组放弃
    const peaks = new Set(members.map((m) => m.row.matchedIndex))
    if (peaks.size < members.length) continue

    const ipsSum = members.reduce((s, m) => s + m.info.ips, 0)
    const score = Math.min(1, (ipsSum - 1) / 2)
    if (!(score > 0)) continue
    evaluated.push({ cluster: g, byCore, members, ipsSum, score })
  }

  // 跨组 Σips 竞争（CAMERA checkIps / 参考 _resolve_groups_by_ips）：任一
  // 谱峰被多组共享时，Σips 严格较低者整组弃权——同一实测峰不得同时充当
  // 两个不同分子的独立佐证（真实可达：折叠按 expMz 键控，两个 Formula 的
  // 行落在同一峰的容差窗内而 expMz 略异时不会被折叠）。
  const peakToGroups = new Map<number, number[]>()
  evaluated.forEach((eg, gi) => {
    for (const m of eg.members) {
      const pk = m.row.matchedIndex!
      const list = peakToGroups.get(pk)
      if (list) list.push(gi)
      else peakToGroups.set(pk, [gi])
    }
  })
  const dropped = new Set<number>()
  for (const list of peakToGroups.values()) {
    if (list.length < 2) continue
    const best = Math.max(...list.map((gi) => evaluated[gi]!.ipsSum))
    for (const gi of list) if (evaluated[gi]!.ipsSum < best) dropped.add(gi)
  }

  for (let gi = 0; gi < evaluated.length; gi++) {
    if (dropped.has(gi)) continue
    const { cluster, byCore, members, score } = evaluated[gi]!
    for (const c of cluster) {
      const peers = members.filter((m) => m !== byCore.get(c.core))
      c.row.adductScore = score
      c.row.adductPeers = peers.map((m) => m.row.ionType ?? m.core)
      c.row.adductPeerIds = peers.map((m) => m.row.id)
      if (c.row.compositeScore != null) {
        c.row.compositeScore *= 1 + ANNOTATION_SCORING.adductBonusWeight * score
      }
    }
  }
}

/**
 * Tier-2 空间确认回馈（对齐 adduct_filter_helper 的 min_spatial_correlation
 * 门控）。**单行入口**：组内最佳两两图像 Pearson ≥ {@link ADDUCT_CORR_MIN} →
 * 加分确认保留（adductConfirmed）；< 阈值 → **反证撤销**——composite 除回
 * (1 + w·adductScore)、adductScore 置 0、adductUnconfirmed 置位（徽章
 * 警告色、导出列可解释）。corr == null（图像缺失/未测得）不动：未测 ≠
 * 反证。幂等：adductScore ≤ 0（已撤销/未加分）直接返回。
 *
 * 组确认任务应优先走 {@link applyAdductGroupConfirmation}：它在同样的阈值
 * 语义上按参考 _confirm_groups_from_correlations 的**连通分量**重验成组
 * 条件，避免"组整体不成立但个别成员最大 Pearson 过线"的误确认。
 *
 * @returns 是否发生了撤销（调用方据此刷新行数组的响应式身份）
 */
export function applyAdductConfirmation(row: MatchedAnnotationRow, corr: number | null): boolean {
  if (row.adductScore == null || row.adductScore <= 0) return false
  if (corr == null) return false
  if (corr >= ADDUCT_CORR_MIN) {
    row.adductConfirmed = true
    return false
  }
  return revokeAdductRow(row)
}

/** 反证撤销单行加成（composite 除回、adductScore 清零、标志置位） */
function revokeAdductRow(row: MatchedAnnotationRow): boolean {
  if (row.adductScore == null || row.adductScore <= 0) return false
  if (row.compositeScore != null) {
    row.compositeScore /= 1 + ANNOTATION_SCORING.adductBonusWeight * row.adductScore
  }
  row.adductScore = 0
  row.adductUnconfirmed = true
  return true
}

/** 行的加合规则是否为准分子离子（组级确认按连通分量重验 require_quasi 用） */
function quasiOfRow(row: MatchedAnnotationRow): boolean {
  const adduct = parseAdduct(row.ionType)
  const core = adductCoreOf(row.ionType)
  if (!adduct || !core) return false
  const info = ADDUCT_RULES[core] ?? (adduct.nmol > 1 ? DIMER_ADDUCT_RULE : null)
  return info?.quasi ?? false
}

/**
 * Tier-2 **组级**确认（对齐参考 _confirm_groups_from_correlations）：以
 * Pearson ≥ {@link ADDUCT_CORR_MIN} 的成员边建图（同加合核心的边不计——
 * 组内核心本就唯一，防御性保留），按**连通分量**重验成组条件：分量须含
 * ≥2 种不同加合核心，且（require_quasi 时）含准分子离子；不满足的分量
 * 整段弃权（成员全部反证撤销）。孤立成员（无过阈值边）：行内测得过有限
 * 值 → 反证撤销；全 null → 不动（未测 ≠ 反证，渐进两层架构的固有局限）。
 *
 * 参考场景：组 {[M-H]-(quasi), [M-2H+Na]-, [M-2H+K]-}，corr H-Na=H-K=0.1、
 * Na-K=0.9——按行最大 Pearson 会让 Na/K 各自过线保留加成；按分量语义
 * {Na,K} 无 quasi 成员，整段撤销（与 Python 结果一致）。
 *
 * @param rows 组成员行（与 matrix 维度平行）
 * @param matrix 成对 Pearson 矩阵（[i][j]；null = 未测得；对角线忽略）
 * @returns 是否发生了撤销（调用方据此刷新行数组的响应式身份）
 */
export function applyAdductGroupConfirmation(
  rows: MatchedAnnotationRow[],
  matrix: (number | null)[][],
): boolean {
  const n = rows.length
  if (n < 2 || matrix.length < n) return false
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = matrix[i]?.[j]
      if (r == null || !Number.isFinite(r) || r < ADDUCT_CORR_MIN) continue
      if (adductCoreOf(rows[i]!.ionType) === adductCoreOf(rows[j]!.ionType)) continue
      adj[i]!.push(j)
      adj[j]!.push(i)
    }
  }
  const visited = new Array<boolean>(n).fill(false)
  let revoked = false
  for (let start = 0; start < n; start++) {
    if (visited[start]) continue
    const comp: number[] = []
    const stack = [start]
    visited[start] = true
    while (stack.length > 0) {
      const p = stack.pop()!
      comp.push(p)
      for (const q of adj[p]!) {
        if (!visited[q]) {
          visited[q] = true
          stack.push(q)
        }
      }
    }
    if (comp.length < 2) {
      // 孤立成员：行内测得过有限值 → 反证；全 null → 未测不动
      const measured = comp.some((i) =>
        (matrix[i] ?? []).some((r) => r != null && Number.isFinite(r)),
      )
      if (measured) revoked = revokeAdductRow(rows[start]!) || revoked
      continue
    }
    const cores = new Set(comp.map((i) => adductCoreOf(rows[i]!.ionType) ?? String(i)))
    const okRules = cores.size >= 2
    const okQuasi =
      !ANNOTATION_SCORING.adductRequireQuasi || comp.some((i) => quasiOfRow(rows[i]!))
    if (okRules && okQuasi) {
      for (const i of comp) {
        if (rows[i]!.adductScore != null && rows[i]!.adductScore > 0) {
          rows[i]!.adductConfirmed = true
        }
      }
    } else {
      for (const i of comp) revoked = revokeAdductRow(rows[i]!) || revoked
    }
  }
  return revoked
}

// ---- 打分主流程 ------------------------------------------------------------

/**
 * Tier-1 打分（原地填充）。只处理 `matchStatus === 'matched'` 的行；其余行
 * 六个字段全部置 null。**必须作用在管线新产的折叠行对象上**（match/collapse
 * 都是浅拷贝产新对象），不要喂入调用方缓存的 parsed rows。
 */
export function scoreRows(rows: MatchedAnnotationRow[], inputs: ScoringInputs): void {
  for (const row of rows) {
    if (row.matchStatus !== 'matched' || row.massError == null) {
      row.massScore = null
      row.isotopeScore = null
      row.isotopeObsCount = null
      row.isotopeExpCount = null
      row.compositeScore = null
      row.fdr = null
      row.level = null
      continue
    }
    row.massScore = massScoreOf(row.massError, inputs.tolerance)
    const iso = isotopeScoreOf(
      inputs.mzAxis,
      inputs.meanIntensity,
      row.expMz,
      row.formulaIon,
      chargeFromIonType(row.ionType),
      inputs.tolerance,
      inputs.mode,
    )
    row.isotopeScore = iso.score
    row.isotopeObsCount = iso.obsCount
    row.isotopeExpCount = iso.expectedCount
    // isotopeScore 为 null（无证据）时按 compositeIsoDefault 折算而非 1.0：
    // 该值低于参考 spec 公式的可达区间下沿（~0.84），使"无证据"在 composite
    // 排序与 FDR 中位于一切有分值行之下。decoy 分数用同一规则保持对称。
    row.compositeScore =
      row.massScore == null
        ? null
        : row.massScore * (iso.score ?? ANNOTATION_SCORING.compositeIsoDefault)
    row.fdr = null
    // Level 4 = 精确质量 + 同位素支持：参考 spec 公式本身判别力弱（缺 M+1
    // 也只降到 ~0.84），故门槛 0.9 且要求期望峰全部被观测到
    row.level =
      iso.score != null &&
      iso.score >= ANNOTATION_SCORING.level4IsotopeMin &&
      iso.obsCount === iso.expectedCount
        ? 4
        : 5
  }
}

/**
 * target-decoy FDR（原地写 row.fdr）。从折叠行集合生成 decoy（中性质量 +
 * 不合理加合物），跑同一套 Tier-1 打分，按综合分阈值估计 FDR 并转成每行
 * 单调 q 值：
 *
 *   FDR(sᵢ) = min(1, (#decoy ≥ sᵢ) · nT/nD / (i+1))，再从尾部取前缀最小值，
 *   并施加 1/nD 的有限 decoy 下限。
 *
 * decoy 与 target 打分规则完全对称（同分子式、同容差、同锚定偏移量逻辑），
 * 区别仅在于 m/z 位置——这正是被测的零假设。
 *
 * @param resultPolarity 行自身加合物无电荷符号时的极性回退（来自结果极性）
 */
export function assignFdr(
  rows: MatchedAnnotationRow[],
  inputs: ScoringInputs,
  resultPolarity: 'positive' | 'negative' | null,
): FdrStats | null {
  const { mzAxis: axis, meanIntensity: mean, tolerance, mode } = inputs
  if (!axis || axis.length === 0 || tolerance <= 0) return null

  // ---- decoy 生成 + 打分 ----
  const seen = new Set<string>()
  const decoyScores: number[] = []
  for (const row of rows) {
    if (!row.valid) continue
    const adduct = parseAdduct(row.ionType)
    if (!adduct) continue
    const polarity = adduct.polarity ?? resultPolarity
    if (!polarity) continue
    const neutral = neutralMassOf(row.expMz, adduct)
    const list = IMPLAUSIBLE_ADDUCTS[polarity]
    const n = Math.min(ANNOTATION_SCORING.decoysPerRow, list.length)
    for (let d = 0; d < n; d++) {
      const decoyMz = neutral + list[d]!.delta
      if (!Number.isFinite(decoyMz)) continue
      const key = decoyMz.toFixed(4)
      if (seen.has(key)) continue
      seen.add(key)
      const idx = closestIndex(axis, decoyMz)
      const err = absMassError(decoyMz, axis[idx]!, mode)
      if (err > tolerance) continue
      const ms = massScoreOf(err, tolerance)
      if (ms == null) continue
      // decoy 一律 z=1（IMPLAUSIBLE_ADDUCTS 按 z=1 定义），间距不除原行电荷。
      // isotopeScore null 按门槛折算，与 target 的 composite 规则完全一致。
      const iso = isotopeScoreOf(axis, mean, decoyMz, row.formulaIon, 1, tolerance, mode)
      decoyScores.push(ms * (iso.score ?? ANNOTATION_SCORING.compositeIsoDefault))
    }
  }

  // ---- target q 值 ----
  const targets = rows.filter((r) => r.compositeScore != null)
  const nT = targets.length
  const nD = decoyScores.length
  if (nT === 0 || nD === 0) return null
  targets.sort((a, b) => b.compositeScore! - a.compositeScore! || a.id - b.id)
  decoyScores.sort((a, b) => b - a)

  const scale = nT / nD
  const floor = 1 / nD
  let j = 0
  const q = new Array<number>(nT)
  for (let i = 0; i < nT; i++) {
    while (j < nD && decoyScores[j]! >= targets[i]!.compositeScore!) j++
    q[i] = Math.min(1, (j * scale) / (i + 1))
  }
  // 尾部前缀最小 + 有限 decoy 下限，保证 q 随分数下降单调不增
  for (let i = nT - 1; i >= 0; i--) {
    const tail = i + 1 < nT ? q[i + 1]! : q[i]!
    q[i] = Math.max(Math.min(q[i]!, tail), floor)
  }
  for (let i = 0; i < nT; i++) targets[i]!.fdr = q[i]!
  return { targetsScored: nT, decoysScored: nD }
}
