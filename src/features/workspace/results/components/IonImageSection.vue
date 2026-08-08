<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import IonImageViewer from '@/features/workspace/results/components/visuals/IonImageViewer.vue'
import ROIOverlay from '@/features/workspace/results/components/visuals/ROIOverlay.vue'
import type { ROIType } from '@/features/workspace/results/composables/useROI'
import type { DataMode } from '@/services/zarr/types/zarr'

const props = defineProps<{
  isStale?: boolean
  ionMatrix: Float32Array | null
  displayMatrix: Float32Array | null
  selectedMz: number
  mzTolerance: number
  colormap: string
  intensityScale: string
  gamma: number
  displayMin: number
  displayMax: number
  dataMax: number
  ionCols: number
  ionRows: number
  roiTool: ROIType | null
  overlayData: Uint8ClampedArray | null
  gradientCss: string
  calcHandleTop: (value: number) => number
  clampPct: (value: number) => number
  formatVal: (value: number) => string
  /** 数据模式 */
  dataMode?: DataMode | null
  /** 当前选中像素坐标（processed 模式） */
  selectedPixelCoord?: { x: number; y: number } | null
  /** 离子图是否正在加载（切换 m/z 时） */
  ionLoading?: boolean
  /** 归一化计算是否进行中 */
  normalizationLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:mzTolerance', value: number): void
  (e: 'update:colormap', value: string): void
  (e: 'update:intensityScale', value: string): void
  (e: 'reset-controls'): void
  (e: 'reset-range'): void
  (e: 'strip-ref', element: HTMLElement | null): void
  (e: 'strip-mouse-down', event: MouseEvent): void
  (e: 'start-strip-drag', which: 'min' | 'max', event: MouseEvent): void
  (e: 'draft-updated', draft: any): void
  (e: 'draft-cleared'): void
  (e: 'roi-overlay-ref', element: InstanceType<typeof ROIOverlay> | null): void
  /** processed 模式：点击 TIC 图像中某个像素 */
  (e: 'select-pixel', col: number, row: number): void
}>()

const ionViewerRef = ref<InstanceType<typeof IonImageViewer> | null>(null)
const roiOverlayRef = ref<InstanceType<typeof ROIOverlay> | null>(null)

watch(roiOverlayRef, (el) => emit('roi-overlay-ref', el ?? null))

/** 根据模式选择标题 */
const imageTitle = computed(() =>
  props.dataMode === 'processed' ? 'TIC Image' : 'Ion Image',
)

/** 图像加载占位提示 */
const processedPlaceholder = computed(() => {
  if (props.dataMode === 'processed') return 'Computing TIC image, please wait a moment...'
  if (props.dataMode === null) return 'Loading result…'
  return 'Loading ion image, please wait a moment...'
})

// ---- 延迟 loading overlay：避免快速切换时一闪而过 ----

const LOADING_DELAY = 250 // ms，loading 持续超过此阈值才显示 overlay
let delayTimer: ReturnType<typeof setTimeout> | null = null
const showLoadingOverlay = ref(false)

watch(
  () => props.ionLoading,
  (loading) => {
    if (loading) {
      delayTimer = setTimeout(() => {
        showLoadingOverlay.value = true
      }, LOADING_DELAY)
    } else {
      if (delayTimer) {
        clearTimeout(delayTimer)
        delayTimer = null
      }
      showLoadingOverlay.value = false
    }
  },
)

// Clear any pending loading-delay timer on unmount
onBeforeUnmount(() => {
  if (delayTimer) {
    clearTimeout(delayTimer)
    delayTimer = null
  }
})
</script>

<template>
  <!-- 桌面端与谱图按 5:2 分高、硬底线 360px；移动端自然高 -->
  <div class="flex gap-2 p-4 min-h-[360px] shrink-0 lg:h-auto lg:flex-[5]">
    <div
      class="flex-1 card bg-base-100 rounded-xl p-4 flex flex-col overflow-hidden"
    >
      <div
        v-if="isStale"
        class="flex-1 flex flex-col items-center justify-center text-base-content/40 gap-1"
      >
        <p class="text-lg">No result selected</p>
        <p class="text-sm">Navigate from the Workspace dashboard to view a result.</p>
      </div>
      <div
        v-else-if="!ionMatrix"
        class="flex-1 flex items-center justify-center text-base-content/40 text-lg"
      >
        {{ processedPlaceholder }}
      </div>
      <div v-else class="flex-1 min-h-0 relative overflow-hidden">
        <IonImageViewer
          ref="ionViewerRef"
          :selected-mz="selectedMz"
          :mz-tolerance="mzTolerance"
          :colormap="colormap"
          :intensity-scale="intensityScale"
          :gamma="gamma"
          :display-min="displayMin"
          :display-max="displayMax"
          :matrix="displayMatrix"
          :matrix-cols="ionCols"
          :matrix-rows="ionRows"
          :draw-mode="!!roiTool"
          :overlay-data="overlayData"
          :overlay-width="ionCols"
          :overlay-height="ionRows"
          :data-mode="dataMode"
          :selected-pixel-coord="selectedPixelCoord"
          :image-title="imageTitle"
          @update:mz-tolerance="emit('update:mzTolerance', $event)"
          @update:colormap="emit('update:colormap', $event)"
          @update:intensity-scale="emit('update:intensityScale', $event)"
          @reset="emit('reset-controls')"
          @select-pixel="(col, row) => emit('select-pixel', col, row)"
        />
        <!-- 归一化计算遮罩 -->
        <div
          v-if="normalizationLoading"
          class="absolute inset-0 flex items-center justify-center bg-base-100/80 backdrop-blur-[2px] z-20"
        >
          <div class="flex flex-col items-center gap-3">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <span class="text-base-content/70 text-lg">Computing normalization…</span>
          </div>
        </div>
        <!-- 切换 m/z 时的加载遮罩（延迟出现，避免快速切换一闪而过） -->
        <div
          v-if="showLoadingOverlay && ionMatrix"
          class="absolute inset-0 flex items-center justify-center bg-base-100/80 backdrop-blur-[2px] z-10 transition-opacity duration-200"
        >
          <div class="flex flex-col items-center gap-3">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <span class="text-base-content/70 text-lg">Updating ion image…</span>
          </div>
        </div>
        <ROIOverlay
          ref="roiOverlayRef"
          :tool="roiTool"
          :image-width="ionCols"
          :image-height="ionRows"
          :target-el="ionViewerRef?.canvasContainer ?? null"
          @draft-updated="emit('draft-updated', $event)"
          @draft-cleared="emit('draft-cleared')"
        />
      </div>
    </div>

    <!-- 强度条 -->
    <div class="shrink-0 flex flex-col items-center gap-1.5 w-12">
      <button
        class="text-sm text-base-content/40 hover:text-base-content"
        title="Reset to auto range"
        @click="emit('reset-range')"
      >
        ↺
      </button>
      <span
        class="text-sm font-mono text-base-content/60 leading-none text-center whitespace-nowrap"
      >
        {{ formatVal(dataMax) }}
      </span>
      <div
        :ref="(element) => emit('strip-ref', element as HTMLElement | null)"
        class="flex-1 w-5 rounded-sm border border-base-300 relative cursor-pointer bg-base-200"
        @mousedown.prevent="emit('strip-mouse-down', $event)"
      >
        <div class="absolute inset-0 rounded-sm" :style="{ background: gradientCss }"></div>
        <div
          class="absolute left-0 right-0 h-3 cursor-ns-resize z-10 flex items-center justify-center"
          :style="{ top: clampPct(calcHandleTop(displayMax)) + '%', transform: 'translateY(-50%)' }"
          @mousedown.prevent.stop="emit('start-strip-drag', 'max', $event)"
        >
          <div class="w-full h-[3px] bg-base-100 rounded shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"></div>
        </div>
        <div
          class="absolute left-0 right-0 h-3 cursor-ns-resize z-10 flex items-center justify-center"
          :style="{ top: clampPct(calcHandleTop(displayMin)) + '%', transform: 'translateY(-50%)' }"
          @mousedown.prevent.stop="emit('start-strip-drag', 'min', $event)"
        >
          <div class="w-full h-[3px] bg-base-100 rounded shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"></div>
        </div>
      </div>
      <span
        class="text-sm font-mono text-base-content/60 leading-none text-center whitespace-nowrap"
      >
        {{ formatVal(displayMin) }}
      </span>
    </div>
  </div>
</template>
