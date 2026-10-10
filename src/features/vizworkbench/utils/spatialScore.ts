/**
 * 空间证据打分（Tier-2）——离子图像的纯数学函数。
 *
 * 三个度量**逐行对齐 pySM 论文（Palmer et al., Nat Methods 2017）的参考
 * 实现** alexandrovteam/pyImagingMSpec `image_measures.py`（Apache 2.0），
 * MSM = chaos × spatial × spectral 为三度量乘积：
 *
 *  - `measureOfChaos`   level-sets 法（ρ_chaos）：图像按 max 归一，取
 *      nlevels 个强度层逐层阈值化，每层先十字膨胀再 3×3 全 1 腐蚀（边界
 *      按 0 处理，cv2/生产语义），数 4-连通域个数；得分 =
 *      1 − Σobjects / (非零像素数 × nlevels)。各层计数全相同 → null。
 *  - `isotopePatternMatch`  ρ_spectral：各同位素峰图像在 **M 非零像素
 *      掩码**上的总强度 vs 理论强度，两个向量各自 L2 归一化后
 *      1 − mean|a − b|；恰等于 1 → 0（退化的完美匹配按参考实现归零）。
 *  - `isotopeImageCorrelation`  ρ_spatial：M 图像与各卫星同位素图像在
 *      M 非零掩码上的 Pearson 相关，按理论强度加权平均并 clip 到 [0,1]；
 *      未定义相关（零方差）→ 0；少于 2 幅图像 → 0（pySM 管线对单峰分子
 *      公式另行取 1，由调用方决定）。
 */

/** 多加合物组的空间确认阈值（adduct_filter_helper.py min_spatial_correlation） */
export const ADDUCT_CORR_MIN = 0.7

/** 空间证据结果。null = 该分量不适用（图像全零 / 方差为零 / 无卫星峰）。 */
export interface SpatialScore {
  /** ρ_chaos（level sets） */
  chaos: number | null
  /** ρ_spatial（同位素图像相关） */
  spatial: number | null
  /** ρ_spectral（同位素图像强度模式 vs 理论） */
  spectral: number | null
  /** MSM = chaos × spatial × spectral；不适用分量按 pySM 结果表的 fillna(0)
   *  语义取 0 参与乘积（散点图 → 0），由调用方计算 */
  msm: number | null
  /** 多加合物组内该行 M 图像与同组其他加合物 M 图像的最大 Pearson
   *  （adduct_filter 的 MST 支撑边近似）。null = 未计算（组不在 Top-K）或
   *  零方差未定义；< {@link ADDUCT_CORR_MIN} = 空间上不共定位，加分存疑。 */
  adductCorr?: number | null
  /** 该行加载失败（网络/存储错误），悬停卡可提示重试。 */
  error?: boolean
}

// ---- 形态学与连通域（膨胀边界=0；腐蚀边界=0，cv2/生产语义） -----------------

/** 十字结构元膨胀：[[0,1,0],[1,1,1],[0,1,0]]，边界外视为 0。原地写 out。 */
function dilateCross(bw: Uint8Array, w: number, h: number, out: Uint8Array): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (
        bw[i] ||
        (x > 0 && bw[i - 1]) ||
        (x < w - 1 && bw[i + 1]) ||
        (y > 0 && bw[i - w]) ||
        (y < h - 1 && bw[i + w])
      )
        out[i] = 1
      else out[i] = 0
    }
  }
}

/** 3×3 全 1 结构元腐蚀，边界外视为 0（cv2/METASPACE 生产语义；scipy 参考路径
 *  的 border_value=1 会让贴边噪声存活，对"组织外背景为 0"的离子图不合理）。 */
function erodeSquare(bw: Uint8Array, w: number, h: number, out: Uint8Array): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let keep = 1
      for (let dy = -1; dy <= 1 && keep; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || !bw[ny * w + nx]) {
            keep = 0
            break
          }
        }
      }
      out[i] = keep
    }
  }
}

/** 4-连通域计数（BFS，输入被当作只读）。 */
function countComponents(bw: Uint8Array, w: number, h: number): number {
  const seen = new Uint8Array(bw.length)
  const stack: number[] = []
  let count = 0
  for (let i = 0; i < bw.length; i++) {
    if (!bw[i] || seen[i]) continue
    count++
    stack.push(i)
    seen[i] = 1
    while (stack.length > 0) {
      const p = stack.pop()!
      const x = p % w
      const y = (p / w) | 0
      const visit = (q: number) => {
        if (!seen[q]) {
          seen[q] = 1
          stack.push(q)
        }
      }
      if (x > 0 && bw[p - 1]) visit(p - 1)
      if (x < w - 1 && bw[p + 1]) visit(p + 1)
      if (y > 0 && bw[p - w]) visit(p - w)
      if (y < h - 1 && bw[p + w]) visit(p + w)
    }
  }
  return count
}

/**
 * ρ_chaos（level-sets 空间混沌度，越大越"结构化"）。全零图像或各层计数
 * 完全相同 → null（参考实现返回 NaN，本管线语义化为 null = 无证据）。
 * 注意参考管线的守卫"得分恰为 1 → 0"由调用方应用（见
 * useAnnotationSpatialScoring）。
 */
export function measureOfChaos(
  img: Float32Array | null | undefined,
  w: number,
  h: number,
  nlevels = 10,
): number | null {
  if (!img || img.length !== w * h || nlevels < 1) return null
  let sum = 0
  let max = 0
  let notNull = 0
  for (let i = 0; i < img.length; i++) {
    const v = img[i]!
    sum += v
    if (v > 0) notNull++
    if (v > max) max = v
  }
  if (!(sum > 0) || notNull === 0) return null

  const bw = new Uint8Array(img.length)
  const tmp = new Uint8Array(img.length)
  let objSum = 0
  let allSame = true
  let first = -1
  for (let k = 0; k < nlevels; k++) {
    const lev = k / nlevels // linspace(0,1,nlevels+1)[:-1]
    for (let i = 0; i < img.length; i++) bw[i] = img[i]! / max > lev ? 1 : 0
    dilateCross(bw, w, h, tmp)
    erodeSquare(tmp, w, h, bw)
    const n = countComponents(bw, w, h)
    if (first < 0) first = n
    else if (n !== first) allSame = false
    objSum += n
  }
  if (allSame) return null
  const score = 1 - objSum / (notNull * nlevels)
  return Number.isFinite(score) ? score : null
}

// ---- 参考度量的掩码约定：M 图像非零像素 -------------------------------

/**
 * ρ_spectral：图像强度模式 vs 理论同位素强度。
 *
 * @param images 同位素峰图像（[0] = M），等长
 * @param theor 对应的理论相对强度（M=1 归一或未归一均可，内部 L2 归一）
 */
export function isotopePatternMatch(
  images: (Float32Array | null | undefined)[],
  theor: number[],
): number | null {
  const m = images[0]
  if (!m || images.length !== theor.length || images.length < 1) return null
  let mSum = 0
  for (let i = 0; i < m.length; i++) if (m[i]! > 0) mSum += m[i]!
  if (!(mSum > 0)) return null

  const obs = new Array<number>(images.length)
  for (let k = 0; k < images.length; k++) {
    const img = images[k]
    if (!img) return null
    let s = 0
    for (let i = 0; i < m.length; i++) if (m[i]! > 0) s += img[i]!
    obs[k] = s
  }
  return normalizedIntensityMatch(theor, obs)
}

/**
 * 两个非负向量各自 L2 归一后的 1 − mean|a − b|；恰为 1 → 0（参考守卫：
 * 退化的完美匹配——如单峰向量——按 pySM 语义归零）。Tier-1 的
 * isotopeScoreOf 复用同一公式（obs 来自平均谱而非图像）。
 */
export function normalizedIntensityMatch(a: number[], b: number[]): number | null {
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  na = Math.sqrt(na)
  nb = Math.sqrt(nb)
  if (!(na > 0) || !(nb > 0)) return null
  let acc = 0
  for (let i = 0; i < a.length; i++) acc += Math.abs(a[i]! / na - b[i]! / nb)
  const score = 1 - acc / a.length
  if (score === 1) return 0
  return Math.min(1, Math.max(0, score))
}

/**
 * ρ_spatial：M 图像与各卫星图像的加权 Pearson。
 *
 * @param images 同位素峰图像（[0] = M），等长；少于 2 幅 → 0
 * @param weights 卫星相关性的权重（理论相对强度；缺省等权）
 */
export function isotopeImageCorrelation(
  images: (Float32Array | null | undefined)[],
  weights?: number[],
): number | null {
  const m = images[0]
  if (!m) return null
  const sats = images.slice(1)
  if (sats.length === 0) return 0
  let mask = 0
  for (let i = 0; i < m.length; i++) if (m[i]! > 0) mask++
  if (mask < 2) return 0

  const mMean = sumMasked(m, m) / mask
  const mD2 = sumMaskedSqDiff(m, m, mMean)
  if (mD2 <= 0) return 0

  const cors: number[] = []
  const ws: number[] = []
  for (let k = 0; k < sats.length; k++) {
    const img = sats[k]
    if (!img) return null
    // 与 M 在同一掩码上的 Pearson；零方差/未定义 → 0（参考：NaN/Inf → 0）
    const mean = sumMasked(img, m) / mask
    const d2 = sumMaskedSqDiff(img, m, mean)
    let num = 0
    for (let i = 0; i < m.length; i++) {
      if (m[i]! > 0) num += (img[i]! - mean) * (m[i]! - mMean)
    }
    const r = d2 > 0 ? num / Math.sqrt(d2 * mD2) : 0
    cors.push(Number.isFinite(r) ? r : 0)
    ws.push(weights && weights[k] != null ? weights[k]! : 1)
  }
  let wSum = 0
  for (const w of ws) wSum += w
  if (!(wSum > 0)) return null
  let acc = 0
  for (let i = 0; i < cors.length; i++) acc += ws[i]! * cors[i]!
  return Math.min(1, Math.max(0, acc / wSum))
}

/** mask（m>0 的位置）上 img 的和 */
function sumMasked(img: Float32Array, m: Float32Array): number {
  let s = 0
  for (let i = 0; i < img.length; i++) if (m[i]! > 0) s += img[i]!
  return s
}

/** mask 上 (img − mean)² 的和 */
function sumMaskedSqDiff(img: Float32Array, m: Float32Array, mean: number): number {
  let s = 0
  for (let i = 0; i < img.length; i++) {
    if (m[i]! > 0) {
      const d = img[i]! - mean
      s += d * d
    }
  }
  return s
}

/**
 * pySM 管线的图像预处理：热点裁剪（hot-spot removal）——把高于 q 分位
 * 数的强度截到该分位值，压掉单像素热点的杠杆效应。原数组不被修改。
 */
export function hotspotClip(img: Float32Array, percentile = 99): Float32Array {
  const nz: number[] = []
  for (let i = 0; i < img.length; i++) if (img[i]! > 0) nz.push(img[i]!)
  if (nz.length === 0) return img
  nz.sort((a, b) => a - b)
  const idx = Math.min(nz.length - 1, Math.ceil((percentile / 100) * nz.length) - 1)
  const cap = nz[idx]!
  const out = new Float32Array(img.length)
  for (let i = 0; i < img.length; i++) out[i] = img[i]! > cap ? cap : img[i]!
  return out
}

/**
 * 两幅等长图像的整幅 Pearson（多加合物组的空间确认，adduct_filter_helper
 * 的流式 Welford 相关的等价闭式）。无掩码——与参考一致，未采到的像素按 0
 * 强度参与。零方差/长度不符 → null（未定义，调用方按"未确认"处理）。
 */
export function pearsonCorrelation(a: Float32Array, b: Float32Array): number | null {
  if (a.length !== b.length || a.length < 2) return null
  let ma = 0
  let mb = 0
  for (let i = 0; i < a.length; i++) {
    ma += a[i]!
    mb += b[i]!
  }
  ma /= a.length
  mb /= b.length
  let dab = 0
  let da2 = 0
  let db2 = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]! - ma
    const y = b[i]! - mb
    dab += x * y
    da2 += x * x
    db2 += y * y
  }
  const den = Math.sqrt(da2 * db2)
  if (!(den > 0)) return null
  const r = dab / den
  return Number.isFinite(r) ? Math.min(1, Math.max(-1, r)) : null
}
