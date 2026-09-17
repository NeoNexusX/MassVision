import { describe, expect, it } from 'vitest'
import {
  CHANNEL_BACKGROUND,
  ION_CHANNEL_COLORS,
  MAX_ION_CHANNELS,
  blendChannelImage,
  computeChannelRange,
  createRangeCache,
} from '../ionChannelBlend'

const RED = ION_CHANNEL_COLORS[0]!
const GREEN = ION_CHANNEL_COLORS[1]!
const BLUE = ION_CHANNEL_COLORS[2]!

/** 200 pixels: indices < lowCount are 0, the rest are `high`. P1=0, P95=high. */
function stepMatrix(lowCount: number, high: number, n = 200): Float32Array {
  const m = new Float32Array(n)
  for (let i = lowCount; i < n; i++) m[i] = high
  return m
}

/** Identity ramp 0..199 → P1=2, P95=190, span=188. Index i holds value i. */
const ramp = Float32Array.from({ length: 200 }, (_, i) => i)
/** Same shape, 10× scale → P1=20, P95=1900, span=1880. */
const ramp10 = Float32Array.from({ length: 200 }, (_, i) => i * 10)

/** cols=200, rows=1 → n=200, so matrix index === pixel index. */
const COLS = 200
const ROWS = 1

function pixel(rgba: Uint8ClampedArray, i: number): [number, number, number, number] {
  return [rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!, rgba[i * 4 + 3]!]
}

describe('computeChannelRange', () => {
  it('returns P1 and P95 of the matrix', () => {
    expect(computeChannelRange(ramp)).toEqual({ p1: 2, p95: 190 })
  })

  it('keeps a non-zero span for a constant matrix', () => {
    const flat = new Float32Array(200).fill(7)
    const { p1, p95 } = computeChannelRange(flat)
    expect(p95).toBeGreaterThan(p1)
    expect(Number.isFinite(p95 - p1)).toBe(true)
  })

  it('handles an all-zero matrix without NaN', () => {
    const zeros = new Float32Array(200)
    const { p1, p95 } = computeChannelRange(zeros)
    expect(p95 - p1).toBeGreaterThan(0)
  })

  it('caches by matrix identity', () => {
    const cache = createRangeCache()
    const first = computeChannelRange(ramp, cache)
    // Mutating the array in place must NOT change the cached range — the cache
    // is keyed on identity, and channels never mutate a loaded matrix.
    expect(computeChannelRange(ramp, cache)).toBe(first)
  })
})

describe('blendChannelImage', () => {
  it('maps a single channel to its pure color at P95', () => {
    const rgba = blendChannelImage([{ matrix: stepMatrix(10, 100), color: RED }], COLS, ROWS, {
      background: CHANNEL_BACKGROUND,
    })
    // Index 50 is a foreground pixel at the max value → full red.
    expect(pixel(rgba, 50)).toEqual([255, 0, 0, 255])
  })

  it('leaves zero pixels as the opaque background', () => {
    const rgba = blendChannelImage([{ matrix: stepMatrix(10, 100), color: RED }], COLS, ROWS, {
      background: CHANNEL_BACKGROUND,
    })
    expect(pixel(rgba, 5)).toEqual([0x0a, 0x0a, 0x0f, 255])
  })

  it('leaves zero pixels transparent when background is null', () => {
    const rgba = blendChannelImage([{ matrix: stepMatrix(10, 100), color: RED }], COLS, ROWS, {
      background: null,
    })
    expect(pixel(rgba, 5)).toEqual([0, 0, 0, 0])
    // Foreground stays opaque even on the transparent-background path.
    expect(pixel(rgba, 50)).toEqual([255, 0, 0, 255])
  })

  it('adds red + green into yellow', () => {
    const rgba = blendChannelImage(
      [
        { matrix: stepMatrix(10, 100), color: RED },
        { matrix: stepMatrix(10, 100), color: GREEN },
      ],
      COLS,
      ROWS,
      { background: CHANNEL_BACKGROUND },
    )
    expect(pixel(rgba, 50)).toEqual([255, 255, 0, 255])
  })

  it('clamps summed channels to 255', () => {
    const rgba = blendChannelImage(
      [
        { matrix: stepMatrix(10, 100), color: RED },
        { matrix: stepMatrix(10, 100), color: GREEN },
        { matrix: stepMatrix(10, 100), color: BLUE },
      ],
      COLS,
      ROWS,
      { background: CHANNEL_BACKGROUND },
    )
    expect(pixel(rgba, 50)).toEqual([255, 255, 255, 255])
  })

  it('normalizes each channel by its own range', () => {
    // ramp and ramp10 are 10× apart in absolute intensity, but index 96 sits at
    // 0.5 of each channel's own P1–P95 span — so both contribute half color.
    const rgba = blendChannelImage(
      [
        { matrix: ramp, color: RED },
        { matrix: ramp10, color: GREEN },
      ],
      COLS,
      ROWS,
      { background: CHANNEL_BACKGROUND },
    )
    expect(pixel(rgba, 96)).toEqual([128, 128, 0, 255])
  })

  it('skips pixels outside the ROI mask', () => {
    const mask = new Uint8Array(COLS * ROWS).fill(1)
    mask[50] = 0
    const rgba = blendChannelImage([{ matrix: stepMatrix(10, 100), color: RED }], COLS, ROWS, {
      background: CHANNEL_BACKGROUND,
      mask,
    })
    expect(pixel(rgba, 50)).toEqual([0x0a, 0x0a, 0x0f, 255])
    expect(pixel(rgba, 60)).toEqual([255, 0, 0, 255])
  })

  it('ignores channels whose matrix does not match the canvas size', () => {
    const rgba = blendChannelImage(
      [{ matrix: new Float32Array(10).fill(100), color: RED }],
      COLS,
      ROWS,
      { background: CHANNEL_BACKGROUND },
    )
    expect(pixel(rgba, 50)).toEqual([0x0a, 0x0a, 0x0f, 255])
  })

  it('produces a fully background image for no channels', () => {
    const rgba = blendChannelImage([], COLS, ROWS, { background: CHANNEL_BACKGROUND })
    expect(rgba.length).toBe(COLS * ROWS * 4)
    expect(pixel(rgba, 0)).toEqual([0x0a, 0x0a, 0x0f, 255])
  })
})

describe('ION_CHANNEL_COLORS', () => {
  it('exposes six distinct valid colors', () => {
    expect(ION_CHANNEL_COLORS).toHaveLength(6)
    expect(MAX_ION_CHANNELS).toBe(6)
    const seen = new Set<string>()
    for (const c of ION_CHANNEL_COLORS) {
      for (const v of [c.r, c.g, c.b]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(255)
      }
      seen.add(`${c.r},${c.g},${c.b}`)
    }
    expect(seen.size).toBe(6)
  })
})
