import { describe, it, expect } from 'vitest'
import {
  measureOfChaos,
  isotopePatternMatch,
  isotopeImageCorrelation,
  hotspotClip,
  normalizedIntensityMatch,
} from '../spatialScore'

/** 在 w×h 画布的矩形区域内填值 */
function rect(
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  v: number,
): Float32Array {
  const img = new Float32Array(w * h)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) img[y * w + x] = v
  return img
}

describe('measureOfChaos (pySM level-sets 参考)', () => {
  const W = 40
  const H = 40

  /** 中心亮、向外线性衰减的圆盘（有内部强度结构 → 各层阈值化出同心层） */
  function gradedDisc(w: number, h: number, cx: number, cy: number, r: number): Float32Array {
    const img = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d <= r) img[y * w + x] = 1 - d / r
      }
    }
    return img
  }

  it('orders structured blob above fragmented islands, and vetoes 1-px speckle', () => {
    const blob = gradedDisc(W, H, 20, 20, 6)
    // 碎片化：散布的 3×3 岛（开运算的最小存活尺寸），强度多样
    let seed = 42
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    const islands = new Float32Array(W * H)
    for (let b = 0; b < 25; b++) {
      const x0 = 1 + Math.floor(rnd() * 36)
      const y0 = 1 + Math.floor(rnd() * 36)
      for (let dy = 0; dy < 3; dy++)
        for (let dx = 0; dx < 3; dx++) islands[(y0 + dy) * W + x0 + dx] = 0.4 + rnd() * 0.6
    }
    const speckle = new Float32Array(W * H)
    for (let i = 0; i < speckle.length; i += 7) speckle[i] = ((i % 5) + 1) / 5
    const blobScore = measureOfChaos(blob, W, H)!
    const islScore = measureOfChaos(islands, W, H)!
    expect(blobScore).toBeGreaterThan(0.9)
    expect(islScore).toBeGreaterThan(0.8) // 度量对 ≥3px 岛的动态范围本身偏窄
    expect(blobScore).toBeGreaterThan(islScore)
    // 1-px 散点：各层对象全被开运算抹除 → 计数全同 → null（pySM 的 NaN，
    // 管线按 fillna(0) 语义进 MSM）
    expect(measureOfChaos(speckle, W, H)).toBeNull()
  })

  it('returns null for empty images and flat (single-level) images', () => {
    expect(measureOfChaos(null, W, H)).toBeNull()
    expect(measureOfChaos(new Float32Array(W * H), W, H)).toBeNull()
    // 平坦图（所有非零像素同值 → 归一化后全 1）：每层连通域计数相同
    // → 参考实现返回 NaN（本管线语义化为 null）
    const flat = rect(W, H, 5, 5, 34, 34, 0.5)
    expect(measureOfChaos(flat, W, H)).toBeNull()
  })

  it('handles size mismatch gracefully', () => {
    expect(measureOfChaos(new Float32Array(10), 4, 4)).toBeNull()
  })
})

describe('isotopePatternMatch (ρ_spectral 参考)', () => {
  const N = 100
  it('returns ~1 for a matching image pattern and penalizes deviations', () => {
    const m = rect(10, 10, 2, 2, 7, 7, 100)
    const sat = rect(10, 10, 2, 2, 7, 7, 30) // M+1 ≈ 30%
    const perfect = isotopePatternMatch([m, sat], [1, 0.3])!
    expect(perfect).toBeGreaterThan(0.98)
    const halved = isotopePatternMatch([m, rect(10, 10, 2, 2, 7, 7, 15)], [1, 0.3])!
    expect(halved).toBeLessThan(perfect)
    const absent = isotopePatternMatch([m, new Float32Array(N)], [1, 0.3])!
    expect(absent).toBeLessThan(halved)
    expect(absent).toBeGreaterThan(0.7) // 参考公式的宽容性：缺 M+1 也不归零
  })

  it('masks by the M image (satellite signal outside the mask is ignored)', () => {
    const m = rect(10, 10, 0, 0, 4, 9, 100)
    const satSameRegion = rect(10, 10, 0, 0, 4, 9, 30)
    const satOtherRegion = rect(10, 10, 5, 0, 9, 9, 30)
    const inside = isotopePatternMatch([m, satSameRegion], [1, 0.3])!
    const outside = isotopePatternMatch([m, satOtherRegion], [1, 0.3])!
    expect(inside).toBeGreaterThan(0.98)
    expect(outside).toBeLessThan(inside) // 掩码外强度不计入
  })

  it('returns 0 on a degenerate exact match and null on empty inputs', () => {
    // 单峰向量归一化后完全一致 → 参考守卫返回 0
    expect(normalizedIntensityMatch([1], [500])).toBe(0)
    expect(isotopePatternMatch([new Float32Array(N)], [1])).toBeNull()
  })
})

describe('isotopeImageCorrelation (ρ_spatial 参考)', () => {
  const N = 60
  it('returns ~1 for co-varying images and 0 for a zero satellite', () => {
    const m = new Float32Array(N)
    const sat = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      m[i] = (i % 10) + 1
      sat[i] = 2 * ((i % 10) + 1)
    }
    expect(isotopeImageCorrelation([m, sat])!).toBeCloseTo(1, 4)
    // 零方差卫星（参考：相关未定义 → 0）
    expect(isotopeImageCorrelation([m, new Float32Array(N)])!).toBe(0)
  })

  it('clips negative correlation to 0 and weights by theory intensities', () => {
    const m = new Float32Array(N)
    const anti = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      m[i] = (i % 10) + 1
      anti[i] = m[i]! === 1 ? 5 : 1 // 粗略反相关
    }
    const r = isotopeImageCorrelation([m, anti])!
    expect(r).toBeGreaterThanOrEqual(0)
    // 两颗卫星：权重让强理论峰主导
    const s1 = new Float32Array(m) // 完全相关
    const s2 = anti // 反相关
    const weighted = isotopeImageCorrelation([m, s1, s2], [0.3, 0.001])!
    expect(weighted).toBeGreaterThan(0.8)
  })

  it('returns 0 with fewer than 2 images or a tiny mask', () => {
    const m = rect(10, 10, 0, 0, 9, 9, 1)
    expect(isotopeImageCorrelation([m])).toBe(0)
    const tiny = new Float32Array(N)
    tiny[3] = 5
    expect(isotopeImageCorrelation([tiny, tiny])).toBe(0) // 掩码像素 < 2
  })
})

describe('hotspotClip', () => {
  it('caps values at the given percentile without touching the array', () => {
    const img = new Float32Array(100)
    for (let i = 0; i < 99; i++) img[i] = 1
    img[99] = 1000
    const out = hotspotClip(img, 99)
    expect(out[99]).toBeLessThanOrEqual(2) // 截到 p99
    expect(out[0]).toBe(1)
    expect(img[99]).toBe(1000) // 原数组不变
  })

  it('passes through all-zero images', () => {
    const img = new Float32Array(10)
    expect(hotspotClip(img, 99)).toBe(img)
  })
})
