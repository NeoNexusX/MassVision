<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ROIPanel from '@/features/workspace/results/components/visuals/ROIPanel.vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import type { OverlayKind, KmeansCluster } from '@/features/workspace/results/composables/useOverlayData'

const props = defineProps<{
  umapVisible: boolean
  kmeansVisible: boolean
  overlayLoading: boolean
  /** True while the initial create-task POST is in flight. */
  clusteringCreating: boolean
  /** True when the clustering task exists but hasn't completed - shows a computing row with a Refresh button. */
  clusteringComputing: boolean
  /** True once the clustering zarr is loaded - UMAP/KMeans buttons become interactive. */
  clusteringReady: boolean
  /** True while a refresh POST is in flight. */
  clusteringRefreshing: boolean
  /** Clustering load error (e.g. zarr not ready yet); shows a retry affordance. */
  overlayError?: string | null
  umapAlpha: number
  kmeansAlpha: number
  /** KMeans clusters for the picker (id + color + pixel count). */
  kmeansClusters: KmeansCluster[]
  /** False until a local KMeans run produced labels - show a hint instead of hiding the picker silently. */
  kmeansLabelsAvailable: boolean
  /** The k of the current KMeans result (null = never run). */
  kmeansK: number | null
  /** True while a local KMeans computation is in flight. */
  kmeansComputing: boolean
  /** Selected cluster ids (null = all). */
  selectedKmeansIds: Set<number> | null
  /** 'continuous' | 'processed' — UMAP/KMeans only apply to continuous data */
  storageMode: string
  roiTool: string | null
  draftReady: boolean
  viewingRoi: boolean
  confirmedRois: any[]
  gamma: number
  /** Local dataset: UMAP ships inside the zarr - buttons work directly, no enable gate. */
  local?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-overlay', kind: OverlayKind): void
  (e: 'retry-clustering'): void
  /** Fired when the user confirms the first-time enable - the parent POSTs
   *  the (idempotent) clustering task. */
  (e: 'enable-clustering'): void
  /** Fired by the Refresh button while the task is computing. */
  (e: 'refresh-clustering'): void
  (e: 'update:umapAlpha', value: number): void
  (e: 'update:kmeansAlpha', value: number): void
  (e: 'toggle-kmeans-cluster', id: number): void
  (e: 'kmeans-select-all'): void
  (e: 'kmeans-clear-all'): void
  /** Fired when the user confirms a k in the KMeans dialog - the parent runs
   *  the local clustering over the UMAP raster. */
  (e: 'run-kmeans', k: number): void
  (e: 'export-umap'): void
  (e: 'export-kmeans'): void
  (e: 'update:roiTool', value: string | null): void
  (e: 'roi-confirm'): void
  (e: 'roi-cancel'): void
  (e: 'roi-delete', id: string): void
  (e: 'roi-clear-all'): void
  (e: 'roi-reset'): void
  /** Local datasets: import pre-computed reference ROIs (pathology regions). */
  (e: 'import-reference-rois'): void
  (e: 'update:gamma', value: number): void
}>()

// UMAP/KMeans overlays are opt-in: buttons stay grayed out until the user
// flips this switch. First-time enabling asks for confirmation (it starts a
// backend clustering task); re-enabling an existing task does not.
// Local datasets skip the gate entirely - their UMAP is read from the zarr.
const computationEnabled = ref(false)
const enabled = computed(() => props.local || computationEnabled.value)
const showConfirm = ref(false)
const toggleRef = ref<HTMLInputElement | null>(null)

const isContinuous = computed(() => props.storageMode === 'continuous')

// KMeans is computed locally: the button opens a k-input dialog the first
// time, and toggles the cached result afterwards. "Re-run" reopens the dialog.
const showKmeansDialog = ref(false)
const kInput = ref(5)
const K_MIN = 2
const K_MAX = 20

function onKmeansClick() {
  if (props.kmeansVisible || props.kmeansK !== null) {
    // A result already exists (or is showing) - plain toggle.
    emit('toggle-overlay', 'kmeans')
    return
  }
  kInput.value = 5
  showKmeansDialog.value = true
}

function openKmeansDialog() {
  kInput.value = props.kmeansK ?? 5
  showKmeansDialog.value = true
}

function onKmeansConfirm() {
  const k = Math.round(kInput.value)
  if (!(k >= K_MIN && k <= K_MAX)) return
  emit('run-kmeans', k)
}

// Close the dialog once a run succeeds (kmeansK gets set).
watch(() => props.kmeansK, (v) => {
  if (v !== null) showKmeansDialog.value = false
})

// Recover the enable state when the task turns out ready - either from the
// page-entry probe (a finished task already existed) or from a Refresh that
// found completion. No confirmation needed: no new compute is triggered.
watch(() => props.clusteringReady, (ready) => {
  if (ready) computationEnabled.value = true
})

function isClusterSelected(id: number): boolean {
  return props.selectedKmeansIds === null || props.selectedKmeansIds.has(id)
}

const selectedClusterCount = computed(() =>
  props.selectedKmeansIds === null
    ? props.kmeansClusters.length
    : props.selectedKmeansIds.size,
)

function onToggleComputation(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  if (checked) {
    if (props.clusteringReady || props.clusteringComputing) {
      // The task already exists - enabling only reads data/status, so skip
      // the compute-cost confirmation.
      computationEnabled.value = true
    } else {
      // First-time creation: warn before starting the backend task.
      showConfirm.value = true
    }
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
  // Kick off task creation immediately on confirm; the toast + status rows
  // are driven by the composable in response to this.
  emit('enable-clustering')
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
    <div class="text-lg font-semibold text-base-content mb-2">Visualization</div>

    <div class="mb-3">
      <div class="flex items-center justify-between mb-1">
        <span class="text-base text-base-content">Gamma</span>
        <span class="text-base font-mono text-base-content">{{ gamma.toFixed(1) }}</span>
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
      <div class="flex justify-between text-base text-base-content mt-0.5">
        <span>0.5</span>
        <span>1.0</span>
        <span>1.5</span>
      </div>
    </div>

    <!-- UMAP / KMeans: only available for continuous storage -->
    <div v-if="isContinuous" class="mt-2">
      <label
        v-if="!local"
        class="flex items-center justify-between mb-2 cursor-pointer select-none"
        :class="{ 'opacity-60 pointer-events-none': clusteringCreating }"
      >
        <span class="text-base text-base-content">Enable UMAP / KMeans</span>
        <input
          ref="toggleRef"
          type="checkbox"
          class="toggle toggle-sm toggle-primary"
          :checked="computationEnabled"
          :disabled="clusteringCreating"
          @change="onToggleComputation"
        />
      </label>

      <div v-if="clusteringCreating" class="text-base text-base-content/60 mt-1.5 flex items-center gap-1">
        <span class="loading loading-spinner loading-xs"></span>
        Creating UMAP/KMeans task…
      </div>
      <div
        v-else-if="clusteringComputing && !clusteringReady"
        class="text-base text-base-content/60 mt-1.5 flex items-center gap-2"
      >
        <span class="loading loading-spinner loading-xs"></span>
        <span class="flex-1">Clustering is computing…</span>
        <button
          class="btn btn-ghost btn-sm text-base"
          :disabled="clusteringRefreshing"
          @click="emit('refresh-clustering')"
        >
          <span v-if="clusteringRefreshing" class="loading loading-spinner loading-xs"></span>
          Refresh
        </button>
      </div>

      <div class="flex gap-2">
        <button
          class="btn btn-sm flex-1 text-lg rounded-lg transition-colors"
          :class="
            !enabled || !clusteringReady
              ? 'bg-base-200 dark:bg-base-300 text-base-content/40 border-base-300 dark:border-base-400 cursor-not-allowed'
              : umapVisible
                ? 'bg-teal-500 text-white border-teal-500'
                : 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-200 dark:hover:bg-teal-900'
          "
          :disabled="!enabled || !clusteringReady || overlayLoading || clusteringCreating"
          @click="emit('toggle-overlay', 'umap')"
        >
          UMAP
        </button>
        <button
          class="btn btn-sm flex-1 text-lg rounded-lg transition-colors"
          :class="
            !enabled || !clusteringReady
              ? 'bg-base-200 dark:bg-base-300 text-base-content/40 border-base-300 dark:border-base-400 cursor-not-allowed'
              : kmeansVisible
                ? 'bg-rose-500 text-white border-rose-500'
                : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900'
          "
          :disabled="!enabled || !clusteringReady || overlayLoading || clusteringCreating || kmeansComputing"
          @click="onKmeansClick"
        >
          KMeans
        </button>
      </div>

      <div v-if="overlayLoading && enabled" class="text-base text-base-content/60 mt-1.5 flex items-center gap-1">
        <span class="loading loading-spinner loading-xs"></span>
        Loading overlay…
      </div>

      <div v-if="overlayError" class="text-base text-error mt-1.5 flex items-center gap-2">
        <span class="flex-1">UMAP/KMeans unavailable: {{ overlayError }}</span>
        <button class="btn btn-ghost btn-sm text-base text-error" @click="emit('retry-clustering')">Retry</button>
      </div>
    </div>

    <!-- Overlay opacity: one slider per active overlay -->
    <div v-if="umapVisible" class="mt-3">
      <div class="flex items-center justify-between text-base font-semibold text-base-content mb-1">
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
      <button
        class="btn btn-sm btn-ghost gap-1 mt-1.5 text-base w-full"
        title="Export UMAP image as PNG"
        @click="emit('export-umap')"
      >
        <SvgIcon type="download" class="w-4 h-4" />
        Export UMAP PNG
      </button>
    </div>
    <div v-if="kmeansVisible" class="mt-3">
      <div class="flex items-center justify-between text-base font-semibold text-base-content mb-1">
        <span>
          KMeans opacity
          <span v-if="kmeansK !== null" class="ml-1.5 text-base font-mono font-normal text-base-content/60">(k={{ kmeansK }})</span>
        </span>
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
      <button
        class="btn btn-sm btn-ghost gap-1 mt-1.5 text-base w-full"
        title="Export KMeans image as PNG"
        @click="emit('export-kmeans')"
      >
        <SvgIcon type="download" class="w-4 h-4" />
        Export KMeans PNG
      </button>

      <!-- Cluster picker: also drives the export mask -->
      <div v-if="kmeansClusters.length" class="mt-2 pt-2 border-t border-base-content/15">
        <div class="flex items-center justify-between mb-1">
          <span class="text-base font-semibold text-base-content">
            Clusters
            <span class="font-mono font-normal text-base-content/60">
              {{ selectedClusterCount }}/{{ kmeansClusters.length }}
            </span>
          </span>
          <span class="flex gap-1">
            <button class="btn btn-ghost btn-sm text-base" title="Re-run with a different k" @click="openKmeansDialog">Re-run</button>
            <button class="btn btn-ghost btn-sm text-base" @click="emit('kmeans-select-all')">All</button>
            <button class="btn btn-ghost btn-sm text-base" @click="emit('kmeans-clear-all')">Clear</button>
          </span>
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 max-h-48 overflow-y-auto">
          <label
            v-for="c in kmeansClusters"
            :key="c.id"
            class="flex items-center gap-1.5 py-1 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              class="checkbox checkbox-xs checkbox-primary"
              :checked="isClusterSelected(c.id)"
              @change="emit('toggle-kmeans-cluster', c.id)"
            />
            <span
              class="w-3 h-3 rounded-sm border border-base-content/30 shrink-0"
              :style="{ backgroundColor: `rgb(${c.color[0]},${c.color[1]},${c.color[2]})` }"
            ></span>
            <span class="text-base text-base-content truncate">Cluster {{ c.id }}</span>
          </label>
        </div>
        <div v-if="selectedClusterCount === 0" class="text-base text-base-content/50 mt-1">
          No clusters selected - overlay hidden
        </div>
      </div>
      <div
        v-else-if="!kmeansLabelsAvailable"
        class="mt-2 pt-2 border-t border-base-content/15 text-base text-base-content/50"
      >
        Run KMeans to compute clusters locally.
      </div>
    </div>
  </div>

  <div class="mt-5 pt-4 border-t border-base-content/25">
    <div class="text-lg font-semibold text-base-content mb-2">Region of interest</div>
    <ROIPanel
      :selected-tool="roiTool"
      :draft-ready="draftReady"
      :show-reset="viewingRoi"
      :rois="confirmedRois as any"
      :show-import="local"
      @update:selected-tool="emit('update:roiTool', $event)"
      @confirm="emit('roi-confirm')"
      @cancel="emit('roi-cancel')"
      @delete="emit('roi-delete', $event)"
      @clear-all="emit('roi-clear-all')"
      @reset="emit('roi-reset')"
      @import-reference="emit('import-reference-rois')"
    />
  </div>

  <!-- Opt-in confirmation: first-time enable starts a backend clustering task -->
  <ConfirmDialog
    :open="showConfirm"
    title="Generate UMAP"
    message="This starts a backend clustering task to compute the UMAP embedding, which may take a while. KMeans clustering itself runs locally in your browser. Continue?"
    confirm-label="Continue"
    @confirm="confirmEnable"
    @cancel="cancelEnable"
  />

  <!-- KMeans: local clustering with a user-chosen k -->
  <ConfirmDialog
    :open="showKmeansDialog"
    title="Run KMeans"
    confirm-label="Compute"
    :loading="kmeansComputing"
    @confirm="onKmeansConfirm"
    @cancel="showKmeansDialog = false"
  >
    <div class="flex items-center gap-3">
      <span class="text-base">Number of clusters (k):</span>
      <input
        v-model.number="kInput"
        type="number"
        :min="K_MIN"
        :max="K_MAX"
        class="input input-sm input-bordered w-20 text-base"
      />
    </div>
    <p class="text-base text-base-content/60 mt-2">
      Computed locally from the UMAP embedding ({{ K_MIN }}–{{ K_MAX }}).
    </p>
  </ConfirmDialog>
</template>
