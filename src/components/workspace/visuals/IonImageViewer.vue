<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3 mb-3">
      <div>
        <h3 class="text-sm font-semibold">Ion Image</h3>
        <p class="text-[11px] text-base-content/50">Per-pixel ion intensity heatmap</p>
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <!-- Current m/z -->
        <div class="bg-base-200 rounded-lg px-3 py-1.5 text-xs">
          <span class="text-base-content/50">m/z&nbsp;</span>
          <span class="font-mono font-semibold">{{ selectedMz.toFixed(3) }}</span>
        </div>

        <!-- Tolerance -->
        <div class="flex items-center gap-1 text-xs">
          <span class="text-base-content/50">&plusmn;</span>
          <input
            type="number"
            class="input input-xs input-bordered w-16 font-mono text-xs"
            :value="mzTolerance"
            step="0.001"
            min="0.001"
            @input="$emit('update:mzTolerance', +($event.target as HTMLInputElement).value)"
          />
        </div>

        <!-- Colormap -->
        <select
          class="select select-xs select-bordered w-24 text-xs"
          :value="colormap"
          @change="$emit('update:colormap', ($event.target as HTMLSelectElement).value)"
        >
          <option value="viridis">Viridis</option>
          <option value="inferno">Inferno</option>
          <option value="plasma">Plasma</option>
          <option value="gray">Gray</option>
        </select>

        <!-- Intensity scale -->
        <select
          class="select select-xs select-bordered w-24 text-xs"
          :value="intensityScale"
          @change="$emit('update:intensityScale', ($event.target as HTMLSelectElement).value)"
        >
          <option value="linear">Linear</option>
          <option value="log">Log</option>
        </select>

        <button class="btn btn-xs btn-ghost" @click="$emit('reset')">Reset</button>
      </div>
    </div>

    <!-- Canvas container -->
    <div
      ref="containerRef"
      class="relative flex-1 min-h-0 bg-base-200 rounded-lg border border-base-300 overflow-hidden cursor-crosshair"
      @mousemove="onHover"
      @mouseleave="hoverPixel = null"
    >
      <canvas ref="canvasRef" class="absolute inset-0 w-full h-full" />

      <!-- Hover tooltip -->
      <div
        v-if="hoverPixel"
        class="absolute pointer-events-none bg-base-100/90 backdrop-blur-sm text-[10px] px-2 py-1 rounded shadow border border-base-300 font-mono"
        :style="{ left: hoverPixel.x + 12 + 'px', top: hoverPixel.y + 12 + 'px' }"
      >
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
  /** 2-D intensity matrix [rows][cols]. Null = show placeholder. */
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

// --- Colormap LUT generation ---
const COLORMAP_TABLE: Record<string, [number, number, number][]> = {
  viridis: [
    [68, 1, 84], [72, 35, 116], [64, 74, 138], [49, 104, 142],
    [38, 130, 142], [31, 157, 137], [108, 206, 89], [254, 231, 37],
  ],
  inferno: [
    [0, 0, 4], [27, 12, 65], [74, 12, 107], [120, 28, 109],
    [165, 44, 96], [207, 68, 70], [237, 105, 37], [249, 215, 28],
  ],
  plasma: [
    [13, 8, 135], [70, 3, 159], [114, 1, 168], [156, 23, 158],
    [189, 55, 134], [216, 87, 107], [237, 121, 83], [253, 180, 47],
  ],
  gray: [
    [0, 0, 0], [255, 255, 255],
  ],
}

function buildLUT(name: string): [number, number, number][] {
  const stops = COLORMAP_TABLE[name] ?? COLORMAP_TABLE.viridis
  const lut: [number, number, number][] = new Array(256)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const segment = t * (stops.length - 1)
    const idx = Math.min(Math.floor(segment), stops.length - 2)
    const frac = segment - idx
    const a = stops[idx], b = stops[idx + 1]
    lut[i] = [
      Math.round(a[0] + (b[0] - a[0]) * frac),
      Math.round(a[1] + (b[1] - a[1]) * frac),
      Math.round(a[2] + (b[2] - a[2]) * frac),
    ]
  }
  return lut
}

// --- Mock data: simulated mouse brain coronal section (MALDI-MSI style) ---
function generateMockMatrix(rows: number, cols: number): number[][] {
  const H = rows, W = cols
  const cx = W / 2, cy = H * 0.46

  // ── Hash / noise primitives ──
  function hash(x: number, y: number, seed = 0): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453
    return n - Math.floor(n)
  }
  function smoothNoise(x: number, y: number, scale: number, seed = 0): number {
    const sx = x / scale, sy = y / scale
    const ix = Math.floor(sx), iy = Math.floor(sy)
    const fx = sx - ix, fy = sy - iy
    const sx1 = fx * fx * (3 - 2 * fx) // smoothstep
    const sy1 = fy * fy * (3 - 2 * fy)
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed)
    const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed)
    return a * (1 - sx1) * (1 - sy1) + b * sx1 * (1 - sy1) + c * (1 - sx1) * sy1 + d * sx1 * sy1
  }

  // ── Brain outline mask (coronal section shape) ──
  function brainMask(r: number, c: number): number {
    const nx = (c - cx) / (W * 0.42)
    const ny = (r - cy) / (H * 0.44)
    const angle = Math.atan2(ny, nx)
    const dBase = Math.sqrt(nx * nx + ny * ny)
    // Irregular boundary: wider at top, narrower at bottom, asymmetric
    const wobble = 1
      + smoothNoise(c, r, 10, 0) * 0.18
      + Math.sin(angle * 2 + 0.3) * 0.06
      + Math.cos(angle * 3) * 0.04
      + (ny > 0 ? ny * 0.15 : 0)  // slightly narrower at bottom
    const dEff = dBase * wobble
    // Soft tissue edge
    return 1 / (1 + Math.exp((dEff - 0.92) * 14))
  }

  // ── Cortex rim (outer ring, higher signal in this m/z) ──
  function cortexSignal(r: number, c: number): number {
    const nx = (c - cx) / (W * 0.42)
    const ny = (r - cy) / (H * 0.44)
    const dBase = Math.sqrt(nx * nx + ny * ny)
    // Peak at ~0.7-0.85 of brain radius
    const distFromRim = 1 - dBase
    const rim = Math.max(0, Math.exp(-((distFromRim - 0.22) ** 2) / 0.008)
      + Math.exp(-((distFromRim - 0.3) ** 2) / 0.015) * 0.5)
    return rim * (0.7 + smoothNoise(c, r, 6, 10) * 0.3)
  }

  // ── Hippocampus (C-shaped, bilateral) ──
  function hippocampusSignal(r: number, c: number): number {
    let total = 0
    for (const side of [-1, 1]) {
      const hcx = cx + side * W * 0.17
      const hcy = cy - H * 0.14
      const nx = (c - hcx) / (W * 0.09)
      const ny = (r - hcy) / (H * 0.08)
      const d = Math.sqrt(nx * nx + ny * ny)
      // Ring-like (C-shaped)
      const ring = Math.exp(-((d - 0.65) ** 2) / 0.06) * 0.8 + Math.exp(-d * d * 1.5) * 0.3
      total += ring * (0.75 + smoothNoise(c, r, 5, 20 + side) * 0.25)
    }
    return total
  }

  // ── Striatum (central, patchy) ──
  function striatumSignal(r: number, c: number): number {
    let total = 0
    for (const side of [-1, 1]) {
      const scx = cx + side * W * 0.12
      const scy = cy + H * 0.04
      const nx = (c - scx) / (W * 0.08)
      const ny = (r - scy) / (H * 0.08)
      const d = Math.sqrt(nx * nx + ny * ny)
      total += Math.exp(-d * d * 2.0) * (0.4 + smoothNoise(c, r, 5, 30 + side) * 0.6)
    }
    return total
  }

  // ── Corpus callosum (midline fiber tract, low signal) ──
  function corpusCallosumDip(r: number, c: number): number {
    const nx = (c - cx) / (W * 0.25)
    const ny = (r - (cy - H * 0.06)) / (H * 0.08)
    const dH = Math.abs(ny)
    const band = Math.exp(-nx * nx * 2.0) * Math.exp(-dH * dH * 8.0)
    return band * 0.6 // reduces signal (dip)
  }

  // ── Ventricles (voids, near-zero signal) ──
  function ventricleVoid(r: number, c: number): number {
    let dip = 0
    for (const side of [-1, 1]) {
      const vx = cx + side * W * 0.06
      const vy = cy - H * 0.07
      const nx = (c - vx) / (W * 0.035)
      const ny = (r - vy) / (H * 0.03)
      const d = Math.sqrt(nx * nx + ny * ny)
      dip += Math.exp(-d * d * 3.0)
    }
    return dip
  }

  // ── Assemble ──
  const matrix: number[][] = []
  const BASE = 1.2e6

  for (let r = 0; r < H; r++) {
    const row: number[] = []
    for (let c = 0; c < W; c++) {
      const mask = brainMask(r, c)

      // Component signals
      const ctx = cortexSignal(r, c)
      const hipp = hippocampusSignal(r, c)
      const stri = striatumSignal(r, c)
      const ccDip = corpusCallosumDip(r, c)
      const vVoid = ventricleVoid(r, c)

      // Combine regions
      let signal = (ctx * 1.0 + hipp * 0.85 + stri * 0.45) * (1 - ccDip * 0.7) * (1 - vVoid * 0.85)

      // Add diffuse background within tissue
      signal += 0.08 * (0.5 + smoothNoise(c, r, 15, 50) * 0.5)

      // Clamp tissue signal
      signal = Math.max(0, signal)

      // ── Apply tissue mask (background is near-zero) ──
      let intensity = signal * mask * BASE

      // ── MSI acquisition effects ──
      // Salt-and-pepper noise (hot/cold pixels)
      const spRoll = Math.random()
      if (spRoll < 0.003 && mask > 0.5) {
        intensity = BASE * (0.85 + Math.random() * 0.15) // sparse hot pixel
      } else if (spRoll < 0.008 && mask > 0.3) {
        intensity *= 0.3 + Math.random() * 0.3 // sparse cold pixel
      }

      // Gaussian acquisition noise
      intensity += gaussRandom() * BASE * 0.012

      // Background: very low signal with occasional cosmic ray
      if (mask < 0.1) {
        intensity = Math.random() < 0.002 ? Math.random() * BASE * 0.15 : Math.random() * BASE * 0.008
      }

      // Edge enhancement: slight rim at tissue boundary
      const edge = Math.abs(mask - 0.5) < 0.35 ? (1 - Math.abs(mask - 0.5) / 0.35) : 0
      intensity += edge * edge * BASE * 0.08

      // Sparse hot pixels anywhere in tissue
      if (Math.random() < 0.0015 && mask > 0.2) {
        intensity = BASE * (0.8 + Math.random() * 0.2)
      }

      row.push(Math.max(0, intensity))
    }
    matrix.push(row)
  }
  return matrix
}

// Box-Muller Gaussian random
let gaussSpare = 0, gaussHasSpare = false
function gaussRandom(): number {
  if (gaussHasSpare) { gaussHasSpare = false; return gaussSpare }
  let u = 0, v = 0, s = 0
  while (s >= 1 || s === 0) {
    u = Math.random() * 2 - 1
    v = Math.random() * 2 - 1
    s = u * u + v * v
  }
  const mul = Math.sqrt(-2 * Math.log(s) / s)
  gaussSpare = v * mul
  gaussHasSpare = true
  return u * mul
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
  if (!data.length || !data[0].length) return

  const rows = data.length
  const cols = data[0].length

  // ── Pixelated MSI rendering ──
      ctx.imageSmoothingEnabled = false

      // Compute intensity range
  let minVal = Infinity, maxVal = -Infinity
  for (const row of data) {
    for (const v of row) {
      if (v < minVal) minVal = v
      if (v > maxVal) maxVal = v
    }
  }
  // Use display range if provided, otherwise use global min/max
  const dispMin = props.displayMin ?? minVal
  const dispMax = props.displayMax ?? maxVal
  const range = dispMax - dispMin || 1

  const lut = buildLUT(props.colormap)
  const useLog = props.intensityScale === 'log'

  const cellW = W / cols
  const cellH = H / rows

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let norm = (data[r][c] - dispMin) / range
      if (useLog) norm = Math.log1p(norm * 9) / Math.log1p(9) // log scaling
      norm = Math.max(0, Math.min(1, norm)) // clamp to [0,1] — below min → 0, above max → 1
      const idx = Math.round(norm * 255)
      const [cr, cg, cb] = lut[idx]
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`
      ctx.fillRect(Math.floor(c * cellW), Math.floor(r * cellH), Math.ceil(cellW), Math.ceil(cellH))
    }
  }
}

function onHover(e: MouseEvent) {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const data = props.matrix ?? mockData
  if (!data.length) return

  const rows = data.length, cols = data[0].length
  const cellW = rect.width / cols, cellH = rect.height / rows
  const col = Math.floor((e.clientX - rect.left) / cellW)
  const row = Math.floor((e.clientY - rect.top) / cellH)

  if (row >= 0 && row < rows && col >= 0 && col < cols) {
    hoverPixel.value = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      row, col,
      intensity: data[row][col],
    }
  } else {
    hoverPixel.value = null
  }
}

// --- Lifecycle ---
onMounted(() => {
  mockData = generateMockMatrix(150, 200)
  render()
  ro = new ResizeObserver(() => render())
  if (containerRef.value) ro.observe(containerRef.value)
})

onBeforeUnmount(() => {
  ro?.disconnect()
})

watch(
  () => [props.colormap, props.intensityScale, props.matrix, props.selectedMz, props.displayMin, props.displayMax],
  () => render(),
  { deep: true },
)
</script>
