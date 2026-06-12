<template>
  <div class="flex flex-col h-full">
    <IonImageToolbar
      :selected-mz="selectedMz"
      :mz-tolerance="mzTolerance"
      :colormap="colormap"
      :intensity-scale="intensityScale"
      :meta-info="metaInfo"
      @update:mz-tolerance="$emit('update:mzTolerance', $event)"
      @update:colormap="$emit('update:colormap', $event)"
      @update:intensity-scale="$emit('update:intensityScale', $event)"
      @reset="$emit('reset')"
    />
    <div
      ref="containerRef"
      class="relative flex-1 min-h-0 bg-base-200 rounded-lg border border-base-300 overflow-hidden"
      :class="drawMode ? 'cursor-default' : zoom > 1 ? 'cursor-grab' : 'cursor-crosshair'"
      @mousedown="onContainerPanStart"
      @mousemove="onHover"
      @mouseleave="hoverPixel = null"
    >
      <canvas
        ref="canvasRef"
        class="absolute inset-0"
        style="image-rendering: pixelated"
        :style="{
          transform: `translate(${panX}px,${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: containerW + 'px',
          height: containerH + 'px',
        }"
        @wheel.prevent="onContainerWheel"
      />
      <div
        v-if="hoverPixel"
        class="absolute pointer-events-none bg-base-100/90 backdrop-blur-sm text-sm px-2 py-1 rounded shadow border border-base-300 font-mono"
        :style="{ left: hoverPixel.x + 12 + 'px', top: hoverPixel.y + 12 + 'px' }"
      >
        ({{ hoverPixel.col }}, {{ hoverPixel.row }}) — {{ hoverPixel.intensity.toExponential(2) }}
      </div>
      <div
        class="absolute bottom-2 right-2 flex items-center gap-1 bg-base-100/80 backdrop-blur-sm rounded-lg px-1.5 py-1 border border-base-300"
      >
        <button
          class="w-7 h-7 flex items-center justify-center rounded hover:bg-base-300 text-base-content/70 text-lg font-bold"
          title="Zoom out"
          @click="zoomOut"
        >
          −
        </button>
        <span class="text-xs font-mono w-10 text-center text-base-content/60"
          >{{ zoom.toFixed(1) }}x</span
        >
        <button
          class="w-7 h-7 flex items-center justify-center rounded hover:bg-base-300 text-base-content/70 text-lg font-bold"
          title="Zoom in"
          @click="zoomIn"
        >
          +
        </button>
        <button
          v-if="zoom > 1"
          class="w-7 h-7 flex items-center justify-center rounded hover:bg-base-300 text-base-content/50 text-xs ml-0.5"
          title="Reset zoom"
          @click="resetZoom"
        >
          1:1
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, type PropType } from 'vue'
import IonImageToolbar from './IonImageToolbar.vue'
import { useZoomPan } from '../../composables/useZoomPan'
import { useCanvasRenderer } from '../../composables/useCanvasRenderer'

const props = defineProps({
  selectedMz: { type: Number, required: true },
  mzTolerance: { type: Number, required: true },
  colormap: { type: String, required: true },
  intensityScale: { type: String, required: true },
  displayMin: { type: Number, default: undefined },
  displayMax: { type: Number, default: undefined },
  matrix: { type: Object as PropType<Float32Array | null>, default: null },
  matrixCols: { type: Number, default: 0 },
  matrixRows: { type: Number, default: 0 },
  metaInfo: {
    type: Object as PropType<{ analyzer?: string; ionSource?: string; pixelSize?: string } | null>,
    default: null,
  },
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
const hoverPixel = ref<{
  x: number
  y: number
  row: number
  col: number
  intensity: number
} | null>(null)
const containerW = ref(0)
const containerH = ref(0)

// --- Composables ---
const { zoom, panX, panY, resetZoom, zoomIn, zoomOut, onWheel, onPanStart } = useZoomPan(
  () => containerW.value,
  () => containerH.value,
)

const { scheduleRender, observeContainer } = useCanvasRenderer({
  canvasRef,
  containerW,
  containerH,
  matrix: computed(() => props.matrix),
  matrixCols: computed(() => props.matrixCols),
  matrixRows: computed(() => props.matrixRows),
  colormap: computed(() => props.colormap),
  intensityScale: computed(() => props.intensityScale),
  displayMin: computed(() => props.displayMin),
  displayMax: computed(() => props.displayMax),
  overlayData: computed(() => props.overlayData),
  overlayWidth: computed(() => props.overlayWidth),
  overlayHeight: computed(() => props.overlayHeight),
})

function onContainerWheel(e: WheelEvent) {
  if (props.drawMode) return
  onWheel(e, containerRef.value)
  // Zoom/pan is handled by CSS transform — canvas content stays the same.
}

function onContainerPanStart(e: MouseEvent) {
  if (props.drawMode) return
  onPanStart(e, containerRef.value)
  // Zoom/pan is handled by CSS transform — canvas content stays the same.
}

// --- Hover ---
function onHover(e: MouseEvent) {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const data = props.matrix
  const cols = props.matrixCols
  const rows = props.matrixRows
  if (!data || !data.length || !cols || !rows) return
  const W = rect.width,
    H = rect.height
  const pad = 0.04
  const availW = W * (1 - pad * 2)
  const availH = H * (1 - pad * 2)
  const scaleVal = Math.min(availW / cols, availH / rows)
  const drawW = Math.floor(cols * scaleVal)
  const drawH = Math.floor(rows * scaleVal)
  const ox = Math.floor((W - drawW) / 2)
  const oy = Math.floor((H - drawH) / 2)
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const cx = (mx - panX.value) / zoom.value
  const cy = (my - panY.value) / zoom.value
  const col = Math.floor((cx - ox) * cols / drawW)
  const row = Math.floor((cy - oy) * rows / drawH)
  if (row >= 0 && row < rows && col >= 0 && col < cols) {
    hoverPixel.value = { x: mx, y: my, row, col, intensity: data[row * cols + col]! }
  } else {
    hoverPixel.value = null
  }
}

// --- Lifecycle ---
onMounted(() => {
  if (containerRef.value) {
    observeContainer(containerRef.value)
    containerW.value = Math.floor(containerRef.value.getBoundingClientRect().width)
    containerH.value = Math.floor(containerRef.value.getBoundingClientRect().height)
    panX.value = (containerW.value * (1 - zoom.value)) / 2
    panY.value = (containerH.value * (1 - zoom.value)) / 2
  }
  scheduleRender()
})

watch(
  () => [
    props.colormap,
    props.intensityScale,
    props.matrix,
    props.selectedMz,
    props.displayMin,
    props.displayMax,
    props.overlayData,
  ],
  () => scheduleRender(),
  { deep: true },
)
</script>
