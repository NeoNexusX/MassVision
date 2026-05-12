<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="flex items-center gap-3 mb-2">
      <div>
        <h3 class="text-sm font-semibold">Average Spectrum</h3>
        <p class="text-[11px] text-base-content/50">Click a peak to update the ion image</p>
      </div>
      <div class="ml-auto text-xs text-base-content/50 font-mono">
        <span v-if="hoverPoint">
          m/z {{ hoverPoint.mz.toFixed(4) }} — {{ hoverPoint.intensity.toExponential(2) }}
        </span>
      </div>
    </div>

    <!-- Canvas -->
    <div
      ref="containerRef"
      class="relative flex-1 min-h-0 bg-white rounded-lg border border-base-300 overflow-hidden cursor-crosshair"
      @mousemove="onHover"
      @mouseleave="hoverPoint = null"
      @click="onClick"
    >
      <canvas ref="canvasRef" class="absolute inset-0 w-full h-full" />

      <!-- Hover crosshair tooltip -->
      <div
        v-if="hoverPoint"
        class="absolute pointer-events-none bg-base-100/90 backdrop-blur-sm text-[10px] px-2 py-1 rounded shadow border border-base-300 font-mono"
        :style="tooltipPos"
      >
        {{ hoverPoint.mz.toFixed(4) }}, {{ hoverPoint.intensity.toExponential(2) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, type PropType } from 'vue'

export interface SpectrumPeak {
  mz: number
  intensity: number
}

const props = defineProps({
  selectedMz: { type: Number, required: true },
  /** Spectrum peaks. Null = use mock data. */
  peaks: { type: Array as PropType<SpectrumPeak[] | null>, default: null },
})

const emit = defineEmits<{
  (e: 'select', mz: number): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const hoverPoint = ref<{ mz: number; intensity: number; x: number; y: number } | null>(null)

const tooltipPos = ref<Record<string, string>>({})

// --- Mock data ---
function generateMockPeaks(): SpectrumPeak[] {
  const peaks: SpectrumPeak[] = []
  // Realistic-looking spectrum: baseline + peaks
  for (let mz = 200; mz <= 1200; mz += 0.5) {
    let intensity = Math.random() * 200 // baseline noise
    // Add some prominent peaks
    const peakCenters = [300.2, 450.5, 520.8, 600.1, 700.3, 780.6, 850.0, 885.5, 950.2, 1050.7, 1100.3]
    const peakHeights = [4e5, 6e5, 3e5, 8e5, 1.2e6, 5e5, 7e5, 1e6, 4.5e5, 3.5e5, 2.5e5]
    for (let i = 0; i < peakCenters.length; i++) {
      const dist = mz - (peakCenters[i] ?? 0)
      intensity += (peakHeights[i] ?? 0) * Math.exp(-(dist * dist) / (2 * 0.8 ** 2))
    }
    peaks.push({ mz, intensity })
  }
  return peaks
}

// --- Layout constants ---
const PADDING = { top: 20, right: 20, bottom: 40, left: 64 }

// --- Render ---
let mockPeaks: SpectrumPeak[] = []
let ro: ResizeObserver | null = null

function getPeaks(): SpectrumPeak[] {
  return props.peaks ?? mockPeaks
}

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
  ctx.clearRect(0, 0, W, H)

  const peaks = getPeaks()
  if (!peaks.length) return

  const plotW = W - PADDING.left - PADDING.right
  const plotH = H - PADDING.top - PADDING.bottom

  const mzMin = Math.min(...peaks.map(p => p.mz))
  const mzMax = Math.max(...peaks.map(p => p.mz))
  const intMax = Math.max(...peaks.map(p => p.intensity)) * 1.1

  const toX = (mz: number) => PADDING.left + ((mz - mzMin) / (mzMax - mzMin)) * plotW
  const toY = (intensity: number) => PADDING.top + plotH - (intensity / intMax) * plotH

  // Grid lines
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 5; i++) {
    const y = PADDING.top + (plotH * i) / 5
    ctx.beginPath()
    ctx.moveTo(PADDING.left, y)
    ctx.lineTo(W - PADDING.right, y)
    ctx.stroke()
  }

  // Spectrum line
  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i < peaks.length; i++) {
    const peak = peaks[i]!
    const x = toX(peak.mz)
    const y = toY(peak.intensity)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Fill under curve
  const firstPeak = peaks[0]!, lastPeak = peaks[peaks.length - 1]!
  ctx.lineTo(toX(lastPeak.mz), toY(0))
  ctx.lineTo(toX(firstPeak.mz), toY(0))
  ctx.closePath()
  ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
  ctx.fill()

  // Selected m/z marker
  const selX = toX(props.selectedMz)
  if (selX >= PADDING.left && selX <= W - PADDING.right) {
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(selX, PADDING.top)
    ctx.lineTo(selX, PADDING.top + plotH)
    ctx.stroke()
    ctx.setLineDash([])

    // Label
    ctx.fillStyle = '#ef4444'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(props.selectedMz.toFixed(3), selX, PADDING.top - 5)
  }

  // Axes
  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING.left, PADDING.top)
  ctx.lineTo(PADDING.left, PADDING.top + plotH)
  ctx.lineTo(W - PADDING.right, PADDING.top + plotH)
  ctx.stroke()

  // X-axis ticks & labels
  ctx.fillStyle = '#6b7280'
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  const xTicks = 8
  for (let i = 0; i <= xTicks; i++) {
    const mz = mzMin + ((mzMax - mzMin) * i) / xTicks
    const x = toX(mz)
    ctx.beginPath()
    ctx.moveTo(x, PADDING.top + plotH)
    ctx.lineTo(x, PADDING.top + plotH + 4)
    ctx.stroke()
    ctx.fillText(mz.toFixed(0), x, PADDING.top + plotH + 16)
  }
  ctx.fillText('m/z', W / 2, H - 4)

  // Y-axis ticks & labels
  ctx.textAlign = 'right'
  const yTicks = 5
  for (let i = 0; i <= yTicks; i++) {
    const val = (intMax * i) / yTicks
    const y = toY(val)
    ctx.beginPath()
    ctx.moveTo(PADDING.left - 4, y)
    ctx.lineTo(PADDING.left, y)
    ctx.stroke()
    const label = val >= 1e6 ? (val / 1e6).toFixed(1) + 'e6'
      : val >= 1e3 ? (val / 1e3).toFixed(0) + 'e3'
      : val.toFixed(0)
    ctx.fillText(label, PADDING.left - 6, y + 3)
  }

  // Y-axis title (rotated)
  ctx.save()
  ctx.translate(12, PADDING.top + plotH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#6b7280'
  ctx.font = '10px sans-serif'
  ctx.fillText('Intensity', 0, 0)
  ctx.restore()
}

// --- Interactions ---
function screenToMz(clientX: number): number | null {
  const container = containerRef.value
  if (!container) return null
  const rect = container.getBoundingClientRect()
  const W = rect.width
  const plotW = W - PADDING.left - PADDING.right
  const peaks = getPeaks()
  if (!peaks.length) return null
  const mzMin = Math.min(...peaks.map(p => p.mz))
  const mzMax = Math.max(...peaks.map(p => p.mz))
  const x = clientX - rect.left
  if (x < PADDING.left || x > W - PADDING.right) return null
  return mzMin + ((x - PADDING.left) / plotW) * (mzMax - mzMin)
}

function findNearestPeak(mz: number): SpectrumPeak | null {
  const peaks = getPeaks()
  let best: SpectrumPeak | null = null
  let bestDist = Infinity
  for (const p of peaks) {
    const d = Math.abs(p.mz - mz)
    if (d < bestDist) { bestDist = d; best = p }
  }
  return best
}

function onHover(e: MouseEvent) {
  const mz = screenToMz(e.clientX)
  if (mz === null) { hoverPoint.value = null; return }

  const peak = findNearestPeak(mz)
  if (!peak) { hoverPoint.value = null; return }

  const container = containerRef.value!
  const rect = container.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  hoverPoint.value = { mz: peak.mz, intensity: peak.intensity, x, y }

  // Position tooltip
  const tipW = 180
  tooltipPos.value = {
    left: (x + tipW + 20 > rect.width ? x - tipW - 8 : x + 12) + 'px',
    top: Math.max(4, y - 28) + 'px',
  }
}

function onClick(e: MouseEvent) {
  const mz = screenToMz(e.clientX)
  if (mz === null) return
  const peak = findNearestPeak(mz)
  if (peak) emit('select', peak.mz)
}

// --- Lifecycle ---
onMounted(() => {
  mockPeaks = generateMockPeaks()
  render()
  ro = new ResizeObserver(() => render())
  if (containerRef.value) ro.observe(containerRef.value)
})

onBeforeUnmount(() => {
  ro?.disconnect()
})

watch(
  () => [props.selectedMz, props.peaks],
  () => render(),
  { deep: true },
)
</script>
