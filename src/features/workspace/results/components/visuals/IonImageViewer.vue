<template>
  <div class="flex flex-col h-full">
    <IonImageToolbar
      :selected-mz="selectedMz"
      :mz-tolerance="mzTolerance"
      :colormap="colormap"
      :intensity-scale="intensityScale"
      :data-mode="dataMode"
      :pixel-coord="selectedPixelCoord"
      :title="imageTitle"
      @update:mz-tolerance="$emit('update:mzTolerance', $event)"
      @update:colormap="$emit('update:colormap', $event)"
      @update:intensity-scale="$emit('update:intensityScale', $event)"
      @reset="$emit('reset')"
      @download="exportPng"
    />
    <div
      data-testid="ion-image-viewer"
      ref="containerRef"
      class="relative flex-1 min-h-0 bg-base-200 rounded-lg border border-base-300 overflow-hidden"
      :class="containerCursorClass"
      @mousedown="onContainerMouseDown"
      @click="onContainerClick"
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
      <!-- 悬停提示 -->
      <div
        v-if="hoverPixel"
        class="absolute pointer-events-none bg-base-100/90 backdrop-blur-sm text-sm px-2 py-1 rounded shadow border border-base-300 font-mono"
        :style="{ left: hoverPixel.x + 12 + 'px', top: hoverPixel.y + 12 + 'px' }"
      >
        <template v-if="dataMode === 'processed'">
          ({{ hoverPixel.col + 1 }}, {{ hoverPixel.row + 1 }})
          {{ hoverPixel.intensity.toExponential(2) }}
        </template>
        <template v-else>
          ({{ hoverPixel.col + 1 }}, {{ hoverPixel.row + 1 }}) — {{ hoverPixel.intensity.toExponential(2) }}
        </template>
      </div>
      <!-- 缩放控件 -->
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
import { ref, computed, watch, onMounted, onBeforeUnmount, type PropType } from 'vue'
import IonImageToolbar from './IonImageToolbar.vue'
import { useZoomPan } from '../../composables/useZoomPan'
import { useCanvasRenderer } from '../../composables/useCanvasRenderer'
import { computeFitTransform, fitPointToMatrixCell } from '../../utils/fitTransform'
import type { DataMode } from '@/services/zarr/types/zarr'

const props = defineProps({
  selectedMz: { type: Number, required: true },
  mzTolerance: { type: Number, required: true },
  colormap: { type: String, required: true },
  intensityScale: { type: String, required: true },
  gamma: { type: Number, default: 1 },
  displayMin: { type: Number, default: undefined },
  displayMax: { type: Number, default: undefined },
  matrix: { type: Object as PropType<Float32Array | null>, default: null },
  matrixCols: { type: Number, default: 0 },
  matrixRows: { type: Number, default: 0 },
  drawMode: { type: Boolean, default: false },
  overlayData: { type: Object as PropType<Uint8ClampedArray | null>, default: null },
  overlayWidth: { type: Number, default: 0 },
  overlayHeight: { type: Number, default: 0 },
  /** 数据模式 */
  dataMode: { type: String as PropType<DataMode | null>, default: null },
  /** 当前选中像素坐标（processed 模式） */
  selectedPixelCoord: { type: Object as PropType<{ x: number; y: number } | null>, default: null },
  /** 图片区域标题 */
  imageTitle: { type: String, default: 'Ion Image' },
})

const emit = defineEmits<{
  (e: 'update:mzTolerance', v: number): void
  (e: 'update:colormap', v: string): void
  (e: 'update:intensityScale', v: string): void
  (e: 'reset'): void
  /** processed 模式：点击像素 */
  (e: 'select-pixel', col: number, row: number): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const hoverPixel = ref<{
  x: number; y: number; row: number; col: number; intensity: number
} | null>(null)
const containerW = ref(0)
const containerH = ref(0)

// 区分拖拽和点击
let mouseDownPos = { x: 0, y: 0 }
let mouseMoved = false
let pendingMouseUp: ((ev: MouseEvent) => void) | null = null

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
  gamma: computed(() => props.gamma),
  displayMin: computed(() => props.displayMin),
  displayMax: computed(() => props.displayMax),
  overlayData: computed(() => props.overlayData),
  overlayWidth: computed(() => props.overlayWidth),
  overlayHeight: computed(() => props.overlayHeight),
})

/** 容器光标样式 */
const containerCursorClass = computed(() => {
  if (props.drawMode) return 'cursor-default'
  if (props.dataMode === 'processed') return 'cursor-crosshair'
  if (zoom.value > 1) return 'cursor-grab'
  return 'cursor-crosshair'
})

function onContainerWheel(e: WheelEvent) {
  if (props.drawMode) return
  onWheel(e, containerRef.value)
}

// --- 鼠标事件：拖拽 + 点击 ---

function onContainerMouseDown(e: MouseEvent) {
  mouseDownPos = { x: e.clientX, y: e.clientY }
  mouseMoved = false

  if (props.drawMode) return

  // 缩放 > 1 时支持拖拽平移
  if (zoom.value > 1 && e.button === 0) {
    onPanStart(e, containerRef.value)
    // 监听 mouseup 来判断是拖拽还是点击
    const onUp = (ev: MouseEvent) => {
      const dx = ev.clientX - mouseDownPos.x
      const dy = ev.clientY - mouseDownPos.y
      mouseMoved = Math.abs(dx) > 3 || Math.abs(dy) > 3
      document.removeEventListener('mouseup', onUp)
      pendingMouseUp = null
    }
    document.addEventListener('mouseup', onUp)
    pendingMouseUp = onUp
  }
}

// 在容器的 click 事件中处理像素选择
function onContainerClick(e: MouseEvent) {
  if (mouseMoved) return  // 拖拽不触发点击
  if (props.drawMode) return
  if (props.dataMode !== 'processed') return  // 仅 processed 模式

  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const data = props.matrix
  const cols = props.matrixCols
  const rows = props.matrixRows
  if (!data || !data.length || !cols || !rows) return

  const W = rect.width, H = rect.height
  const t = computeFitTransform(W, H, cols, rows)

  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const cx = (mx - panX.value) / zoom.value
  const cy = (my - panY.value) / zoom.value
  const { col, row } = fitPointToMatrixCell(cx, cy, t, cols, rows)

  if (row >= 0 && row < rows && col >= 0 && col < cols) {
    emit('select-pixel', col, row)
  }
}

// --- 悬停 ---

function onHover(e: MouseEvent) {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const data = props.matrix
  const cols = props.matrixCols
  const rows = props.matrixRows
  if (!data || !data.length || !cols || !rows) return
  const W = rect.width, H = rect.height
  const t = computeFitTransform(W, H, cols, rows)
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const cx = (mx - panX.value) / zoom.value
  const cy = (my - panY.value) / zoom.value
  const { col, row } = fitPointToMatrixCell(cx, cy, t, cols, rows)
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

// Remove any pending mouseup listener if the component unmounts mid-drag
onBeforeUnmount(() => {
  if (pendingMouseUp) document.removeEventListener('mouseup', pendingMouseUp)
})

watch(
  () => [
    props.colormap,
    props.intensityScale,
    props.gamma,
    props.matrix,
    props.displayMin,
    props.displayMax,
    props.overlayData,
  ],
  () => scheduleRender(),
)

/** Export the current canvas content as a PNG download. */
function exportPng() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dataUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  const mzLabel = props.dataMode === 'continuous'
    ? `_mz_${props.selectedMz.toFixed(4)}`
    : ''
  link.download = `ion_image${mzLabel}.png`
  link.href = dataUrl
  link.click()
}

defineExpose({ canvasContainer: containerRef })
</script>
