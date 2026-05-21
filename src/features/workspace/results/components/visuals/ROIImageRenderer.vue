<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center gap-2 mb-2">
      <div class="w-3 h-3 rounded-full" :style="{ background: roi.color }"></div>
      <span class="text-sm font-semibold" :style="{ color: roi.color }">{{ roi.label }}</span>
      <span class="text-xs text-base-content/40 ml-auto">{{
        roi.type === 'freehand' ? 'Lasso' : 'Rect'
      }}</span>
    </div>
    <div
      ref="containerRef"
      class="relative flex-1 min-h-0 bg-base-200 rounded border border-base-300 overflow-hidden"
    >
      <canvas
        ref="canvasRef"
        class="absolute inset-0 w-full h-full"
        style="image-rendering: pixelated"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, type PropType } from 'vue'
import type { ConfirmedROI } from '@/features/workspace/results/composables/useROI'

const props = defineProps({
  roi: { type: Object as PropType<ConfirmedROI>, required: true },
  matrix: { type: Array as PropType<number[][]>, required: true },
  colormap: { type: String, default: 'inferno' },
  displayMin: { type: Number, required: true },
  displayMax: { type: Number, required: true },
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

const COLORMAP_TABLE: Record<string, [number, number, number][]> = {
  viridis: [
    [68, 1, 84],
    [72, 35, 116],
    [64, 74, 138],
    [49, 104, 142],
    [38, 130, 142],
    [31, 157, 137],
    [108, 206, 89],
    [254, 231, 37],
  ],
  inferno: [
    [0, 0, 4],
    [27, 12, 65],
    [74, 12, 107],
    [120, 28, 109],
    [165, 44, 96],
    [207, 68, 70],
    [237, 105, 37],
    [249, 215, 28],
  ],
  plasma: [
    [13, 8, 135],
    [70, 3, 159],
    [114, 1, 168],
    [156, 23, 158],
    [189, 55, 134],
    [216, 87, 107],
    [237, 121, 83],
    [253, 180, 47],
  ],
  gray: [
    [0, 0, 0],
    [255, 255, 255],
  ],
}

function buildLUT(name: string): [number, number, number][] {
  const stops = (COLORMAP_TABLE[name] ?? COLORMAP_TABLE.viridis)!
  const lut: [number, number, number][] = new Array(256)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const segment = t * (stops.length - 1)
    const idx = Math.min(Math.floor(segment), stops.length - 2)
    const frac = segment - idx
    const a = stops[idx]!,
      b = stops[idx + 1]!
    lut[i] = [
      Math.round(a[0] + (b[0] - a[0]) * frac),
      Math.round(a[1] + (b[1] - a[1]) * frac),
      Math.round(a[2] + (b[2] - a[2]) * frac),
    ]
  }
  return lut
}

function render() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const rect = container.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const W = Math.floor(rect.width)
  const H = Math.floor(rect.height)
  if (!W || !H) return
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#0a0a0f'
  ctx.fillRect(0, 0, W, H)

  const mask = props.roi.mask
  const data = props.matrix
  if (!mask || !mask.length || !data || !data.length) return

  const rows = data.length
  const cols = data[0]?.length ?? 0
  if (!rows || !cols) return

  // Find bounding box of the ROI
  let rMin = rows,
    rMax = -1,
    cMin = cols,
    cMax = -1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r]?.[c]) {
        if (r < rMin) rMin = r
        if (r > rMax) rMax = r
        if (c < cMin) cMin = c
        if (c > cMax) cMax = c
      }
    }
  }
  if (rMax < rMin || cMax < cMin) return

  const roiW = cMax - cMin + 1
  const roiH = rMax - rMin + 1
  const scale = Math.min(W / roiW, H / roiH)
  const drawW = Math.floor(roiW * scale)
  const drawH = Math.floor(roiH * scale)
  const ox = Math.floor((W - drawW) / 2)
  const oy = Math.floor((H - drawH) / 2)
  const cellW = drawW / roiW
  const cellH = drawH / roiH

  const lut = buildLUT(props.colormap)
  const dispMin = props.displayMin
  const dispMax = props.displayMax
  const range = dispMax - dispMin || 1

  ctx.imageSmoothingEnabled = false
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      if (!mask[r]?.[c]) continue
      const rawVal = data[r]?.[c] ?? 0
      if (rawVal === 0) continue
      let norm = (rawVal - dispMin) / range
      norm = Math.pow(Math.max(0, norm), 0.45)
      norm = Math.max(0, Math.min(1, norm))
      const idx = Math.round(norm * 255)
      const [cr, cg, cb] = lut[idx] ?? [0, 0, 0]
      const px = ox + Math.floor((c - cMin) * cellW)
      const py = oy + Math.floor((r - rMin) * cellH)
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`
      ctx.fillRect(px, py, Math.ceil(cellW), Math.ceil(cellH))
    }
  }
}

let ro: ResizeObserver | null = null
let renderRaf = 0
function scheduleRender() {
  if (renderRaf) return
  renderRaf = requestAnimationFrame(() => {
    renderRaf = 0
    render()
  })
}

onMounted(() => {
  render()
  if (containerRef.value) {
    ro = new ResizeObserver(() => scheduleRender())
    ro.observe(containerRef.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())

watch(
  () => [props.roi, props.matrix, props.colormap, props.displayMin, props.displayMax],
  () => scheduleRender(),
  { deep: true },
)
</script>
