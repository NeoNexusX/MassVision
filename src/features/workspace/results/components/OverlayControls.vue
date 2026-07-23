<script setup lang="ts">
import { computed, ref } from 'vue'
import ROIPanel from '@/features/workspace/results/components/visuals/ROIPanel.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import type { OverlayKind } from '@/features/workspace/results/composables/useOverlayData'

const props = defineProps<{
  umapVisible: boolean
  kmeansVisible: boolean
  overlayLoading: boolean
  umapAlpha: number
  kmeansAlpha: number
  /** 'continuous' | 'processed' — UMAP/KMeans only apply to continuous data */
  storageMode: string
  roiTool: string | null
  draftReady: boolean
  viewingRoi: boolean
  confirmedRois: any[]
  gamma: number
}>()

const emit = defineEmits<{
  (e: 'toggle-overlay', kind: OverlayKind): void
  (e: 'update:umapAlpha', value: number): void
  (e: 'update:kmeansAlpha', value: number): void
  (e: 'update:roiTool', value: string | null): void
  (e: 'roi-confirm'): void
  (e: 'roi-cancel'): void
  (e: 'roi-delete', id: string): void
  (e: 'roi-clear-all'): void
  (e: 'roi-reset'): void
  (e: 'update:gamma', value: number): void
}>()

// UMAP/KMeans overlays are opt-in: buttons stay grayed out until the user
// flips this switch and acknowledges the time-cost confirmation.
const computationEnabled = ref(false)
const showConfirm = ref(false)
const toggleRef = ref<HTMLInputElement | null>(null)

const isContinuous = computed(() => props.storageMode === 'continuous')

function onToggleComputation(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  if (checked) {
    // Warn about the compute cost before enabling the buttons.
    showConfirm.value = true
  } else {
    computationEnabled.value = false
    // Clear any active overlays when the user opts out.
    if (props.umapVisible) emit('toggle-overlay', 'umap')
    if (props.kmeansVisible) emit('toggle-overlay', 'kmeans')
  }
}

function confirmEnable() {
  computationEnabled.value = true
  showConfirm.value = false
}

function cancelEnable() {
  computationEnabled.value = false
  showConfirm.value = false
  // The toggle was never committed, so revert its visual state manually —
  // :checked won't re-apply because computationEnabled is unchanged.
  if (toggleRef.value) toggleRef.value.checked = false
}
</script>

<template>
  <div class="mt-5 pt-4 border-t border-base-content/25">
    <div class="text-base font-semibold text-base-content mb-2">Visualization</div>

    <div class="mb-3">
      <div class="flex items-center justify-between mb-1">
        <span class="text-sm text-base-content">Gamma</span>
        <span class="text-sm font-mono text-base-content">{{ gamma.toFixed(1) }}</span>
      </div>
      <input
        type="range"
        class="range range-xs range-primary"
        min="0.5"
        max="1.5"
        step="0.1"
        :value="gamma"
        @input="emit('update:gamma', +($event.target as HTMLInputElement).value)"
      />
      <div class="flex justify-between text-xs text-base-content mt-0.5">
        <span>0.5</span>
        <span>1.0</span>
        <span>1.5</span>
      </div>
    </div>

    <!-- UMAP / KMeans: only available for continuous storage -->
    <div v-if="isContinuous" class="mt-2">
      <label class="flex items-center justify-between mb-2 cursor-pointer select-none">
        <span class="text-sm text-base-content">Enable UMAP / KMeans</span>
        <input
          ref="toggleRef"
          type="checkbox"
          class="toggle toggle-sm toggle-primary"
          :checked="computationEnabled"
          @change="onToggleComputation"
        />
      </label>

      <div class="flex gap-2">
        <button
          class="btn btn-sm flex-1 text-base rounded-lg transition-colors"
          :class="
            !computationEnabled
              ? 'bg-base-200 dark:bg-base-300 text-base-content/40 border-base-300 dark:border-base-400 cursor-not-allowed'
              : umapVisible
                ? 'bg-teal-500 text-white border-teal-500'
                : 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-200 dark:hover:bg-teal-900'
          "
          :disabled="!computationEnabled || overlayLoading"
          @click="emit('toggle-overlay', 'umap')"
        >
          UMAP
        </button>
        <button
          class="btn btn-sm flex-1 text-base rounded-lg transition-colors"
          :class="
            !computationEnabled
              ? 'bg-base-200 dark:bg-base-300 text-base-content/40 border-base-300 dark:border-base-400 cursor-not-allowed'
              : kmeansVisible
                ? 'bg-rose-500 text-white border-rose-500'
                : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900'
          "
          :disabled="!computationEnabled || overlayLoading"
          @click="emit('toggle-overlay', 'kmeans')"
        >
          KMeans
        </button>
      </div>

      <div v-if="overlayLoading" class="text-xs text-base-content/60 mt-1.5 flex items-center gap-1">
        <span class="loading loading-spinner loading-xs"></span>
        Computing overlay…
      </div>
    </div>

    <!-- Overlay opacity: one slider per active overlay -->
    <div v-if="umapVisible" class="mt-3">
      <div class="flex items-center justify-between text-sm font-semibold text-base-content mb-1">
        <span>UMAP opacity</span>
        <span class="font-mono font-normal">{{ Math.round(umapAlpha / 2.55) }}%</span>
      </div>
      <input
        type="range"
        :min="0"
        :max="255"
        :value="umapAlpha"
        class="range range-sm w-full [--range-fill:0] [--range-thumb:bg-teal-400] [--range-bg:theme(colors.teal.100)] dark:[--range-bg:theme(colors.teal.900)]"
        @input="emit('update:umapAlpha', +($event.target as HTMLInputElement).value)"
      />
    </div>
    <div v-if="kmeansVisible" class="mt-3">
      <div class="flex items-center justify-between text-sm font-semibold text-base-content mb-1">
        <span>KMeans opacity</span>
        <span class="font-mono font-normal">{{ Math.round(kmeansAlpha / 2.55) }}%</span>
      </div>
      <input
        type="range"
        :min="0"
        :max="255"
        :value="kmeansAlpha"
        class="range range-sm w-full [--range-fill:0] [--range-thumb:bg-rose-400] [--range-bg:theme(colors.rose.100)] dark:[--range-bg:theme(colors.rose.900)]"
        @input="emit('update:kmeansAlpha', +($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>

  <div class="mt-5 pt-4 border-t border-base-content/25">
    <div class="text-base font-semibold text-base-content mb-2">Region of interest</div>
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

  <!-- Opt-in confirmation: UMAP/KMeans computation takes time -->
  <ConfirmDialog
    :open="showConfirm"
    title="Generate UMAP / KMeans"
    message="Generating UMAP and KMeans overlays requires loading extra data and may take some time. Continue?"
    confirm-label="Continue"
    @confirm="confirmEnable"
    @cancel="cancelEnable"
  />
</template>
