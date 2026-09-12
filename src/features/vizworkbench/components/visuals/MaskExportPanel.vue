<template>
  <div class="text-[1.125em]">
    <!-- Format -->
    <div class="flex items-center gap-2 mb-2">
      <span class="text-base-content">Format</span>
      <div class="join">
        <button
          v-for="f in FORMATS"
          :key="f.value"
          class="btn btn-xs join-item text-[1em]"
          :class="format === f.value ? 'btn-primary' : 'btn-ghost'"
          @click="format = f.value"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <div v-if="!hasItems" class="text-base-content/60">
      Draw a ROI or run KMeans to get a mask to export.
    </div>

    <template v-else>
      <div class="text-base-content/60 mb-2">
        Checked regions are merged into a single binary mask.
      </div>

      <!-- ROI regions -->
      <div v-if="rois.length" class="mb-2">
        <div class="font-semibold text-base-content mb-1">ROI masks</div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 max-h-40 overflow-y-auto">
          <label
            v-for="roi in rois"
            :key="roi.id"
            class="flex items-center gap-1.5 py-0.5 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              class="checkbox checkbox-xs checkbox-primary"
              :checked="!deselectedRois.has(roi.id)"
              @change="toggleRoi(roi.id)"
            />
            <span
              class="w-3 h-3 rounded-sm border border-base-content/30 shrink-0"
              :style="{ backgroundColor: roi.color }"
            ></span>
            <span class="text-base-content truncate">{{ roi.label }}</span>
          </label>
        </div>
      </div>

      <!-- KMeans clusters (shared selection with the ion-image overlay) -->
      <div v-if="kmeansClusters.length" class="mb-2">
        <div class="font-semibold text-base-content mb-1">
          KMeans clusters
          <span v-if="kmeansK !== null" class="font-mono font-normal text-base-content/60"
            >(k={{ kmeansK }})</span
          >
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 max-h-40 overflow-y-auto">
          <label
            v-for="c in kmeansClusters"
            :key="c.id"
            class="flex items-center gap-1.5 py-0.5 cursor-pointer select-none"
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
            <span class="text-base-content truncate">Cluster {{ c.id }}</span>
          </label>
        </div>
      </div>
      <div v-else-if="!kmeansLabelsAvailable" class="text-base-content/60 mb-2">
        Run KMeans to also include clusters in the mask.
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-1">
        <button
          class="btn btn-sm btn-primary flex-1 text-[1em]"
          :disabled="selectedCount === 0"
          title="Downloads one mask file"
          @click="onExport"
        >
          <SvgIcon type="download" />
          Export mask
        </button>
        <button class="btn btn-ghost btn-sm text-[1em]" @click="selectAll">All</button>
        <button class="btn btn-ghost btn-sm text-[1em]" @click="clearAll">Clear</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import type { ConfirmedROI } from '@/features/vizworkbench/composables/useROI'
import type { KmeansCluster } from '@/features/vizworkbench/composables/useOverlayData'
import type { ExportFormat, MaskExportPayload } from '@/features/vizworkbench/utils/maskExport'

const props = defineProps<{
  rois: ConfirmedROI[]
  kmeansClusters: KmeansCluster[]
  /** False until a local KMeans run produced labels. */
  kmeansLabelsAvailable: boolean
  /** The k of the current KMeans result (null = never run). */
  kmeansK: number | null
  /** Shared KMeans selection (null = all). Same state the ion-image overlay
   *  uses, so checking a cluster here also shows it on the image. */
  selectedKmeansIds: Set<number> | null
}>()

const emit = defineEmits<{
  (e: 'export-masks', payload: MaskExportPayload): void
  (e: 'toggle-kmeans-cluster', id: number): void
  (e: 'kmeans-select-all'): void
  (e: 'kmeans-clear-all'): void
}>()

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'npy', label: '.npy' },
  { value: 'csv', label: '.csv' },
]

const format = ref<ExportFormat>('npy')

// ROI selection is tracked as "deselected" rather than "selected": every ROI is
// checked by default, so a newly confirmed ROI is included automatically
// without a re-sync watcher. KMeans selection is NOT owned here - it is the
// shared overlay selection, passed in and toggled via events.
const deselectedRois = ref<Set<string>>(new Set())

const hasItems = computed(() => props.rois.length > 0 || props.kmeansClusters.length > 0)

const selectedRoiIds = computed(() =>
  props.rois.filter((r) => !deselectedRois.value.has(r.id)).map((r) => r.id),
)

function isClusterSelected(id: number): boolean {
  return props.selectedKmeansIds === null || props.selectedKmeansIds.has(id)
}

const selectedClusterIds = computed(() =>
  props.kmeansClusters.filter((c) => isClusterSelected(c.id)).map((c) => c.id),
)

/** Number of selected regions feeding the single merged mask. */
const selectedCount = computed(() => selectedRoiIds.value.length + selectedClusterIds.value.length)

function toggleRoi(id: string) {
  const next = new Set(deselectedRois.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  deselectedRois.value = next
}

function selectAll() {
  deselectedRois.value = new Set()
  emit('kmeans-select-all')
}

function clearAll() {
  deselectedRois.value = new Set(props.rois.map((r) => r.id))
  emit('kmeans-clear-all')
}

function onExport() {
  if (selectedCount.value === 0) return
  emit('export-masks', {
    format: format.value,
    roiIds: selectedRoiIds.value,
    clusterIds: selectedClusterIds.value,
  })
}
</script>
