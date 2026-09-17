/**
 * Multi-ion channel compositing.
 *
 * Each channel is one ion image (Float32Array) mapped to a fixed color. The
 * composite is additive: every visible channel's intensity is normalized by
 * its OWN P1–P95 range, scaled 0..1, multiplied into its channel color, then
 * summed. Two overlapping channels therefore blend (R+G → yellow), which is
 * the standard MSI multi-ion overlay look.
 *
 * Kept as pure functions (no DOM, no canvas) so the blend math is unit
 * testable — jsdom has no 2D canvas context.
 */

import type { RGB } from './regionPalette'

/** Fixed channel colors, in assignment order. Ten slots keep layers distinct. */
export const ION_CHANNEL_COLORS: readonly RGB[] = [
  { r: 255, g: 0, b: 0 }, // red
  { r: 0, g: 255, b: 0 }, // green
  { r: 0, g: 0, b: 255 }, // blue
  { r: 0, g: 255, b: 255 }, // cyan
  { r: 255, g: 0, b: 255 }, // magenta
  { r: 255, g: 255, b: 0 }, // yellow
  { r: 255, g: 128, b: 0 }, // orange
  { r: 128, g: 0, b: 255 }, // violet
  { r: 128, g: 255, b: 0 }, // lime
  { r: 255, g: 0, b: 128 }, // pink
]

/** Hard cap on simultaneous channels (one per fixed color). */
export const MAX_ION_CHANNELS = ION_CHANNEL_COLORS.length

/** Background used when compositing onto an opaque canvas (matches the
 *  single-image renderer's backdrop). */
export const CHANNEL_BACKGROUND: RGB = { r: 0x0a, g: 0x0a, b: 0x0f }

export interface ChannelRange {
  p1: number
  p95: number
}

/** One layer of the composite. Invisible / unloaded layers are omitted by the caller. */
export interface BlendChannel {
  matrix: Float32Array
  color: RGB
  /** Per-layer contribution opacity, 0..1. Omitted means fully opaque. */
  opacity?: number
}

/**
 * Per-matrix P1–P95 range cache. Keyed by the Float32Array identity: matrices
 * are replaced (never mutated) when a channel reloads, and removed channels
 * become GC-eligible automatically. Exported so callers can pass a shared
 * cache across renders.
 */
export function createRangeCache(): WeakMap<Float32Array, ChannelRange> {
  return new WeakMap<Float32Array, ChannelRange>()
}

/**
 * P1–P95 of a matrix, using the same native typed-array numeric sort the
 * single-image renderer uses for its auto range. A degenerate range (all
 * values equal) collapses to 1 so the normalizer never divides by zero.
 */
export function computeChannelRange(
  data: Float32Array,
  cache?: WeakMap<Float32Array, ChannelRange>,
): ChannelRange {
  const cached = cache?.get(data)
  if (cached) return cached

  const sorted = data.slice().sort()
  const p1 = sorted[Math.floor(sorted.length * 0.01)] ?? sorted[0] ?? 0
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1] ?? 1
  // A constant (or all-zero) matrix has p1 === p95; keep the floor at 0 so it
  // renders as black rather than dividing by zero.
  const range: ChannelRange = { p1, p95: p95 > p1 ? p95 : p1 + 1 }
  cache?.set(data, range)
  return range
}

export interface BlendOptions {
  /** Opaque background RGB, or null to leave empty pixels fully transparent
   *  (used by PNG export). */
  background: RGB | null
  /** Optional ROI union mask (1 = visible). Pixels masked out render as background. */
  mask?: Uint8Array | null
  /** Shared per-matrix range cache. */
  rangeCache?: WeakMap<Float32Array, ChannelRange>
}

/**
 * Additively composite the given channels into a fresh RGBA buffer sized
 * cols × rows (row-major, matching the ion matrix layout).
 */
export function blendChannelImage(
  channels: readonly BlendChannel[],
  cols: number,
  rows: number,
  opts: BlendOptions,
): Uint8ClampedArray {
  const n = cols * rows
  const rgba = new Uint8ClampedArray(n * 4)

  // Accumulate each channel's contribution in float so clamping happens once,
  // after summing (that's what makes R+G read as yellow rather than saturating).
  const accR = new Float32Array(n)
  const accG = new Float32Array(n)
  const accB = new Float32Array(n)

  const mask = opts.mask ?? null
  for (const ch of channels) {
    if (ch.matrix.length !== n) continue
    const { p1, p95 } = computeChannelRange(ch.matrix, opts.rangeCache)
    const span = p95 - p1 || 1
    const { r, g, b } = ch.color
    const opacity = Math.max(0, Math.min(1, ch.opacity ?? 1))
    for (let i = 0; i < n; i++) {
      if (mask && !mask[i]) continue
      const v = ch.matrix[i]!
      if (v === 0) continue
      let norm = (v - p1) / span
      if (norm <= 0) continue
      if (norm > 1) norm = 1
      accR[i]! += norm * opacity * r
      accG[i]! += norm * opacity * g
      accB[i]! += norm * opacity * b
    }
  }

  const bg = opts.background
  for (let i = 0; i < n; i++) {
    const r = accR[i]!
    const g = accG[i]!
    const b = accB[i]!
    const off = i * 4
    if (r === 0 && g === 0 && b === 0) {
      // Empty pixel: opaque backdrop, or transparent when exporting.
      if (bg) {
        rgba[off] = bg.r
        rgba[off + 1] = bg.g
        rgba[off + 2] = bg.b
        rgba[off + 3] = 255
      }
      continue
    }
    rgba[off] = r > 255 ? 255 : r
    rgba[off + 1] = g > 255 ? 255 : g
    rgba[off + 2] = b > 255 ? 255 : b
    rgba[off + 3] = 255
  }

  return rgba
}
