<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3 mb-3">
      <div>
        <h3 class="text-lg font-semibold">Ion Image</h3>
        <p class="text-sm text-base-content/50">Per-pixel ion intensity heatmap</p>
      </div>
      <div v-if="metaInfo" class="hidden sm:flex items-center gap-3 text-base text-base-content/60 ml-2">
        <span v-if="metaInfo.analyzer">Analyzer <strong class="text-base-content">{{ metaInfo.analyzer }}</strong></span>
        <span v-if="metaInfo.ionSource">Source <strong class="text-base-content">{{ metaInfo.ionSource }}</strong></span>
        <span v-if="metaInfo.pixelSize">Pixel <strong class="text-base-content">{{ metaInfo.pixelSize }}</strong></span>
      </div>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <div class="bg-base-200 rounded-lg px-3 py-1.5 text-base">
          <span class="text-base-content/50">m/z&nbsp;</span>
          <span class="font-mono font-semibold">{{ selectedMz.toFixed(3) }}</span>
        </div>
        <div class="flex items-center gap-1 text-base">
          <span class="text-base-content/50">&plusmn;</span>
          <input type="number" class="input input-sm input-bordered w-16 font-mono text-base"
            :value="mzTolerance" step="0.001" min="0.001"
            @input="$emit('update:mzTolerance', +($event.target as HTMLInputElement).value)" />
        </div>
        <select class="select select-sm select-bordered w-24 text-base"
          :value="colormap"
          @change="$emit('update:colormap', ($event.target as HTMLSelectElement).value)">
          <option value="viridis">Viridis</option>
          <option value="inferno">Inferno</option>
          <option value="plasma">Plasma</option>
          <option value="gray">Gray</option>
        </select>
        <select class="select select-sm select-bordered w-24 text-base"
          :value="intensityScale"
          @change="$emit('update:intensityScale', ($event.target as HTMLSelectElement).value)">
          <option value="linear">Linear</option>
          <option value="log">Log</option>
        </select>
        <button class="btn btn-sm btn-ghost" @click="$emit('reset')">Reset</button>
      </div>
    </div>
    <div ref="containerRef"
      class="relative flex-1 min-h-0 bg-base-200 rounded-lg border border-base-300 overflow-hidden"
      :class="drawMode ? 'cursor-default' : zoom > 1 ? 'cursor-grab' : 'cursor-crosshair'"
      @mousedown="onPanStart"
      @mousemove="onHover" @mouseleave="hoverPixel = null">
      <canvas ref="canvasRef" class="absolute inset-0" style="image-rendering: pixelated;"
        :style="{ transform: `translate(${panX}px,${panY}px) scale(${zoom})`, transformOrigin: '0 0', width: containerW + 'px', height: containerH + 'px' }"
        @wheel.prevent="onWheel" />
      <div v-if="hoverPixel"
        class="absolute pointer-events-none bg-base-100/90 backdrop-blur-sm text-sm px-2 py-1 rounded shadow border border-base-300 font-mono"
        :style="{ left: hoverPixel.x + 12 + 'px', top: hoverPixel.y + 12 + 'px' }">
        ({{ hoverPixel.col }}, {{ hoverPixel.row }}) — {{ hoverPixel.intensity.toExponential(2) }}
      </div>
      <div class="absolute bottom-2 right-2 flex items-center gap-1 bg-base-100/80 backdrop-blur-sm rounded-lg px-1.5 py-1 border border-base-300">
        <button class="w-7 h-7 flex items-center justify-center rounded hover:bg-base-300 text-base-content/70 text-lg font-bold" title="Zoom out" @click="zoomOut">−</button>
        <span class="text-xs font-mono w-10 text-center text-base-content/60">{{ zoom.toFixed(1) }}x</span>
        <button class="w-7 h-7 flex items-center justify-center rounded hover:bg-base-300 text-base-content/70 text-lg font-bold" title="Zoom in" @click="zoomIn">+</button>
        <button v-if="zoom > 1" class="w-7 h-7 flex items-center justify-center rounded hover:bg-base-300 text-base-content/50 text-xs ml-0.5" title="Reset zoom" @click="resetZoom">1:1</button>
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
  metaInfo: { type: Object as PropType<{ analyzer?: string; ionSource?: string; pixelSize?: string } | null>, default: null },
  drawMode: { type: Boolean, default: false },
  overlayData: { type: Object as PropType<Uint8ClampedArray | null>, default: null },
  overlayWidth: { type: Number, default: 0 },
  overlayHeight: { type: Number, default: 0 },
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
const containerW = ref(0)
const containerH = ref(0)

// --- Zoom & Pan ---
const zoom = ref(2)
const panX = ref(0)
const panY = ref(0)

function resetZoom() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  scheduleRender()
}

function zoomIn() {
  setZoom(zoom.value * 1.5)
}

function zoomOut() {
  setZoom(zoom.value / 1.5)
}

function setZoom(newZoom: number) {
  const clamped = Math.max(1, Math.min(40, newZoom))
  if (clamped === zoom.value) return
  const cx = containerW.value / 2
  const cy = containerH.value / 2
  const scale = clamped / zoom.value
  panX.value = cx - scale * (cx - panX.value)
  panY.value = cy - scale * (cy - panY.value)
  zoom.value = clamped
  if (zoom.value === 1) { panX.value = 0; panY.value = 0 }
  scheduleRender()
}

function onWheel(e: WheelEvent) {
  if (props.drawMode) return
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
  const newZoom = Math.max(1, Math.min(40, zoom.value * factor))
  const scale = newZoom / zoom.value
  panX.value = mx - scale * (mx - panX.value)
  panY.value = my - scale * (my - panY.value)
  zoom.value = newZoom
  if (zoom.value === 1) { panX.value = 0; panY.value = 0 }
  scheduleRender()
}

function onPanStart(e: MouseEvent) {
  if (props.drawMode || zoom.value <= 1 || e.button !== 0) return
  e.preventDefault()
  const startX = e.clientX - panX.value
  const startY = e.clientY - panY.value
  const onMove = (ev: MouseEvent) => {
    panX.value = ev.clientX - startX
    panY.value = ev.clientY - startY
    scheduleRender()
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// --- Colormap LUT ---
const COLORMAP_TABLE: Record<string, [number, number, number][]> = {
  viridis: [[68,1,84],[72,35,116],[64,74,138],[49,104,142],[38,130,142],[31,157,137],[108,206,89],[254,231,37]],
  inferno: [[0,0,4],[40,11,84],[101,21,110],[159,42,99],[212,72,66],[245,125,21],[250,193,39],[252,255,164]],
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
  let gaussSpare = 0, gaussHasSpare = false
  function gaussR(): number {
    if (gaussHasSpare) { gaussHasSpare = false; return gaussSpare }
    let u = 0, v = 0, s = 0
    while (s >= 1 || s === 0) { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v }
    const mag = Math.sqrt(-2 * Math.log(s) / s)
    gaussSpare = v * mag; gaussHasSpare = true
    return u * mag
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

// --- Render ---
let mockData: number[][] = []
let ro: ResizeObserver | null = null

// Cache: only recompute when data reference changes
let cachedData: number[][] | null = null
let cachedP1 = 0
let cachedP99 = 1

function updateCachedData(data: number[][]) {
  if (cachedData === data) return
  cachedData = data

  // Percentile clipping P1–P99
  const allVals: number[] = []
  for (const row of data) for (const v of row) allVals.push(v)
  allVals.sort((a, b) => a - b)
  cachedP1 = allVals[Math.floor(allVals.length * 0.01)] ?? allVals[0] ?? 0
  cachedP99 = allVals[Math.floor(allVals.length * 0.99)] ?? allVals[allVals.length - 1] ?? 1
}

function render() {
  const canvas = canvasRef.value
  if (!canvas) return

  const W = containerW.value
  const H = containerH.value
  if (!W || !H) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const data = props.matrix ?? mockData
  if (!data.length || !data[0]?.length) return

  updateCachedData(data)

  const rows = data.length
  const cols = data[0]!.length

  ctx.imageSmoothingEnabled = false

  const dispMin = props.displayMin ?? cachedP1
  const dispMax = props.displayMax ?? cachedP99
  const range = dispMax - dispMin || 1

  // ── Fit canvas to container preserving matrix aspect ratio ──
  const matrixW = cols, matrixH = rows
  const scale = Math.min(W / matrixW, H / matrixH)
  // Snap to integer cell size for crisp pixels
  const cellW = Math.max(1, Math.floor(scale))
  const cellH = Math.max(1, Math.floor(scale))
  const drawW = matrixW * cellW
  const drawH = matrixH * cellH
  const ox = Math.floor((W - drawW) / 2)
  const oy = Math.floor((H - drawH) / 2)
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#0a0a0f'
  ctx.fillRect(0, 0, W, H)

  const lut = buildLUT(props.colormap)
  const useLog = props.intensityScale === 'log'

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Zero intensity → transparent (show background)
      const rawVal = data[r]![c] ?? 0
      if (rawVal === 0) continue

      const val = data[r]![c] ?? dispMin
      let norm = (val - dispMin) / range
      norm = Math.pow(Math.max(0, norm), 0.45) // gamma: brighten dark areas
      if (useLog) norm = Math.log1p(norm * 9) / Math.log1p(9)
      norm = Math.max(0, Math.min(1, norm))
      const idx = Math.round(norm * 255)
      const [cr, cg, cb] = lut[idx] ?? [0, 0, 0]
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`
      ctx.fillRect(ox + Math.floor(c * cellW), oy + Math.floor(r * cellH), Math.ceil(cellW), Math.ceil(cellH))
    }
  }

  // ── Draw overlay (UMAP / KMeans) on same canvas ──
  if (props.overlayData && props.overlayWidth && props.overlayHeight) {
    const ow = props.overlayWidth, oh = props.overlayHeight
    const src = props.overlayData
    for (let r = 0; r < oh; r++) {
      for (let c = 0; c < ow; c++) {
        const off = (r * ow + c) * 4
        const a = src[off + 3]!
        if (a === 0) continue
        ctx.fillStyle = `rgba(${src[off]!},${src[off+1]!},${src[off+2]!},${(a / 255).toFixed(2)})`
        ctx.fillRect(ox + Math.floor(c * cellW), oy + Math.floor(r * cellH), Math.ceil(cellW), Math.ceil(cellH))
      }
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
  const W = rect.width, H = rect.height
  const scale = Math.min(W / cols, H / rows)
  const cellW = Math.max(1, Math.floor(scale))
  const cellH = Math.max(1, Math.floor(scale))
  const drawW = cols * cellW
  const drawH = rows * cellH
  const ox = Math.floor((W - drawW) / 2)
  const oy = Math.floor((H - drawH) / 2)
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const cx = (mx - panX.value) / zoom.value
  const cy = (my - panY.value) / zoom.value
  const col = Math.floor((cx - ox) / cellW)
  const row = Math.floor((cy - oy) / cellH)
  if (row >= 0 && row < rows && col >= 0 && col < cols) {
    hoverPixel.value = { x: mx, y: my, row, col, intensity: data[row]![col]! }
  } else {
    hoverPixel.value = null
  }
}

let renderRaf = 0
function scheduleRender() {
  if (renderRaf) return
  renderRaf = requestAnimationFrame(() => { renderRaf = 0; render() })
}

// --- Lifecycle ---
onMounted(() => {
  mockData = generateMockMatrix(600, 800)
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    containerW.value = Math.floor(rect.width)
    containerH.value = Math.floor(rect.height)
    panX.value = containerW.value * (1 - zoom.value) / 2
    panY.value = containerH.value * (1 - zoom.value) / 2
    ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        containerW.value = Math.floor(entry.contentRect.width)
        containerH.value = Math.floor(entry.contentRect.height)
        scheduleRender()
      }
    })
    ro.observe(containerRef.value)
  }
  render()
})
onBeforeUnmount(() => ro?.disconnect())
watch(() => [props.colormap, props.intensityScale, props.matrix, props.selectedMz, props.displayMin, props.displayMax, props.overlayData],
  () => scheduleRender(), { deep: true })
</script>
