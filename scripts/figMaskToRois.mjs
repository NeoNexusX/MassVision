/**
 * Convert the paper's Fig-3a region annotation (blue = cancerous / IDC,
 * gray = para-carcinoma) into two pixel-precise ROIs on the MSI grid of
 * public/combin.zarr.
 *
 * Pipeline:
 *   1. Segment the figure: blue / light-gray tissue classes (black labels
 *      and scale bar, white background are excluded). Gray classification
 *      is contaminated by anti-aliased text edges, so gray connected
 *      components smaller than MIN_GRAY_COMPONENT are dropped; blue is
 *      strict enough to keep all components.
 *   2. Align: search 4 orientations x (scale, dx, dy) around the tissue
 *      bounding box, scoring the mapped tissue silhouette against the
 *      zarr's real foreground pixels (stats/tic > 0 — axes/coordinates
 *      covers the full acquisition rectangle, not the tissue silhouette)
 *      by IoU. A summed-
 *      area table makes each candidate evaluation O(grid). Paper figures
 *      are often y-flipped.
 *   3. Majority-vote sampling: each grid cell gathers the figure pixels in
 *      its source rect; the dominant class wins (scale-bar / label holes
 *      lose the vote). A 3x3 median filter cleans speckles. Only real MSI
 *      foreground pixels get assigned.
 *   4. Write public/reference/combin.rois.json (RLE masks) + preview PNGs
 *      for visual verification.
 *
 * Usage: node scripts/figMaskToRois.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { ZSTDDecoder } from 'zstddec'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ZARR = path.join(ROOT, 'public', 'combin.zarr')
const FIG = path.join(ROOT, 'public', 'QQ_1786380808665.png')
const OUT_DIR = path.join(ROOT, 'public', 'reference')
const OUT_JSON = path.join(OUT_DIR, 'combin.rois.json')
const OUT_PREVIEW = path.join(OUT_DIR, 'combin.rois.preview.png')
const OUT_SEG = path.join(OUT_DIR, 'combin.seg.debug.png')

const MIN_GRAY_COMPONENT = 2000

// ---------- zarr helpers ----------

async function readZarrArrayFull(zarrRoot, arrayPath, Ctor) {
  const meta = JSON.parse(fs.readFileSync(path.join(zarrRoot, arrayPath, 'zarr.json'), 'utf8'))
  const dec = new ZSTDDecoder()
  await dec.init()
  const shape = meta.shape
  const cs = meta.chunk_grid.configuration.chunk_shape
  const total = shape.reduce((a, b) => a * b, 1)
  const out = new Ctor(total)
  const counts = shape.map((s, i) => Math.ceil(s / cs[i]))
  const ndim = shape.length
  const coordsList = []
  const enumerate = (d, acc) => {
    if (d === ndim) { coordsList.push([...acc]); return }
    for (let i = 0; i < counts[d]; i++) { acc[d] = i; enumerate(d + 1, acc) }
  }
  enumerate(0, new Array(ndim).fill(0))
  const bpe = out.BYTES_PER_ELEMENT
  for (const cc of coordsList) {
    const key = `c/${cc.join('/')}`
    const raw = fs.readFileSync(path.join(zarrRoot, arrayPath, key))
    const payload = dec.decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength))
    const origin = cc.map((c, d) => c * cs[d])
    const actual = cc.map((c, d) => Math.min(cs[d], shape[d] - origin[d]))
    const view = new Ctor(payload.buffer, payload.byteOffset, payload.byteLength / bpe)
    const chunkStrides = new Array(ndim)
    chunkStrides[ndim - 1] = 1
    for (let i = ndim - 2; i >= 0; i--) chunkStrides[i] = chunkStrides[i + 1] * actual[i + 1]
    const fullStrides = new Array(ndim)
    fullStrides[ndim - 1] = 1
    for (let i = ndim - 2; i >= 0; i--) fullStrides[i] = fullStrides[i + 1] * shape[i + 1]
    let outer = 1
    for (let i = 0; i < ndim - 1; i++) outer *= actual[i]
    for (let r = 0; r < outer; r++) {
      let rem = r, chunkOff = 0, fullOff = 0
      for (let d = ndim - 2; d >= 0; d--) {
        const k = rem % actual[d]
        rem = Math.floor(rem / actual[d])
        chunkOff += k * chunkStrides[d]
        fullOff += (origin[d] + k) * fullStrides[d]
      }
      fullOff += origin[ndim - 1]
      out.set(view.subarray(chunkOff, chunkOff + actual[ndim - 1]), fullOff)
    }
  }
  return { data: out, shape }
}

// ---------- segmentation ----------

const NONE = 0, BLUE = 1, GRAY = 2

function classify(r, g, b) {
  // saturated blue (tolerates compression artifacts at edges)
  if (b > 110 && b - r > 50 && b - g > 50) return BLUE
  // light neutral gray (tissue background in the figure)
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  if (mx - mn < 30 && mx >= 140 && mx <= 225) return GRAY
  return NONE
}

/** Connected components (4-neighborhood) of the requested class; returns
 *  a cleaned class map where small components of that class are removed. */
function dropSmallComponents(cls, W, H, klass, minArea) {
  const label = new Int32Array(W * H).fill(-1)
  const out = new Uint8Array(cls)
  const stack = []
  let nextLabel = 0
  for (let i = 0; i < W * H; i++) {
    if (cls[i] !== klass || label[i] >= 0) continue
    // flood fill
    const members = []
    stack.length = 0
    stack.push(i)
    label[i] = nextLabel
    while (stack.length) {
      const p = stack.pop()
      members.push(p)
      const x = p % W, y = (p / W) | 0
      if (x > 0 && cls[p - 1] === klass && label[p - 1] < 0) { label[p - 1] = nextLabel; stack.push(p - 1) }
      if (x < W - 1 && cls[p + 1] === klass && label[p + 1] < 0) { label[p + 1] = nextLabel; stack.push(p + 1) }
      if (y > 0 && cls[p - W] === klass && label[p - W] < 0) { label[p - W] = nextLabel; stack.push(p - W) }
      if (y < H - 1 && cls[p + W] === klass && label[p + W] < 0) { label[p + W] = nextLabel; stack.push(p + W) }
    }
    if (members.length < minArea) {
      for (const p of members) out[p] = NONE
    }
    nextLabel++
  }
  return { out, components: nextLabel }
}

function segmentFigure(png) {
  const { width: W, height: H, data } = png
  let cls = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    cls[i] = classify(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
  }
  const before = cls.reduce((a, c) => a + (c === GRAY ? 1 : 0), 0)
  const cleaned = dropSmallComponents(cls, W, H, GRAY, MIN_GRAY_COMPONENT)
  cls = cleaned.out
  let nBlue = 0, nGray = 0
  for (const c of cls) {
    if (c === BLUE) nBlue++
    else if (c === GRAY) nGray++
  }
  console.log(`gray components: ${cleaned.components}, gray px ${before} -> ${nGray} (dropped ${before - nGray} of text/scale-bar contamination)`)
  return { cls, W, H, nBlue, nGray }
}

function bboxOf(cls, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (cls[y * W + x] === NONE) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

// ---------- alignment ----------

// orientation maps normalized (u,v) in [0,1] -> flipped normalized coords
const TRANSFORMS = {
  identity: (u, v) => [u, v],
  flipX: (u, v) => [1 - u, v],
  flipY: (u, v) => [u, 1 - v],
  flipXY: (u, v) => [1 - u, 1 - v],
}

/** Summed-area table of a binary mask for O(1) rect sums. */
function summedAreaTable(bits, W, H) {
  const sat = new Float64Array((W + 1) * (H + 1))
  for (let y = 0; y < H; y++) {
    let rowSum = 0
    for (let x = 0; x < W; x++) {
      rowSum += bits[y * W + x]
      sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1] + rowSum
    }
  }
  return (x0, y0, x1, y1) => {
    // inclusive coords, clamped
    x0 = Math.max(0, x0); y0 = Math.max(0, y0)
    x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1)
    if (x1 < x0 || y1 < y0) return 0
    return (
      sat[(y1 + 1) * (W + 1) + x1 + 1] -
      sat[y0 * (W + 1) + x1 + 1] -
      sat[(y1 + 1) * (W + 1) + x0] +
      sat[y0 * (W + 1) + x0]
    )
  }
}

/**
 * A mapping: source rect (cx, cy, w, h) in figure pixels + orientation.
 * Grid cell (gx,gy) <- source rect via normalized coordinates.
 */
function cellSourceRect(map, gx, gy, gw, gh) {
  const [u0, v0] = map.tf(gx / gw, gy / gh)
  const [u1, v1] = map.tf((gx + 1) / gw, (gy + 1) / gh)
  return [
    Math.floor(map.cx + Math.min(u0, u1) * map.w),
    Math.floor(map.cy + Math.min(v0, v1) * map.h),
    Math.ceil(map.cx + Math.max(u0, u1) * map.w) - 1,
    Math.ceil(map.cy + Math.max(v0, v1) * map.h) - 1,
  ]
}

/** Tissue silhouette of the mapped grid (a cell is tissue if its source
 *  rect contains any tissue-class figure pixel). */
function silhouetteIoU(map, gw, gh, rectSum, fg, W, H) {
  let inter = 0, union = 0
  const cellArea = Math.max(1, Math.round((map.w / gw) * (map.h / gh)))
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const [sx0, sy0, sx1, sy1] = cellSourceRect(map, gx, gy, gw, gh)
      const n = rectSum(sx0, sy0, sx1, sy1)
      const isTissue = n / cellArea >= 0.25 // quarter covered = tissue
      const isFg = fg[gy * gw + gx] === 1
      if (isTissue && isFg) inter++
      if (isTissue || isFg) union++
    }
  }
  return union ? inter / union : 0
}

function searchAlignment(tissueBits, W, H, bb, fg, gw, gh) {
  const rectSum = summedAreaTable(tissueBits, W, H)
  let best = null
  const consider = (name, tf, cx, cy, w, h) => {
    const map = { tf, cx, cy, w, h }
    const score = silhouetteIoU(map, gw, gh, rectSum, fg, W, H)
    if (!best || score > best.score) best = { name, tf, cx, cy, w, h, score }
  }
  for (const [name, tf] of Object.entries(TRANSFORMS)) {
    // coarse
    for (let s = 0.94; s <= 1.061; s += 0.01) {
      const w = bb.w * s, h = bb.h * s
      for (let dx = -20; dx <= 20; dx += 4) {
        for (let dy = -20; dy <= 20; dy += 4) {
          consider(name, tf, bb.x0 + (bb.w - w) / 2 + dx, bb.y0 + (bb.h - h) / 2 + dy, w, h)
        }
      }
    }
  }
  // fine around the winner
  const b = best
  for (let s = -0.008; s <= 0.0081; s += 0.004) {
    const w = b.w * (1 + s), h = b.h * (1 + s)
    for (let dx = -3; dx <= 3; dx += 1) {
      for (let dy = -3; dy <= 3; dy += 1) {
        consider(b.name, b.tf, b.cx + (b.w - w) / 2 + dx, b.cy + (b.h - h) / 2 + dy, w, h)
      }
    }
  }
  return best
}

/** Final per-cell majority vote of figure classes under the best mapping. */
function sampleGrid(cls, W, H, map, gw, gh) {
  const grid = new Uint8Array(gw * gh)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const [sx0, sy0, sx1, sy1] = cellSourceRect(map, gx, gy, gw, gh)
      let nb = 0, ng = 0
      for (let sy = Math.max(0, sy0); sy <= Math.min(H - 1, sy1); sy++) {
        for (let sx = Math.max(0, sx0); sx <= Math.min(W - 1, sx1); sx++) {
          const c = cls[sy * W + sx]
          if (c === BLUE) nb++
          else if (c === GRAY) ng++
        }
      }
      const total = nb + ng
      if (total > 0 && Math.max(nb, ng) >= 2) {
        grid[gy * gw + gx] = nb >= ng ? BLUE : GRAY
      }
    }
  }
  return grid
}

function medianFilter(grid, gw, gh) {
  const out = new Uint8Array(grid)
  for (let y = 1; y < gh - 1; y++) {
    for (let x = 1; x < gw - 1; x++) {
      const vals = []
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          vals.push(grid[(y + dy) * gw + (x + dx)])
      vals.sort((p, q) => p - q)
      out[y * gw + x] = vals[4]
    }
  }
  return out
}

/**
 * Nearest-class fill (two-pass chamfer): unclassified TISSUE cells inherit
 * the class of their nearest classified cell. The figure's silhouette is
 * slightly eroded at the edges (anti-aliased border pixels classify NONE),
 * so without this ~5% of tissue stays unassigned; fill error is confined
 * to a 1-2 grid-cell band along the boundary.
 */
function nearestClassFill(grid, gw, gh, fg) {
  const INF = 1e9
  const dist = new Float64Array(gw * gh)
  const cls = new Uint8Array(grid)
  for (let i = 0; i < gw * gh; i++) dist[i] = grid[i] !== NONE ? 0 : INF
  const relax = (i, j, w) => {
    if (dist[j] + w < dist[i]) { dist[i] = dist[j] + w; cls[i] = cls[j] }
  }
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x
      if (x > 0) relax(i, i - 1, 1)
      if (y > 0) relax(i, i - gw, 1)
      if (x > 0 && y > 0) relax(i, i - gw - 1, 1.5)
      if (x < gw - 1 && y > 0) relax(i, i - gw + 1, 1.5)
    }
  }
  for (let y = gh - 1; y >= 0; y--) {
    for (let x = gw - 1; x >= 0; x--) {
      const i = y * gw + x
      if (x < gw - 1) relax(i, i + 1, 1)
      if (y < gh - 1) relax(i, i + gw, 1)
      if (x < gw - 1 && y < gh - 1) relax(i, i + gw + 1, 1.5)
      if (x > 0 && y < gh - 1) relax(i, i + gw - 1, 1.5)
    }
  }
  // Only tissue cells inherit; non-tissue stays NONE.
  const out = new Uint8Array(grid)
  for (let i = 0; i < gw * gh; i++) {
    if (out[i] === NONE && fg[i] && dist[i] < INF) out[i] = cls[i]
  }
  return out
}

// ---------- RLE ----------

function encodeRle(bits) {
  const runs = []
  let cur = 0, len = 0
  for (const b of bits) {
    const v = b ? 1 : 0
    if (v === cur) len++
    else { runs.push(len); cur = v; len = 1 }
  }
  runs.push(len)
  return runs
}

// ---------- preview PNG ----------

function writePreview(file, gw, gh, fg, grid) {
  const png = new PNG({ width: gw, height: gh })
  for (let i = 0; i < gw * gh; i++) {
    let r = 18, g = 18, b = 18
    if (grid[i] === BLUE) { r = 30; g = 100; b = 235 }
    else if (grid[i] === GRAY) { r = 190; g = 190; b = 190 }
    else if (fg[i]) { r = 80; g = 60; b = 60 } // unassigned tissue = dark red
    png.data[i * 4] = r; png.data[i * 4 + 1] = g; png.data[i * 4 + 2] = b
    png.data[i * 4 + 3] = 255
  }
  fs.writeFileSync(file, PNG.sync.write(png))
}

// ---------- main ----------

const rootAttrs = JSON.parse(fs.readFileSync(path.join(ZARR, 'zarr.json'), 'utf8')).attributes
const [gh, gw] = rootAttrs.spatial_shape
console.log(`grid: ${gw}x${gh}`)

// The real tissue mask is stats/tic > 0 (26,237 empty acquisition cells
// have TIC = 0; metadata/mask is all-ones in this file, and the UMAP
// foreground count matches the non-zero TIC count exactly).
const { data: ticData } = await readZarrArrayFull(ZARR, 'stats/tic', Float64Array)
const fg = new Uint8Array(gw * gh)
let nTissue = 0
for (let i = 0; i < gw * gh; i++) {
  if (ticData[i] !== 0) { fg[i] = 1; nTissue++ }
}
console.log(`tissue pixels (stats/tic > 0): ${nTissue}`)

const png = PNG.sync.read(fs.readFileSync(FIG))
console.log(`figure: ${png.width}x${png.height}`)
const { cls, W, H, nBlue, nGray } = segmentFigure(png)
console.log(`segmented (clean): blue=${nBlue}, gray=${nGray}`)

const bb = bboxOf(cls, W, H)
console.log(`tissue bbox: x[${bb.x0},${bb.x1}] y[${bb.y0},${bb.y1}] (${bb.w}x${bb.h}, aspect ${(bb.w / bb.h).toFixed(3)} vs grid ${(gw / gh).toFixed(3)})`)

const tissueBits = new Uint8Array(W * H)
for (let i = 0; i < W * H; i++) tissueBits[i] = cls[i] !== NONE ? 1 : 0

const best = searchAlignment(tissueBits, W, H, bb, fg, gw, gh)
console.log(`best alignment: orientation=${best.name}, IoU=${best.score.toFixed(4)}`)
console.log(`  source rect: (${best.cx.toFixed(1)}, ${best.cy.toFixed(1)}) ${best.w.toFixed(1)}x${best.h.toFixed(1)}`)

let grid = sampleGrid(cls, W, H, best, gw, gh)
grid = medianFilter(grid, gw, gh)
grid = nearestClassFill(grid, gw, gh, fg)

let nCancer = 0, nPara = 0, nUnassigned = 0
const cancerBits = new Uint8Array(gw * gh)
const paraBits = new Uint8Array(gw * gh)
for (let i = 0; i < gw * gh; i++) {
  if (!fg[i]) continue
  if (grid[i] === BLUE) { cancerBits[i] = 1; nCancer++ }
  else if (grid[i] === GRAY) { paraBits[i] = 1; nPara++ }
  else nUnassigned++
}
console.log(`assigned: cancer=${nCancer}, para=${nPara}, unassigned tissue=${nUnassigned} (${(100 * nUnassigned / (nTissue || 1)).toFixed(1)}%)`)

fs.mkdirSync(OUT_DIR, { recursive: true })
const payload = {
  grid: { width: gw, height: gh },
  source: path.basename(FIG),
  alignment: {
    orientation: best.name,
    iou: +best.score.toFixed(4),
    sourceRect: {
      x: +best.cx.toFixed(1), y: +best.cy.toFixed(1),
      w: +best.w.toFixed(1), h: +best.h.toFixed(1),
    },
  },
  rois: [
    {
      id: 'ref-cancer',
      label: 'Cancerous (IDC)',
      color: '#2563eb',
      pixelCount: nCancer,
      mask_rle: encodeRle(cancerBits),
    },
    {
      id: 'ref-para',
      label: 'Para-carcinoma',
      color: '#9ca3af',
      pixelCount: nPara,
      mask_rle: encodeRle(paraBits),
    },
  ],
}
fs.writeFileSync(OUT_JSON, JSON.stringify(payload))
console.log(`wrote ${path.relative(ROOT, OUT_JSON)} (${(fs.statSync(OUT_JSON).size / 1024).toFixed(1)} KB)`)

writePreview(OUT_PREVIEW, gw, gh, fg, grid)
console.log(`wrote ${path.relative(ROOT, OUT_PREVIEW)}`)

const dbg = new PNG({ width: W, height: H })
for (let i = 0; i < W * H; i++) {
  const c = cls[i]
  dbg.data[i * 4] = c === BLUE ? 0 : c === GRAY ? 200 : 40
  dbg.data[i * 4 + 1] = c === BLUE ? 0 : c === GRAY ? 200 : 40
  dbg.data[i * 4 + 2] = c === BLUE ? 255 : c === GRAY ? 200 : 40
  dbg.data[i * 4 + 3] = 255
}
fs.writeFileSync(OUT_SEG, PNG.sync.write(dbg))
console.log(`wrote ${path.relative(ROOT, OUT_SEG)}`)
