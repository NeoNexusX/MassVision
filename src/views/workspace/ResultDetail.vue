<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import ColorBar from '@/features/workspace/results/components/visuals/ColorBar.vue'
import ResultVisualizationLayout from '@/features/workspace/results/components/ResultVisualizationLayout.vue'
import ResultTopBar from '@/features/workspace/results/components/ResultTopBar.vue'
import IonImageSection from '@/features/workspace/results/components/IonImageSection.vue'
import SpectrumSection from '@/features/workspace/results/components/SpectrumSection.vue'
import OverlayControls from '@/features/workspace/results/components/OverlayControls.vue'
import { useZarrIonImage } from '@/features/workspace/results/composables/useZarrIonImage'
import { useDisplayRange } from '@/features/workspace/results/composables/useDisplayRange'
import { useOverlayData } from '@/features/workspace/results/composables/useOverlayData'
import { useResultROI } from '@/features/workspace/results/composables/useResultROI'

const meta = reactive({
  datasetName: 'S-2406-001483_3_S3_SM_Neg_20260406_AQ',
  analyzer: 'Orbitrap',
  ionSource: 'MALDI',
  pixelSize: '25 × 25 µm',
  status: 'Completed',
})

const methods = ref(['Noise Reduction', 'Peak Picking', 'Peak Alignment'])
const colormap = ref('inferno')
const intensityScale = ref('linear')

const { selectedMz, mzTolerance, ionMatrix, ionCols, ionRows, totalPeaks, onSpectrumClick } =
  useZarrIonImage()

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
} = useDisplayRange(ionMatrix, colormap)

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
  totalPeaks: totalPeaks.value,
  intensityRange: getIntensityRange(),
}))

const resetControls = () => {
  mzTolerance.value = 0.01
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
      <ResultTopBar :meta="meta" />
    </template>

    <template #main>
      <IonImageSection
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
        :meta="{ analyzer: meta.analyzer, ionSource: meta.ionSource, pixelSize: meta.pixelSize }"
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
        :selected-mz="selectedMz"
        :mz-tolerance="mzTolerance"
        :spectrum-stats="spectrumStats"
        @select-mz="onSpectrumClick"
      />
    </template>

    <template #side-panel>
      <ColorBar
        class="shrink-0 py-4"
        :style="{ width: '300px' }"
        :colormap="colormap"
        :global-min="globalMin"
        :global-max="globalMax"
        :display-min="displayMin"
        :display-max="displayMax"
        :histogram="intensityHistogram"
        :info="imageInfo"
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
