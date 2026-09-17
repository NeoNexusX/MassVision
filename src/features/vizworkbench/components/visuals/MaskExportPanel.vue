<template>
  <div class="kawaru-text-81">
    <!-- Import is available even when there are no locally-created regions. -->
    <div class="flex items-center gap-1 mb-3">
      <input
        ref="importInput"
        type="file"
        class="hidden"
        accept=".npz,.csv"
        @change="onImportChange"
      />
      <button class="btn btn-sm btn-ghost flex-1 kawaru-text-81" @click="importInput?.click()">
        <SvgIcon type="upload" />
        {{ $t('vizworkbench.mask.import') }}
      </button>
      <button
        v-if="importedMaskName"
        class="btn btn-sm btn-ghost text-error kawaru-text-81"
        :title="$t('vizworkbench.mask.clearImport')"
        @click="emit('clear-imported-mask')"
      >
        <SvgIcon type="trash" />
      </button>
    </div>
    <div
      v-if="importedMaskName"
      class="text-base-content/60 mb-2 truncate"
      :title="importedMaskName"
    >
      {{ $t('vizworkbench.mask.imported', { name: importedMaskName }) }}
    </div>

    <!-- Format -->
    <div class="flex items-center gap-2 mb-2">
      <span class="text-base-content">{{ $t('vizworkbench.mask.format') }}</span>
      <div class="join">
        <button
          v-for="f in FORMATS"
          :key="f.value"
          class="btn btn-xs join-item kawaru-text-81"
          :class="format === f.value ? 'btn-primary' : 'btn-ghost'"
          @click="format = f.value"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <div v-if="!hasItems" class="text-base-content/60">
      {{ $t('vizworkbench.mask.empty') }}
    </div>

    <template v-else>
      <div class="text-base-content/60 mb-2">
        {{ $t('vizworkbench.mask.mergeHint') }}
      </div>

      <!-- ROI regions -->
      <div v-if="rois.length" class="mb-2">
        <div class="font-semibold text-base-content mb-1">
          {{ $t('vizworkbench.mask.roiMasks') }}
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 max-h-40 overflow-y-auto">
          <label
            v-for="roi in rois"
            :key="roi.id"
            class="flex items-center gap-1.5 py-0.5 cursor-pointer select-none kawaru-text-87"
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
          {{ $t('vizworkbench.mask.kmeansClusters') }}
          <span v-if="kmeansK !== null" class="font-mono font-normal text-base-content/60"
            >(k={{ kmeansK }})</span
          >
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 max-h-40 overflow-y-auto">
          <label
            v-for="c in kmeansClusters"
            :key="c.id"
            class="flex items-center gap-1.5 py-0.5 cursor-pointer select-none kawaru-text-87"
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
            <span class="text-base-content truncate">{{
              $t('vizworkbench.kmeans.cluster', { id: c.id })
            }}</span>
          </label>
        </div>
      </div>
      <div v-else-if="!kmeansLabelsAvailable" class="text-base-content/60 mb-2">
        {{ $t('vizworkbench.mask.runKmeansHint') }}
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-1">
        <button
          class="btn btn-sm btn-primary flex-1 kawaru-text-81"
          :disabled="selectedCount === 0"
          :title="$t('vizworkbench.mask.exportHint')"
          @click="onExport"
        >
          <SvgIcon type="download" />
          {{ $t('vizworkbench.mask.export') }}
        </button>
        <button class="btn btn-ghost btn-sm kawaru-text-81" @click="selectAll">
          {{ $t('vizworkbench.mask.all') }}
        </button>
        <button class="btn btn-ghost btn-sm kawaru-text-81" @click="clearAll">
          {{ $t('common.action.clear') }}
        </button>
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
  importedMaskName?: string | null
}>()

const emit = defineEmits<{
  (e: 'export-masks', payload: MaskExportPayload): void
  (e: 'toggle-kmeans-cluster', id: number): void
  (e: 'kmeans-select-all'): void
  (e: 'kmeans-clear-all'): void
  (e: 'import-mask', file: File): void
  (e: 'clear-imported-mask'): void
}>()

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'npz', label: '.npz' },
  { value: 'csv', label: '.csv' },
]

const format = ref<ExportFormat>('npz')

// ROI selection is tracked as "deselected" rather than "selected": every ROI is
// checked by default, so a newly confirmed ROI is included automatically
// without a re-sync watcher. KMeans selection is NOT owned here - it is the
// shared overlay selection, passed in and toggled via events.
const deselectedRois = ref<Set<string>>(new Set())
const importInput = ref<HTMLInputElement | null>(null)

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

function onImportChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('import-mask', file)
}
</script>
