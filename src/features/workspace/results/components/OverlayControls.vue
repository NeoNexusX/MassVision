<script setup lang="ts">
import ROIPanel from '@/features/workspace/results/components/visuals/ROIPanel.vue'
import type { OverlayMode } from '@/features/workspace/results/composables/useOverlayData'

defineProps<{
  overlayMode: OverlayMode
  overlayLoading: boolean
  overlayAlpha: number
  roiTool: string | null
  draftReady: boolean
  viewingRoi: boolean
  confirmedRois: any[]
}>()

const emit = defineEmits<{
  (e: 'toggle-overlay', mode: OverlayMode): void
  (e: 'update:overlayAlpha', value: number): void
  (e: 'update:roiTool', value: string | null): void
  (e: 'roi-confirm'): void
  (e: 'roi-cancel'): void
  (e: 'roi-delete', id: string): void
  (e: 'roi-clear-all'): void
  (e: 'roi-reset'): void
}>()
</script>

<template>
  <div class="mt-3 pt-3 border-t border-base-200">
    <div class="text-base font-semibold text-base-content/50 mb-2">Statistical Visualization</div>
    <div class="flex gap-2">
      <button
        class="btn btn-sm flex-1 text-base bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900 rounded-lg"
      >
        TIC
      </button>
      <button
        class="btn btn-sm flex-1 text-base bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900 rounded-lg"
      >
        PCA
      </button>
      <button
        class="btn btn-sm flex-1 text-base rounded-lg transition-colors"
        :class="
          overlayMode === 'umap'
            ? 'bg-teal-500 text-white border-teal-500'
            : 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-200 dark:hover:bg-teal-900'
        "
        :disabled="overlayLoading"
        @click="emit('toggle-overlay', 'umap')"
      >
        UMAP
      </button>
      <button
        class="btn btn-sm flex-1 text-base rounded-lg transition-colors"
        :class="
          overlayMode === 'kmeans'
            ? 'bg-rose-500 text-white border-rose-500'
            : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900'
        "
        :disabled="overlayLoading"
        @click="emit('toggle-overlay', 'kmeans')"
      >
        KMeans
      </button>
    </div>
  </div>

  <div class="mt-3 pt-3 border-t border-base-200">
    <div class="flex items-center justify-between text-base font-semibold text-base-content/50 mb-2">
      <span>Overlay opacity</span>
      <span class="font-mono font-normal text-base">{{ Math.round(overlayAlpha / 2.55) }}%</span>
    </div>
    <input
      type="range"
      :min="0"
      :max="255"
      :value="overlayAlpha"
      class="range range-sm w-full [--range-fill:0] [--range-thumb:bg-sky-400] [--range-bg:theme(colors.blue.100)] dark:[--range-bg:theme(colors.blue.900)]"
      @input="emit('update:overlayAlpha', Number(($event.target as HTMLInputElement).value))"
    />
  </div>

  <div class="mt-3 pt-3 border-t border-base-200">
    <div class="text-base font-semibold text-base-content/50 mb-2">Region of interest</div>
    <ROIPanel
      :selected-tool="roiTool"
      :draft-ready="draftReady"
      :show-reset="viewingRoi"
      :rois="confirmedRois as any"
      @update:selected-tool="emit('update:roiTool', $event)"
      @confirm="emit('roi-confirm')"
      @cancel="emit('roi-cancel')"
      @delete="emit('roi-delete', $event)"
      @clear-all="emit('roi-clear-all')"
      @reset="emit('roi-reset')"
    />
  </div>
</template>
