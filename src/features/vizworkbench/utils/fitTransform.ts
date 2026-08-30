/**
 * Shared "fit image into container" transform.
 *
 * Single source of truth for the geometry used by the canvas renderer,
 * the ion-image mouse→pixel mapping, and the ROI overlay. All sites must
 * produce identical scale/offset values for a given container + matrix size.
 */

/** Padding ratio on each side so the image doesn't touch container edges. */
export const IMAGE_PAD = 0.04

export interface FitTransform {
  /** Uniform scale (container px per matrix cell). */
  scaleVal: number
  /** Drawn image width in container px. */
  drawW: number
  /** Drawn image height in container px. */
  drawH: number
  /** Image origin X within the container. */
  ox: number
  /** Image origin Y within the container. */
  oy: number
}

/**
 * Compute the fit transform for a `cols`×`rows` matrix inside a `W`×`H`
 * container: IMAGE_PAD padding on each side, uniform scale, centered,
 * floored integer draw size and origin.
 */
export function computeFitTransform(
  W: number,
  H: number,
  cols: number,
  rows: number,
): FitTransform {
  const availW = W * (1 - IMAGE_PAD * 2)
  const availH = H * (1 - IMAGE_PAD * 2)
  const scaleVal = Math.min(availW / cols, availH / rows)
  const drawW = Math.floor(cols * scaleVal)
  const drawH = Math.floor(rows * scaleVal)
  const ox = Math.floor((W - drawW) / 2)
  const oy = Math.floor((H - drawH) / 2)
  return { scaleVal, drawW, drawH, ox, oy }
}

/**
 * Map a container-space point (cx, cy) back to integer matrix cell
 * coordinates using a previously computed FitTransform.
 */
export function fitPointToMatrixCell(
  cx: number,
  cy: number,
  t: FitTransform,
  cols: number,
  rows: number,
): { col: number; row: number } {
  return {
    col: Math.floor(((cx - t.ox) * cols) / t.drawW),
    row: Math.floor(((cy - t.oy) * rows) / t.drawH),
  }
}
