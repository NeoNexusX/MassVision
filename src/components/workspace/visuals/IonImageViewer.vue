<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3 mb-3">
      <div>
        <h3 class="text-sm font-semibold">Ion Image</h3>
        <p class="text-[11px] text-base-content/50">Per-pixel ion intensity heatmap</p>
      </div>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <div class="bg-base-200 rounded-lg px-3 py-1.5 text-xs">
          <span class="text-base-content/50">m/z&nbsp;</span>
          <span class="font-mono font-semibold">{{ selectedMz.toFixed(3) }}</span>
        </div>
        <div class="flex items-center gap-1 text-xs">
          <span class="text-base-content/50">&plusmn;</span>
          <input type="number" class="input input-xs input-bordered w-16 font-mono text-xs"
            :value="mzTolerance" step="0.001" min="0.001"
            @input="$emit('update:mzTolerance', +($event.target as HTMLInputElement).value)" />
        </div>
        <select class="select select-xs select-bordered w-24 text-xs"
          :value="colormap"
          @change="$emit('update:colormap', ($event.target as HTMLSelectElement).value)">
          <option value="viridis">Viridis</option>
          <option value="inferno">Inferno</option>
          <option value="plasma">Plasma</option>
          <option value="gray">Gray</option>
        </select>
        <select class="select select-xs select-bordered w-24 text-xs"
          :value="intensityScale"
          @change="$emit('update:intensityScale', ($event.target as HTMLSelectElement).value)">
          <option value="linear">Linear</option>
          <option value="log">Log</option>
        </select>
        <button class="btn btn-xs btn-ghost" @click="$emit('reset')">Reset</button>
      </div>
    </div>
    <div ref="containerRef"
      class="relative flex-1 min-h-0 bg-base-200 rounded-lg border border-base-300 overflow-hidden cursor-crosshair"
      @mousemove="onHover" @mouseleave="hoverPixel = null">
      <canvas ref="canvasRef" class="absolute inset-0 w-full h-full" />
      <div v-if="hoverPixel"
        class="absolute pointer-events-none bg-base-100/90 backdrop-blur-sm text-[10px] px-2 py-1 rounded shadow border border-base-300 font-mono"
        :style="{ left: hoverPixel.x + 12 + 'px', top: hoverPixel.y + 12 + 'px' }">
        ({{ hoverPixel.col }}, {{ hoverPixel.row }}) — {{ hoverPixel.intensity.toExponential(2) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, type PropType } from 'vue'

const props = defineProps({
  selectedMz: { type: Number, required: true },
  mzTolerance: { type: Number, required: true },
  colormap: { type: String, required: true },
  intensityScale: { type: String, required: true },
  displayMin: { type: Number, default: undefined },
  displayMax: { type: Number, default: undefined },
  matrix: { type: Array as PropType<number[][] | null>, default: null },
})

defineEmits<{
  (e: 'update:mzTolerance', v: number): void
  (e: 'update:colormap', v: string): void
  (e: 'update:intensityScale', v: string): void
  (e: 'reset'): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const hoverPixel = ref<{ x: number; y: number; row: number; col: number; intensity: number } | null>(null)

// --- Colormap LUT ---
const COLORMAP_TABLE: Record<string, [number, number, number][]> = {
  viridis: [[68,1,84],[72,35,116],[64,74,138],[49,104,142],[38,130,142],[31,157,137],[108,206,89],[254,231,37]],
  inferno: [[0,0,4],[27,12,65],[74,12,107],[120,28,109],[165,44,96],[207,68,70],[237,105,37],[249,215,28]],
  plasma: [[13,8,135],[70,3,159],[114,1,168],[156,23,158],[189,55,134],[216,87,107],[237,121,83],[253,180,47]],
  gray: [[0,0,0],[255,255,255]],
}

function buildLUT(name: string): [number, number, number][] {
  const stops = (COLORMAP_TABLE[name] ?? COLORMAP_TABLE.viridis)!
  const lut: [number, number, number][] = new Array(256)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const segment = t * (stops.length - 1)
    const idx = Math.min(Math.floor(segment), stops.length - 2)
    const frac = segment - idx
    const a = stops[idx]!, b = stops[idx + 1]!
    lut[i] = [Math.round(a[0]+(b[0]-a[0])*frac), Math.round(a[1]+(b[1]-a[1])*frac), Math.round(a[2]+(b[2]-a[2])*frac)]
  }
  return lut
}

// --- Mock data ---
// ... (unchanged - kept from existing file)

// --- Mock data: simulated mouse brain coronal section ---
function generateMockMatrix(rows: number, cols: number): number[][] {
  const H = rows, W = cols, cx = W / 2, cy = H * 0.46
  function hash(x: number, y: number, seed = 0): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453; return n - Math.floor(n)
  }
  function smoothNoise(x: number, y: number, scale: number, seed = 0): number {
    const sx = x / scale, sy = y / scale, ix = Math.floor(sx), iy = Math.floor(sy)
    const fx = sx - ix, fy = sy - iy
    const sx1 = fx * fx * (3 - 2 * fx), sy1 = fy * fy * (3 - 2 * fy)
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed)
    return a * (1 - sx1) * (1 - sy1) + b * sx1 * (1 - sy1) + c * (1 - sx1) * sy1 + d * sx1 * sy1
  }
  function brainMask(r: number, c: number): number {
    const nx = (c - cx) / (W * 0.42), ny = (r - cy) / (H * 0.44)
    const dBase = Math.sqrt(nx * nx + ny * ny)
    const wobble = 1 + smoothNoise(c, r, 10, 0) * 0.06 + Math.sin(Math.atan2(ny, nx) * 2 + 0.3) * 0.04
    return 1 / (1 + Math.exp((dBase * wobble - 0.9) * 25))
  }
  function cortexSignal(r: number, c: number): number {
    const d = Math.sqrt(((c - cx) / (W * 0.42)) ** 2 + ((r - cy) / (H * 0.44)) ** 2)
    const rim = Math.max(0, Math.exp(-((1 - d - 0.18) ** 2) / 0.005) * 1.0 + Math.exp(-((1 - d - 0.28) ** 2) / 0.01) * 0.6)
    return rim * (0.8 + smoothNoise(c, r, 6, 10) * 0.2)
  }
  // Midline ventricle — narrow vertical void
  function midlineVentricle(r: number, c: number): number {
    const nx = (c - cx) / (W * 0.015), ny = (r - (cy + H * 0.02)) / (H * 0.15)
    return Math.exp(-nx * nx * 3.0) * Math.exp(-ny * ny * 1.5)
  }
  // Lateral ventricles — small bilateral voids
  function lateralVentricles(r: number, c: number): number {
    let dip = 0
    for (const side of [-1, 1]) {
      const vx = cx + side * W * 0.05, vy = cy - H * 0.08
      const nx = (c - vx) / (W * 0.03), ny = (r - vy) / (H * 0.03)
      dip += Math.exp(-nx * nx * 2.5) * Math.exp(-ny * ny * 2.5)
    }
    return dip
  }
  function hippocampusSignal(r: number, c: number): number {
    let total = 0
    for (const side of [-1, 1]) {
      const hcx = cx + side * W * 0.16, hcy = cy - H * 0.08
      const d = Math.sqrt(((c - hcx) / (W * 0.08)) ** 2 + ((r - hcy) / (H * 0.07)) ** 2)
      total += (Math.exp(-((d - 0.6) ** 2) / 0.05) * 0.8 + Math.exp(-d * d * 1.8) * 0.25) * (0.8 + smoothNoise(c, r, 5, 20 + side) * 0.2)
    }
    return total
  }
  function striatumSignal(r: number, c: number): number {
    let total = 0
    for (const side of [-1, 1]) {
      const scx = cx + side * W * 0.11, scy = cy + H * 0.06
      const d = Math.sqrt(((c - scx) / (W * 0.07)) ** 2 + ((r - scy) / (H * 0.09)) ** 2)
      total += Math.exp(-d * d * 2.5) * (0.35 + smoothNoise(c, r, 5, 30 + side) * 0.65)
    }
    return total
  }
  const BASE = 1.2e6, matrix: number[][] = []
  let gs = 0, gh = false
  function gaussR(): number {
    if (gh) { gh = false; return gs }
    let u = 0, v = 0, s = 0
    while (s >= 1 || s === 0) { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v }
    gs = v * Math.sqrt(-2 * Math.log(s) / s); gh = true
    return u * Math.sqrt(-2 * Math.log(s) / s)
  }
  for (let r = 0; r < H; r++) {
    const row: number[] = []
    for (let c = 0; c < W; c++) {
      const mask = brainMask(r, c)
      const v = 1 - midlineVentricle(r, c) * 0.9 - lateralVentricles(r, c) * 0.85
      let signal = (cortexSignal(r, c) * 1.0 + hippocampusSignal(r, c) * 0.7 + striatumSignal(r, c) * 0.4) * Math.max(0, v)
      signal += 0.04 * smoothNoise(c, r, 15, 50)
      signal = Math.max(0, signal)
      let intensity = signal * mask * BASE
      intensity += gaussR() * BASE * 0.003
      if (mask < 0.08) intensity = Math.random() * BASE * 0.004
      // Sparse hot pixels
      if (Math.random() < 0.0004 && mask > 0.5) intensity = BASE * (0.8 + Math.random() * 0.2)
      row.push(Math.max(0, intensity))
    }
    matrix.push(row)
  }
  return matrix
}

// --- Median 3x3 spatial filter ---
function applyMedian3(data: number[][]): number[][] {
  const rows = data.length
  if (!rows) return data
  const cols = data[0]?.length ?? 0
  if (!cols) return data
  const result: number[][] = []
  for (let r = 0; r < rows; r++) {
    const row: number[] = []
    for (let c = 0; c < cols; c++) {
      const n: number[] = []
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) n.push(data[rr]![cc] ?? 0)
        }
      }
      n.sort((a, b) => a - b)
      row.push(n[Math.floor(n.length / 2)]!)
    }
    result.push(row)
  }
  return result
}

// --- Render ---
let mockData: number[][] = []
let ro: ResizeObserver | null = null

function render() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const rect = container.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const W = Math.floor(rect.width)
  const H = Math.floor(rect.height)
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const data = props.matrix ?? mockData
  if (!data.length || !data[0]?.length) return

  const rows = data.length
  const cols = data[0]!.length

  ctx.imageSmoothingEnabled = false

  // ── Percentile clipping P1–P99 ──
  const allVals: number[] = []
  for (const row of data) for (const v of row) allVals.push(v)
  allVals.sort((a, b) => a - b)
  const p1 = allVals[Math.floor(allVals.length * 0.01)] ?? allVals[0] ?? 0
  const p99 = allVals[Math.floor(allVals.length * 0.99)] ?? allVals[allVals.length - 1] ?? 1
  const dispMin = props.displayMin ?? p1
  const dispMax = props.displayMax ?? p99
  const range = dispMax - dispMin || 1

  // ── Median 3x3 denoise ──
  const filtered = applyMedian3(data)

  // ── Fit canvas to container preserving matrix aspect ratio ──
  const matrixW = cols, matrixH = rows
  const scale = Math.min(W / matrixW, H / matrixH)
  const drawW = Math.floor(matrixW * scale)
  const drawH = Math.floor(matrixH * scale)
  const ox = Math.floor((W - drawW) / 2)
  const oy = Math.floor((H - drawH) / 2)
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#1a0533'
  ctx.fillRect(0, 0, W, H)

  const lut = buildLUT(props.colormap)
  const useLog = props.intensityScale === 'log'
  const cellW = drawW / matrixW
  const cellH = drawH / matrixH

  for (let r = 0; r < rows; r++) {
    const rowData = filtered[r]!
    for (let c = 0; c < cols; c++) {
      const val = rowData[c] ?? dispMin
      let norm = (val - dispMin) / range
      if (useLog) norm = Math.log1p(norm * 9) / Math.log1p(9)
      norm = Math.max(0, Math.min(1, norm))
      const idx = Math.round(norm * 255)
      const [cr, cg, cb] = lut[idx] ?? [0, 0, 0]
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`
      ctx.fillRect(ox + Math.floor(c * cellW), oy + Math.floor(r * cellH), Math.ceil(cellW), Math.ceil(cellH))
    }
  }
}

function onHover(e: MouseEvent) {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const data = props.matrix ?? mockData
  if (!data.length) return
  const rows = data.length, cols = data[0]?.length ?? 0
  const cellW = rect.width / cols, cellH = rect.height / rows
  const col = Math.floor((e.clientX - rect.left) / cellW)
  const row = Math.floor((e.clientY - rect.top) / cellH)
  if (row >= 0 && row < rows && col >= 0 && col < cols) {
    hoverPixel.value = { x: e.clientX - rect.left, y: e.clientY - rect.top, row, col, intensity: data[row]![col]! }
  } else {
    hoverPixel.value = null
  }
}

// --- Lifecycle ---
onMounted(() => {
  mockData = generateMockMatrix(600, 800)
  render()
  ro = new ResizeObserver(() => render())
  if (containerRef.value) ro.observe(containerRef.value)
})
onBeforeUnmount(() => ro?.disconnect())
watch(() => [props.colormap, props.intensityScale, props.matrix, props.selectedMz, props.displayMin, props.displayMax],
  () => render(), { deep: true })
</script>
