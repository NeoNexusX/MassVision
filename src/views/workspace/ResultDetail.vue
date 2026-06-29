<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ColorBar from '@/features/workspace/results/components/visuals/ColorBar.vue'
import ResultVisualizationLayout from '@/features/workspace/results/components/ResultVisualizationLayout.vue'
import ResultHeader from '@/features/workspace/results/components/visuals/ResultHeader.vue'
import IonImageSection from '@/features/workspace/results/components/IonImageSection.vue'
import SpectrumSection from '@/features/workspace/results/components/SpectrumSection.vue'
import OverlayControls from '@/features/workspace/results/components/OverlayControls.vue'
import { useZarrIonImage } from '@/features/workspace/results/composables/useZarrIonImage'
import { useDisplayRange } from '@/features/workspace/results/composables/useDisplayRange'
import { useOverlayData } from '@/features/workspace/results/composables/useOverlayData'
import { useResultROI } from '@/features/workspace/results/composables/useResultROI'
import { useResultMeta } from '@/features/workspace/results/composables/useResultMeta'
import { ZARR_STORE } from '@/shared/config/defaults'

interface ResultDetailState {
  runId?: string
  processName?: string
  datasetName?: string
  filename?: string
  fileId?: number
  methods?: string[]
  status?: string
}

const state = history.state as ResultDetailState | null
const runId = computed(() => state?.runId != null ? String(state.runId) : '')
const isStale = computed(() => state?.runId == null)

const { datasetName, analyzer, ionSource, pixelSize, polarity, spectrumMode, storageMode, status, methods } = useResultMeta(runId)
const colormap = ref('inferno')
const intensityScale = ref('linear')

const zarr = useZarrIonImage()
const {
  selectedMz,
  selectedMzIndex,
  mzTolerance,
  ionMatrix,
  ionCols,
  ionRows,
  onSpectrumClickByIndex,
} = zarr

watch(runId, (id) => {
  zarr.init(id)
}, { immediate: true })

const {
  globalMin,
  globalMax,
  dataMax,
  sortedNonZero,
  displayMin,
  displayMax,
  stripRef,
  gradientCSS,
  intensityHistogram,
  imageInfo,
  getIntensityRange,
  resetRange,
  calcHandleTop,
  clampPct,
  onStripMouseDown,
  startStripDrag,
  formatVal,
} = useDisplayRange(ionMatrix, colormap, ionCols, ionRows)

const {
  roiOverlayRef,
  roiTool,
  confirmedROIs,
  draftReady,
  viewingROI,
  displayMatrix,
  roiSelectTool,
  roiConfirm,
  roiCancel,
  roiDelete,
  roiClearAll,
  roiReset,
  onDraftUpdated,
  onDraftCleared,
} = useResultROI(ionMatrix, ionCols, ionRows)

const { overlayMode, overlayData, overlayLoading, overlayAlpha, toggleOverlay } = useOverlayData(
  ionRows,
  ionCols,
)

const spectrumStats = computed(() => ({
  intensityRange: getIntensityRange(),
}))

const displayInfo = computed(() => ({
  ...imageInfo.value,
  polarity: polarity.value || imageInfo.value.polarity,
  analyzer: analyzer.value,
  ionisationSource: ionSource.value,
  pixelSize: pixelSize.value,
  spectrumMode: spectrumMode.value,
  storageMode: storageMode.value,
}))

const resetControls = () => {
  mzTolerance.value = ZARR_STORE.defaultMzTolerance
  colormap.value = 'inferno'
  intensityScale.value = 'linear'
  resetRange()
}

const setStripRef = (element: HTMLElement | null) => {
  stripRef.value = element
}

const setRoiOverlayRef = (element: any) => {
  roiOverlayRef.value = element
}

const onDisplayMinChange = (value: number) => {
  displayMin.value = value
}

const onDisplayMaxChange = (value: number) => {
  displayMax.value = value
}
</script>

<template>
  <ResultVisualizationLayout>
    <template #top-bar>
      <ResultHeader
        class="pl-4"
        :dataset-name="datasetName"
        :status="status"
      />
    </template>

    <template #main>
      <IonImageSection
        :is-stale="isStale"
        :ion-matrix="ionMatrix"
        :display-matrix="displayMatrix"
        :selected-mz="selectedMz"
        :mz-tolerance="mzTolerance"
        :colormap="colormap"
        :intensity-scale="intensityScale"
        :display-min="displayMin"
        :display-max="displayMax"
        :data-max="dataMax"
        :ion-cols="ionCols"
        :ion-rows="ionRows"
        :roi-tool="roiTool"
        :overlay-data="overlayData"
        :gradient-css="gradientCSS"
        :calc-handle-top="calcHandleTop"
        :clamp-pct="clampPct"
        :format-val="formatVal"
        @update:mz-tolerance="mzTolerance = $event"
        @update:colormap="colormap = $event"
        @update:intensity-scale="intensityScale = $event"
        @reset-controls="resetControls"
        @reset-range="resetRange"
        @strip-ref="setStripRef"
        @roi-overlay-ref="setRoiOverlayRef"
        @strip-mouse-down="onStripMouseDown"
        @start-strip-drag="startStripDrag"
        @draft-updated="onDraftUpdated"
        @draft-cleared="onDraftCleared"
      />

      <SpectrumSection
        :is-stale="isStale"
        :selected-mz="selectedMz"
        :selected-mz-index="selectedMzIndex"
        :mz-tolerance="mzTolerance"
        :intensity-range="spectrumStats.intensityRange"
        :spectrum-mode="spectrumMode"
        @select-mz-index="onSpectrumClickByIndex"
      />
    </template>

    <template #side-panel>
      <ColorBar
        class="shrink-0 py-4"
        :style="{ width: '340px' }"
        :colormap="colormap"
        :global-min="globalMin"
        :global-max="globalMax"
        :display-min="displayMin"
        :display-max="displayMax"
        :histogram="intensityHistogram"
        :info="displayInfo"
        :methods="methods"
        :sorted-values="sortedNonZero"
        @update:display-min="onDisplayMinChange"
        @update:display-max="onDisplayMaxChange"
      >
        <template #actions>
          <OverlayControls
            v-model:overlay-alpha="overlayAlpha"
            :overlay-mode="overlayMode"
            :overlay-loading="overlayLoading"
            :roi-tool="roiTool"
            :draft-ready="draftReady"
            :viewing-roi="viewingROI"
            :confirmed-rois="confirmedROIs as any"
            @toggle-overlay="toggleOverlay"
            @update:roi-tool="roiSelectTool"
            @roi-confirm="roiConfirm"
            @roi-cancel="roiCancel"
            @roi-delete="roiDelete"
            @roi-clear-all="roiClearAll"
            @roi-reset="roiReset"
          />
        </template>
      </ColorBar>
    </template>
  </ResultVisualizationLayout>
</template>
