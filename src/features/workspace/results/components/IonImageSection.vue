<script setup lang="ts">
import IonImageViewer from '@/features/workspace/results/components/visuals/IonImageViewer.vue'
import ROIOverlay from '@/features/workspace/results/components/visuals/ROIOverlay.vue'
import type { ROIType } from '@/features/workspace/results/composables/useROI'

defineProps<{
  ionMatrix: Float32Array | null
  displayMatrix: Float32Array | null
  selectedMz: number
  mzTolerance: number
  colormap: string
  intensityScale: string
  displayMin: number
  displayMax: number
  dataMax: number
  ionCols: number
  ionRows: number
  meta: {
    analyzer: string
    ionSource: string
    pixelSize: string
  }
  roiTool: ROIType | null
  overlayData: Uint8ClampedArray | null
  gradientCss: string
  calcHandleTop: (value: number) => number
  clampPct: (value: number) => number
  formatVal: (value: number) => string
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
}>()
</script>

<template>
  <div class="flex-1 min-h-0 flex gap-2">
    <div
      class="flex-1 card bg-base-100 border border-base-200 rounded-xl p-4 flex flex-col overflow-hidden"
    >
      <div
        v-if="!ionMatrix"
        class="flex-1 flex items-center justify-center text-base-content/40 text-lg"
      >
        Loading ion image...
      </div>
      <div v-else class="flex-1 min-h-0 relative overflow-hidden">
        <IonImageViewer
          :selected-mz="selectedMz"
          :mz-tolerance="mzTolerance"
          :colormap="colormap"
          :intensity-scale="intensityScale"
          :display-min="displayMin"
          :display-max="displayMax"
          :matrix="displayMatrix"
          :matrix-cols="ionCols"
          :matrix-rows="ionRows"
          :meta-info="meta"
          :draw-mode="!!roiTool"
          :overlay-data="overlayData"
          :overlay-width="ionCols"
          :overlay-height="ionRows"
          @update:mz-tolerance="emit('update:mzTolerance', $event)"
          @update:colormap="emit('update:colormap', $event)"
          @update:intensity-scale="emit('update:intensityScale', $event)"
          @reset="emit('reset-controls')"
        />
        <ROIOverlay
          :ref="
            (element) => emit('roi-overlay-ref', element as InstanceType<typeof ROIOverlay> | null)
          "
          :tool="roiTool"
          :image-width="ionCols"
          :image-height="ionRows"
          @draft-updated="emit('draft-updated', $event)"
          @draft-cleared="emit('draft-cleared')"
        />
      </div>
    </div>

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
