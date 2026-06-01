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
import { ref, watch, onMounted, type PropType } from 'vue'
import IonImageToolbar from './IonImageToolbar.vue'
import { useZoomPan } from '../../composables/useZoomPan'
import { useCanvasRenderer } from '../../composables/useCanvasRenderer'
import { generateMockMatrix } from '../../utils/mockData'

const props = defineProps({
  selectedMz: { type: Number, required: true },
  mzTolerance: { type: Number, required: true },
  colormap: { type: String, required: true },
  intensityScale: { type: String, required: true },
  displayMin: { type: Number, default: undefined },
  displayMax: { type: Number, default: undefined },
  matrix: { type: Array as PropType<number[][] | null>, default: null },
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

const { scheduleRender, observeContainer, setMockData } = useCanvasRenderer({
  canvasRef,
  containerW,
  containerH,
  matrix: ref(props.matrix),
  colormap: ref(props.colormap),
  intensityScale: ref(props.intensityScale),
  displayMin: ref(props.displayMin),
  displayMax: ref(props.displayMax),
  overlayData: ref(props.overlayData),
  overlayWidth: ref(props.overlayWidth),
  overlayHeight: ref(props.overlayHeight),
})

function onContainerWheel(e: WheelEvent) {
  if (props.drawMode) return
  onWheel(e, containerRef.value)
  scheduleRender()
}

function onContainerPanStart(e: MouseEvent) {
  if (props.drawMode) return
  onPanStart(e, containerRef.value)
  scheduleRender()
}

// --- Hover ---
function onHover(e: MouseEvent) {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const data = props.matrix ?? []
  if (!data.length) return
  const rows = data.length,
    cols = data[0]?.length ?? 0
  const W = rect.width,
    H = rect.height
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

// --- Lifecycle ---
onMounted(() => {
  setMockData(generateMockMatrix(600, 800))
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
