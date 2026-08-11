/**
 * Reference ROI import — masks pre-computed from an external region
 * annotation image (e.g. the paper's Fig-3a cancerous/para-carcinoma map)
 * by scripts/figMaskToRois.mjs, stored as RLE bitmasks over the MSI grid.
 *
 * The local result page fetches `reference/<dataset>.rois.json` and
 * registers each entry as a confirmed ROI, making pathology-grade regions
 * available to the region-comparison flow.
 */

export interface ReferenceRoiEntry {
  id: string
  label: string
  color: string
  pixelCount: number
  /** Runs of 0/1 over the row-major grid, starting with a 0-run. */
  mask_rle: number[]
}

export interface ReferenceRoiFile {
  grid: { width: number; height: number }
  source?: string
  alignment?: { orientation?: string; iou?: number }
  rois: ReferenceRoiEntry[]
}

export async function fetchReferenceRois(url: string): Promise<ReferenceRoiFile> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
  const data = (await resp.json()) as ReferenceRoiFile
  if (!data?.grid?.width || !data?.grid?.height || !Array.isArray(data?.rois)) {
    throw new Error('invalid reference ROI file')
  }
  return data
}

export function decodeRleMask(rle: number[], width: number, height: number): boolean[][] {
  const mask: boolean[][] = Array.from({ length: height }, () =>
    new Array<boolean>(width).fill(false),
  )
  let idx = 0
  let value = false // first run is zeros
  for (const run of rle) {
    if (value) {
      for (let k = 0; k < run && idx < width * height; k++, idx++) {
        mask[(idx / width) | 0]![idx % width] = true
      }
    } else {
      idx += run
    }
    value = !value
  }
  return mask
}
