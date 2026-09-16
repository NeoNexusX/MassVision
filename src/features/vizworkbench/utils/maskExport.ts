/**
 * Mask export utilities.
 *
 * ROI masks and KMeans cluster masks are both H×W boolean rasters. Any number
 * of them can be OR-ed together into a SINGLE binary mask (1 = the pixel
 * belongs to at least one selected region) and downloaded as .npy or .csv.
 */

export type ExportFormat = 'npy' | 'csv'

/** What the export panel selects; resolved to one merged mask by the parent. */
export interface MaskExportPayload {
  format: ExportFormat
  roiIds: string[]
  clusterIds: number[]
}

// ── helpers ──────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Defer revocation: revoking synchronously can cancel the download in some
  // browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Sanitise a label for use as a filename component. */
function safeFilename(label: string): string {
  const cleaned = label.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60)
  return cleaned || 'mask'
}

// ── .npy (NumPy format, shape [height, width], dtype=uint8) ──────

/**
 * Serialise a boolean[][] mask as a minimal .npy file.
 *
 * The output is equivalent to `np.asarray(mask, dtype=np.uint8)` —
 * each pixel is 0 (false) or 1 (true), layout is row-major (C order).
 *
 * Format reference: https://numpy.org/devdocs/reference/generated/numpy.lib.format.html
 *   Header structure (before data):
 *     \x93NUMPY  — 6-byte magic
 *     \x01       — major version
 *     \x00       — minor version
 *     uint16 LE — header length (len(dict_str) + 1, for the trailing \n)
 *     <dict>    — e.g. "{'descr': '|u1', 'fortran_order': False, 'shape': (H, W), }"
 *     \n        — padded so (6+2+header_len) % 64 == 0
 */
function maskToNpy(mask: boolean[][]): Uint8Array<ArrayBuffer> {
  const height = mask.length
  const width = mask[0]?.length ?? 0

  // Build the Python dict string (must end with newline; pad to 64-byte alignment)
  const dictStr = `{'descr': '|u1', 'fortran_order': False, 'shape': (${height}, ${width}), }\n`

  // Total bytes before data = 6 (magic) + 2 (version bytes) + 2 (header_len uint16) + dictStr
  // Must be divisible by 64. Pad with spaces inserted before the trailing \n.
  const prefixLen = 6 + 2 // \x93NUMPY + \x01\x00
  const headerLenField = 2 // uint16
  const headerLen = dictStr.length // includes trailing \n
  const preambleBytes = prefixLen + headerLenField + headerLen
  const paddedLen = Math.ceil(preambleBytes / 64) * 64
  const padding = paddedLen - preambleBytes
  const paddedDict = dictStr.slice(0, -1) + ' '.repeat(padding) + '\n'

  const headerLenVal = paddedDict.length // includes trailing \n
  const dataBytes = height * width
  const totalBytes = prefixLen + headerLenField + headerLenVal + dataBytes
  const buf = new ArrayBuffer(totalBytes)
  const view = new DataView(buf)

  // Magic: \x93NUMPY
  view.setUint8(0, 0x93)
  for (let i = 0; i < 5; i++) view.setUint8(1 + i, 'NUMPY'.charCodeAt(i))
  // Version: 1.0
  view.setUint8(6, 1)
  view.setUint8(7, 0)
  // Header length (little-endian uint16)
  view.setUint16(8, headerLenVal, true)

  // Dict string
  const strOffset = 10
  for (let i = 0; i < paddedDict.length; i++) {
    view.setUint8(strOffset + i, paddedDict.charCodeAt(i))
  }

  // Pixel data (row-major, uint8: 0/1)
  let off = strOffset + paddedDict.length
  for (let r = 0; r < height; r++) {
    const row = mask[r]!
    for (let c = 0; c < width; c++) {
      view.setUint8(off++, row[c] ? 1 : 0)
    }
  }

  return new Uint8Array(buf)
}

// ── .csv (0/1 integers, one row per line) ────────────────────────

function maskToCsv(mask: boolean[][]): string {
  return mask.map((row) => row.map((v) => (v ? '1' : '0')).join(',')).join('\n')
}

// ── mask composition ─────────────────────────────────────────────

/** All-false mask of the given size, indexed [row][col]. */
export function createMask(width: number, height: number): boolean[][] {
  const mask: boolean[][] = new Array(height)
  for (let r = 0; r < height; r++) mask[r] = new Array<boolean>(width).fill(false)
  return mask
}

/**
 * OR `src` into `dest` in place: a destination pixel becomes true if either
 * side is true. Sizes are assumed to match; rows/cols beyond either raster are
 * skipped defensively.
 */
export function orMask(dest: boolean[][], src: boolean[][]): void {
  const rows = Math.min(dest.length, src.length)
  for (let r = 0; r < rows; r++) {
    const destRow = dest[r]!
    const srcRow = src[r]!
    const cols = Math.min(destRow.length, srcRow.length)
    for (let c = 0; c < cols; c++) {
      if (srcRow[c]) destRow[c] = true
    }
  }
}

/**
 * Merge the given KMeans clusters into a binary mask: a pixel is foreground
 * when its label is one of `clusterIds`. Background (label -1) is therefore
 * always excluded.
 */
export function labelsToUnionMask(
  labels: Int32Array,
  width: number,
  height: number,
  clusterIds: Iterable<number>,
): boolean[][] {
  const selected = new Set(clusterIds)
  const mask: boolean[][] = new Array(height)
  for (let r = 0; r < height; r++) {
    const row = new Array<boolean>(width)
    const off = r * width
    for (let c = 0; c < width; c++) {
      row[c] = selected.has(labels[off + c]!)
    }
    mask[r] = row
  }
  return mask
}

// ── public API ───────────────────────────────────────────────────

/** Download a single mask as .npy (uint8) or .csv (0/1 integers). */
export function exportMask(mask: boolean[][], format: ExportFormat, name = 'mask'): void {
  const base = safeFilename(name)
  if (format === 'npy') {
    triggerDownload(
      new Blob([maskToNpy(mask)], { type: 'application/octet-stream' }),
      `${base}.npy`,
    )
  } else {
    triggerDownload(new Blob([maskToCsv(mask)], { type: 'text/csv' }), `${base}.csv`)
  }
}
