<template>
  <div class="flex flex-col select-none h-full overflow-y-auto" :style="{ minWidth: '210px', maxWidth: '260px' }">
    <!-- ─── Title ─── -->
    <div class="text-base font-semibold text-base-content/70 mb-2.5 tracking-wide">Intensity</div>

    <!-- ─── Color bar ─── -->
    <div class="flex items-stretch gap-3 flex-1 min-h-0 mb-3">
      <!-- Gradient -->
      <div ref="barWrapperRef" class="relative flex-1 mx-auto" :style="{ maxWidth: '36px' }">
        <div
          class="absolute inset-0 rounded-sm border border-base-300"
          :style="{ background: gradientCSS }"
        />

        <!-- Max handle -->
        <div
          class="handle"
          :class="handleClass"
          :style="{ top: (100 - thumbMaxPct) + '%' }"
          @mousedown.prevent="startDrag('max', $event)"
          @touchstart.prevent="startDrag('max', $event)"
        >
          <div class="handle-line" />
        </div>

        <!-- Min handle -->
        <div
          class="handle"
          :class="handleClass"
          :style="{ top: (100 - thumbMinPct) + '%' }"
          @mousedown.prevent="startDrag('min', $event)"
          @touchstart.prevent="startDrag('min', $event)"
        >
          <div class="handle-line" />
        </div>
      </div>

      <!-- Value labels -->
      <div class="flex flex-col justify-between text-sm font-mono text-base-content/80 py-0.5 leading-none w-14">
        <span>{{ formatValue(localMax) }}</span>
        <span>{{ formatValue(localMin) }}</span>
      </div>
    </div>

    <!-- ─── Display Range ─── -->
    <div class="text-sm font-semibold text-base-content/50 mb-2 uppercase tracking-wide">Display Range</div>
    <div class="space-y-2 mb-3">
      <div class="flex items-center gap-2">
        <span class="text-sm text-base-content/40 w-7 text-right">Max</span>
        <input
          type="text"
          class="input input-sm input-bordered flex-1 text-sm font-mono"
          :value="formatValue(localMax)"
          @change="onMaxInput($event)"
        />
        <span class="text-xs text-base-content/60 w-10 text-right font-bold">{{ maxPercentile }}%</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-base-content/40 w-7 text-right">Min</span>
        <input
          type="text"
          class="input input-sm input-bordered flex-1 text-sm font-mono"
          :value="formatValue(localMin)"
          @change="onMinInput($event)"
        />
        <span class="text-xs text-base-content/60 w-10 text-right font-bold">{{ minPercentile }}%</span>
      </div>
    </div>

    <!-- ─── Intensity Histogram ─── -->
    <div class="mb-3">
      <div class="text-sm font-semibold text-base-content/50 mb-1.5 uppercase tracking-wide">Distribution</div>
      <div class="relative h-20 rounded border border-base-200 bg-base-50 overflow-hidden">
        <canvas ref="histCanvasRef" class="absolute inset-0 w-full h-full" />
        <div
          class="absolute top-0 bottom-0 w-px bg-red-500/80 z-10"
          :style="{ left: markerLeft(displayMin) + '%' }"
        />
        <div
          class="absolute top-0 bottom-0 w-px bg-red-500/80 z-10"
          :style="{ left: markerLeft(displayMax) + '%' }"
        />
      </div>
    </div>

    <!-- ─── Info ─── -->
    <div class="text-sm font-semibold text-base-content/50 mb-2 uppercase tracking-wide">Info</div>
    <div class="space-y-1.5 text-sm text-base-content/60 mb-2">
      <div v-for="row in infoRows" :key="row.label" class="flex justify-between">
        <span>{{ row.label }}</span>
        <span class="font-mono text-base-content/80">{{ row.value }}</span>
      </div>
    </div>
    <div class="text-xs text-base-content/30 text-center mt-auto">{{ colormap }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, type PropType } from 'vue'

const props = defineProps({
  colormap: { type: String, default: 'viridis' },
  globalMin: { type: Number, required: true },
  globalMax: { type: Number, required: true },
  displayMin: { type: Number, required: true },
  displayMax: { type: Number, required: true },
  histogram: { type: Array as PropType<number[]>, default: () => [] },
  info: {
    type: Object as PropType<{
      pixels?: string
      nonZero?: string
      totalIon?: string
      imzML?: string
      polarity?: string
    }>,
    default: () => ({}),
  },
})

const emit = defineEmits<{
  (e: 'update:displayMin', v: number): void
  (e: 'update:displayMax', v: number): void
}>()

const localMin = computed(() => props.displayMin)
const localMax = computed(() => props.displayMax)
const range = computed(() => props.globalMax - props.globalMin || 1)
const thumbMinPct = computed(() => ((props.displayMin - props.globalMin) / range.value) * 100)
const thumbMaxPct = computed(() => ((props.displayMax - props.globalMin) / range.value) * 100)
const minPercentile = computed(() => thumbMinPct.value.toFixed(1))
const maxPercentile = computed(() => thumbMaxPct.value.toFixed(1))
const handleClass = 'cursor-ns-resize'
function markerLeft(v: number) { return ((v - props.globalMin) / range.value) * 100 }

const infoRows = computed(() => {
  const items: { label: string; value: string }[] = []
  if (props.info.pixels) items.push({ label: 'Pixel Size', value: props.info.pixels })
  if (props.info.nonZero) items.push({ label: 'Non-zero', value: props.info.nonZero })
  if (props.info.totalIon) items.push({ label: 'TIC', value: props.info.totalIon })
  if (props.info.imzML) items.push({ label: 'imzML', value: props.info.imzML })
  if (props.info.polarity) items.push({ label: 'Polarity', value: props.info.polarity })
  return items
})

// ─── Drag ───
const barWrapperRef = ref<HTMLElement | null>(null)
let activeDrag: 'min' | 'max' | null = null

function startDrag(which: 'min' | 'max', _e: MouseEvent | TouchEvent) {
  activeDrag = which
  const bar = barWrapperRef.value
  if (!bar) return
  const onMove = (ev: MouseEvent | TouchEvent) => {
    if (!activeDrag) return
    const rect = bar.getBoundingClientRect()
    const clientY = 'touches' in ev ? ev.touches[0]?.clientY ?? 0 : ev.clientY
    const topPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    const val = props.globalMax - (topPct / 100) * range.value
    if (activeDrag === 'min') emit('update:displayMin', Math.min(val, props.displayMax))
    else emit('update:displayMax', Math.max(val, props.displayMin))
  }
  const onUp = () => {
    activeDrag = null
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  document.addEventListener('touchmove', onMove)
  document.addEventListener('touchend', onUp)
}

function onMinInput(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(v)) emit('update:displayMin', v)
}

function onMaxInput(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(v)) emit('update:displayMax', v)
}

// ─── Histogram ───
const histCanvasRef = ref<HTMLCanvasElement | null>(null)
function drawHistogram() {
  const canvas = histCanvasRef.value
  if (!canvas) return
  const bins = props.histogram
  if (!bins.length) return
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const W = rect.width, H = rect.height
  ctx.clearRect(0, 0, W, H)

  const maxCount = Math.max(...bins, 1)
  const binW = W / bins.length

  ctx.fillStyle = '#9ca3af'
  for (let i = 0; i < bins.length; i++) {
    const h = (bins[i]! / maxCount) * H
    ctx.fillRect(i * binW, H - h, Math.max(1, binW - 1), h)
  }
}

let histRo: ResizeObserver | null = null
onMounted(() => {
  if (histCanvasRef.value) {
    histRo = new ResizeObserver(drawHistogram)
    histRo.observe(histCanvasRef.value)
  }
})
onBeforeUnmount(() => histRo?.disconnect())
watch(() => props.histogram, drawHistogram, { deep: true })

// ─── Colormap ───
const COLORMAP_STOPS: Record<string, string[]> = {
  viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#fee825'],
  inferno: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#f9d71c'],
  plasma: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fdb42f'],
  gray: ['#000000', '#ffffff'],
}

const stops = computed(() => (COLORMAP_STOPS[props.colormap] ?? COLORMAP_STOPS.viridis) as string[])

const gradientCSS = computed(() => {
  const s = stops.value
  if (s.length < 2) return s[0] ?? '#000'
  return `linear-gradient(to bottom, ${s.map((c, i) => `${c} ${(i / (s.length - 1)) * 100}%`).join(', ')})`
})

function formatValue(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'e6'
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'e3'
  if (Math.abs(v) < 0.01) return v.toExponential(1)
  return v.toFixed(2)
}
</script>

<style scoped>
.handle {
  position: absolute;
  left: -4px;
  right: -4px;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  transition: opacity 0.15s;
}

.handle-line {
  flex: 1;
  height: 2px;
  border-radius: 1px;
  background: #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.35);
}
</style>
