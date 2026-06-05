<template>
  <div class="flex flex-col select-none h-full overflow-y-auto overflow-x-hidden pr-8">
    <!-- ─── Display Range ─── -->
    <div class="pt-3 border-t border-base-200">
      <div class="text-base font-semibold text-base-content/50 mb-2">Display range</div>
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <span class="text-base text-base-content/40 w-7 text-right">Max</span>
          <input
            type="text"
            class="input input-sm input-bordered flex-1 text-base font-mono"
            :value="formatValue(localMax)"
            @change="onMaxInput($event)"
          />
          <span class="text-base text-base-content/60 w-14 text-right font-bold">{{
            pctLabel(displayMax)
          }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-base text-base-content/40 w-7 text-right">Min</span>
          <input
            type="text"
            class="input input-sm input-bordered flex-1 text-base font-mono"
            :value="formatValue(localMin)"
            @change="onMinInput($event)"
          />
          <span class="text-base text-base-content/60 w-14 text-right font-bold">{{
            pctLabel(displayMin)
          }}</span>
        </div>
      </div>
    </div>

    <!-- ─── Histogram ─── -->
    <div class="mt-3 pt-3 border-t border-base-200">
      <div class="text-base font-semibold text-base-content/50 mb-2">Distribution</div>
      <div class="relative h-20 rounded border border-base-200 bg-base-200 overflow-hidden">
        <canvas ref="histCanvasRef" class="absolute inset-0 w-full h-full" />
        <div
          class="absolute top-0 bottom-0 w-[2px] bg-red-500/80 z-10"
          :style="{ left: markerLeft(displayMin) + '%' }"
        />
        <div
          class="absolute top-0 bottom-0 w-[2px] bg-red-500/80 z-10"
          :style="{ left: markerLeft(displayMax) + '%' }"
        />
      </div>
    </div>

    <!-- ─── Info ─── -->
    <div class="mt-3 pt-3 border-t border-base-200">
      <div class="text-base font-semibold text-base-content/50 mb-2">Info</div>
      <div class="space-y-1.5 text-base text-base-content/60">
        <div v-for="row in infoRows" :key="row.label" class="flex justify-between">
          <span>{{ row.label }}</span>
          <span class="font-mono text-base-content/80">{{ row.value }}</span>
        </div>
      </div>
    </div>

    <!-- ─── Preprocessing ─── -->
    <div v-if="methods.length" class="mt-3 pt-3 border-t border-base-200">
      <div class="text-base font-semibold text-base-content/50 mb-2">Preprocessing</div>
      <div class="space-y-1">
        <div
          v-for="m in methods"
          :key="m"
          class="text-base text-base-content/70 flex items-center gap-1.5"
        >
          <span class="w-1 h-1 rounded-full bg-blue-400"></span>
          {{ m }}
        </div>
      </div>
    </div>

    <slot name="actions" />
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
      polarity?: string
    }>,
    default: () => ({}),
  },
  methods: { type: Array as PropType<string[]>, default: () => [] },
  sortedValues: { type: Array as PropType<number[]>, default: () => [] },
})

const emit = defineEmits<{
  (e: 'update:displayMin', v: number): void
  (e: 'update:displayMax', v: number): void
}>()

const localMin = computed(() => props.displayMin)
const localMax = computed(() => props.displayMax)
const range = computed(() => props.globalMax - props.globalMin || 1)
function markerLeft(v: number) {
  return ((v - props.globalMin) / range.value) * 100
}

function pctLabel(v: number): string {
  const arr = props.sortedValues
  if (!arr.length) return '0.0%'
  let lo = 0,
    hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid]! <= v) lo = mid + 1
    else hi = mid
  }
  return ((lo / arr.length) * 100).toFixed(1) + '%'
}

const infoRows = computed(() => {
  const items: { label: string; value: string }[] = []
  if (props.info.pixels) items.push({ label: 'Dimensions', value: props.info.pixels })
  if (props.info.nonZero) items.push({ label: 'Non-zero', value: props.info.nonZero })
  if (props.info.totalIon) items.push({ label: 'TIC', value: props.info.totalIon })
  if (props.info.polarity) items.push({ label: 'Polarity', value: props.info.polarity })
  return items
})

function onMinInput(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(v)) emit('update:displayMin', v)
}
function onMaxInput(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(v)) emit('update:displayMax', v)
}

// Histogram
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
  const W = rect.width,
    H = rect.height
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

function formatValue(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'e6'
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'e3'
  if (Math.abs(v) < 0.01) return v.toExponential(1)
  return v.toFixed(2)
}
</script>
