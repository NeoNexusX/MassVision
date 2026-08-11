<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import ColorBar from '@/features/workspace/results/components/visuals/ColorBar.vue'
import ResultVisualizationLayout from '@/features/workspace/results/components/ResultVisualizationLayout.vue'
import ResultHeader from '@/features/workspace/results/components/visuals/ResultHeader.vue'
import IonImageSection from '@/features/workspace/results/components/IonImageSection.vue'
import SpectrumSection from '@/features/workspace/results/components/SpectrumSection.vue'
import OverlayControls from '@/features/workspace/results/components/OverlayControls.vue'
import AnnotationPanel from '@/features/workspace/results/components/AnnotationPanel.vue'
import CompareRegionsPanel from '@/features/workspace/results/components/CompareRegionsPanel.vue'
import ComparisonResultsTable from '@/features/workspace/results/components/ComparisonResultsTable.vue'
import RegionPreviewThumbnail from '@/features/workspace/results/components/RegionPreviewThumbnail.vue'
import {
  useZarrIonImage,
  ticMatrix,
  pixelSpectrum,
  loadPixelSpectrum,
  dataModeRef,
  getSharedZarrContext,
  disposeZarrState,
} from '@/features/workspace/results/composables/useZarrIonImage'
import { useDisplayRange } from '@/features/workspace/results/composables/useDisplayRange'
import { useOverlayData } from '@/features/workspace/results/composables/useOverlayData'
import { useResultROI } from '@/features/workspace/results/composables/useResultROI'
import { useResultMeta } from '@/features/workspace/results/composables/useResultMeta'
import { useRegionComparison } from '@/features/workspace/results/composables/useRegionComparison'
import { ZARR_STORE } from '@/shared/config/defaults'
import { rgbCss } from '@/features/workspace/results/utils/regionPalette'
import { fetchReferenceRois, decodeRleMask } from '@/features/workspace/results/utils/referenceRois'
import { useToast } from '@/shared/composables/useToast'
import type { DataMode } from '@/services/zarrOssStore'

interface ResultDetailState {
  runId?: string
  processName?: string
  datasetName?: string
  filename?: string
  fileId?: number
  methods?: string[]
  status?: string
}

/**
 * Local mode: when `localPath` is set (route /workspace/local-result), the
 * page reads a static/local zarr (v1.1 layout) over HTTP instead of going
 * through runId → backend STS → OSS. Cloud behavior is unchanged when the
 * prop is absent.
 */
const props = defineProps<{ localPath?: string }>()
const isLocal = computed(() => !!props.localPath)

const state = history.state as ResultDetailState | null
const runId = computed(() => {
  if (isLocal.value) return `local:${props.localPath}`
  return state?.runId != null ? String(state.runId) : ''
})
const isStale = computed(() => !isLocal.value && state?.runId == null)

// ---- 元数据 ----

const {
  datasetName,
  analyzer,
  ionSource,
  pixelSize,
  polarity,
  spectrumMode,
  storageMode,
  status,
  methods,
} = useResultMeta(runId)

// ---- 可视化参数 ----

const colormap = ref('inferno')
const intensityScale = ref('linear')
const gamma = ref(1)

// ---- Annotation CSV import panel (left) ----
// Expanded by default on desktop; collapsed on small screens so the drawer
// doesn't cover the ion image on page load.
const annotationExpanded = ref(false)

// ---- Zarr 数据加载 ----

const zarr = useZarrIonImage()
const {
  selectedMz,
  selectedMzIndex,
  mzTolerance,
  ionMatrix,
  ionCols,
  ionRows,
  loading,
  onSpectrumClickByIndex,
  isProcessed,
} = zarr

// 当前数据模式
const dataMode = computed<DataMode | null>(() => dataModeRef.value)

// processed 模式下的图像矩阵（TIC）
const currentIonMatrix = computed(() =>
  isProcessed.value ? ticMatrix.value : ionMatrix.value,
)


// ---- 初始化 ----

watch(runId, (id) => {
  zarr.init(isLocal.value ? { kind: 'local', path: props.localPath! } : id)
}, { immediate: true })

// 离开页面时释放模块级状态，避免大数组（mzAxis、meanChartData、ticMatrix 等）
// 和 ZarrOssStore 缓存在 SPA 导航后仍驻留内存
onUnmounted(() => {
  cmpReset()
  disposeZarrState()
})

// ---- 显示范围 ----

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
} = useDisplayRange(currentIonMatrix, colormap, ionCols, ionRows)

// ---- ROI ----

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
  roiAddMask,
  onDraftUpdated,
  onDraftCleared,
} = useResultROI(currentIonMatrix, ionCols, ionRows)

// ---- Overlay ----

const {
  umapVisible,
  kmeansVisible,
  overlayData,
  overlayLoading,
  overlayError,
  clusteringCreating,
  clusteringComputing,
  clusteringReady,
  clusteringRefreshing,
  umapAlpha,
  kmeansAlpha,
  kmeansClusters,
  kmeansLabelsAvailable,
  kmeansK,
  kmeansComputing,
  selectedKmeansIds,
  getKmeansLabels,
  getKmeansDims,
  setComparisonOverlay,
  exportUmapPng,
  exportKmeansPng,
  toggleOverlay,
  retryClustering,
  createClusteringTask,
  refreshClusteringStatus,
  runKmeans,
  toggleKmeansCluster,
  selectAllKmeansClusters,
  clearKmeansClusters,
} = useOverlayData(
  runId,
  ionRows,
  ionCols,
  storageMode,
  { localZarrPath: props.localPath || undefined },
)

// ---- Region comparison ----

const {
  regionAId: cmpRegionAId,
  regionBId: cmpRegionBId,
  minDetectionRate: cmpMinDetectionRate,
  noiseFloorPercentile: cmpNoiseFloorPercentile,
  comparing: cmpComparing,
  progress: cmpProgress,
  error: cmpError,
  results: cmpResults,
  hasResults: cmpHasResults,
  filterStats: cmpFilterStats,
  availableRegions: cmpAvailableRegions,
  canCompare: cmpCanCompare,
  selectedRegionA: cmpSelectedRegionA,
  selectedRegionB: cmpSelectedRegionB,
  colorA: cmpColorA,
  colorB: cmpColorB,
  buildThumbnailRegions: cmpBuildThumbnailRegions,
  compare: cmpCompare,
  cancel: cmpCancel,
  selectMz: cmpSelectMz,
  reset: cmpReset,
  involvesRoi: cmpInvolvesRoi,
} = useRegionComparison({
  kmeansClusters,
  kmeansLabelsAvailable,
  getKmeansLabels,
  confirmedROIs: confirmedROIs as any,
  ionCols,
  ionRows,
  dataMode,
  onSelectMzIndex: handleSelectMzIndex,
  setComparisonOverlay,
})

const cmpThumbnail = computed(() => cmpBuildThumbnailRegions())

// Re-running KMeans always invalidates any existing comparison (clusters may
// be renumbered), so reset unconditionally. Clearing/deleting ROIs only
// invalidates the comparison when an ROI was actually one of the compared
// regions — a KMeans-vs-KMeans comparison is unaffected and should survive.
function handleRunKmeans(k: number) {
  cmpReset()
  return runKmeans(k)
}

function handleRoiClearAll() {
  if (cmpInvolvesRoi()) cmpReset()
  roiClearAll()
}

function handleRoiDelete(id: string) {
  if (cmpInvolvesRoi()) cmpReset()
  roiDelete(id)
}

// ---- Reference ROI import (local mode) ----

const { showToast } = useToast()

/**
 * Import pre-computed reference regions (e.g. the pathology annotation
 * converted by scripts/figMaskToRois.mjs) from
 * `reference/<dataset>.rois.json` and register them as confirmed ROIs so
 * they feed the region-comparison flow. Labels already present are
 * skipped, making re-import idempotent.
 */
async function importReferenceRois() {
  if (!isLocal.value || !props.localPath) return
  const dataset = props.localPath.replace(/\/+$/, '').split('/').pop()!.replace(/\.zarr$/i, '')
  const url = `${import.meta.env.BASE_URL}reference/${dataset}.rois.json`.replace(/\/+/g, '/')
  try {
    const file = await fetchReferenceRois(url)
    if (file.grid.width !== ionCols.value || file.grid.height !== ionRows.value) {
      throw new Error(
        `grid mismatch: file is ${file.grid.width}×${file.grid.height}, dataset is ${ionCols.value}×${ionRows.value}`,
      )
    }
    const existing = new Set(confirmedROIs.value.map((r) => r.label))
    let added = 0
    for (const entry of file.rois) {
      if (existing.has(entry.label)) continue
      const mask = decodeRleMask(entry.mask_rle, file.grid.width, file.grid.height)
      if (roiAddMask(mask, entry.label, entry.color)) added++
    }
    const iou = file.alignment?.iou
    showToast(
      added
        ? `Imported ${added} reference ROI${added > 1 ? 's' : ''}${iou ? ` (alignment IoU ${iou})` : ''}.`
        : 'Reference ROIs already imported.',
      added ? 'success' : 'info',
    )
  } catch (e) {
    console.error('[ResultDetail] reference ROI import failed:', e)
    showToast(
      `Reference ROI import failed: ${e instanceof Error ? e.message : String(e)}`,
      'error',
    )
  }
}

const compareColumnRef = ref<HTMLElement | null>(null)
const compareColumnHeight = ref<number | null>(null)
let compareColumnResizeObserver: ResizeObserver | null = null
// Shared expand state for the compare-regions panel and the results table:
// opening either opens both. Their visibility is already coupled via the
// height sync below, so the toggle states must be coupled too.
const comparisonExpanded = ref(false)

function syncCompareColumnHeight() {
  compareColumnHeight.value = compareColumnRef.value?.getBoundingClientRect().height ?? null
}

onMounted(() => {
  if (compareColumnRef.value) {
    compareColumnResizeObserver = new ResizeObserver(syncCompareColumnHeight)
    compareColumnResizeObserver.observe(compareColumnRef.value)
    syncCompareColumnHeight()
  }
})

onUnmounted(() => compareColumnResizeObserver?.disconnect())

// ---- 统计信息 ----

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

// ---- 选中像素坐标（processed 模式） ----

const selectedPixelCoord = computed(() => {
  const spec = pixelSpectrum.value
  if (!spec) return null
  return { x: spec.x, y: spec.y }
})

// ---- 事件处理 ----

/** 切换 m/z：直接加载新离子的 slice，保持当前强度标度。 */
async function handleSelectMzIndex(idx: number) {
  await onSpectrumClickByIndex(idx)
}

/** 重置所有控件到默认值 */
const resetControls = () => {
  mzTolerance.value = ZARR_STORE.defaultMzTolerance
  colormap.value = 'inferno'
  intensityScale.value = 'linear'
  gamma.value = 1
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

// ---- processed 模式：TIC 图点击 → 加载像素谱 ----

async function onSelectPixel(col: number, row: number) {
  if (!isProcessed.value) return
  const ctx = getSharedZarrContext()
  if (!ctx.store) return

  // 在像素坐标中查找最近的像素
  const pixelIdx = await ctx.store.findPixelByPosition(col, row)
  if (pixelIdx >= 0) {
    await loadPixelSpectrum(pixelIdx)
  }
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

    <template #left-panel>
      <AnnotationPanel
        v-model:expanded="annotationExpanded"
        :select-mz-index="handleSelectMzIndex"
        :selected-mz-index="selectedMzIndex"
        :spectrum-mode="spectrumMode"
      />
    </template>

    <template #main>
      <IonImageSection
        :is-stale="isStale"
        :ion-matrix="currentIonMatrix"
        :display-matrix="displayMatrix"
        :selected-mz="selectedMz"
        :mz-tolerance="mzTolerance"
        :colormap="colormap"
        :intensity-scale="intensityScale"
        :gamma="gamma"
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
        :data-mode="dataMode"
        :selected-pixel-coord="selectedPixelCoord"
        :ion-loading="loading"
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
        @select-pixel="onSelectPixel"
      />

      <SpectrumSection
        :is-stale="isStale"
        :selected-mz="selectedMz"
        :selected-mz-index="selectedMzIndex"
        :mz-tolerance="mzTolerance"
        :intensity-range="spectrumStats.intensityRange"
        :spectrum-mode="spectrumMode"
        :data-mode="dataMode"
        @select-mz-index="handleSelectMzIndex"
      />

      <!-- Region comparison: controls + preview (left) and results table (right) -->
      <div class="w-full flex flex-col items-stretch lg:flex-row gap-4 lg:items-stretch">
        <div ref="compareColumnRef" class="lg:w-[340px] shrink-0 flex flex-col lg:self-start">
          <CompareRegionsPanel
            :regions="cmpAvailableRegions"
            :data-mode="dataMode"
            :spectrum-mode="spectrumMode"
            v-model:region-a-id="cmpRegionAId"
            v-model:region-b-id="cmpRegionBId"
            v-model:min-detection-rate="cmpMinDetectionRate"
            v-model:noise-floor-percentile="cmpNoiseFloorPercentile"
            v-model:expanded="comparisonExpanded"
            :comparing="cmpComparing"
            :progress="cmpProgress"
            :error="cmpError"
            :has-results="cmpHasResults"
            :can-compare="cmpCanCompare"
            :color-a="cmpColorA"
            :color-b="cmpColorB"
            @compare="cmpCompare"
            @cancel="cmpCancel"
          >
            <template #preview>
              <!-- Only the selected A/B regions are drawn (clusters or ROIs).
                   Unselected confirmed ROIs are NOT shown, so the thumbnail
                   stays focused on the current comparison. -->
              <RegionPreviewThumbnail
                v-if="cmpThumbnail"
                :a="cmpThumbnail.a"
                :b="cmpThumbnail.b"
                :rois="[]"
                :matrix="currentIonMatrix"
                :width="cmpThumbnail.dims.width"
                :height="cmpThumbnail.dims.height"
              />
            </template>
          </CompareRegionsPanel>
        </div>
        <div
          class="flex-1 min-w-0 self-start"
          :style="compareColumnHeight ? { height: `${compareColumnHeight}px` } : undefined"
        >
          <ComparisonResultsTable
            :results="cmpResults"
            :selected-mz-index="selectedMzIndex"
            :filter-stats="cmpFilterStats"
            :region-a-color="rgbCss(cmpColorA)"
            :region-b-color="rgbCss(cmpColorB)"
            v-model:expanded="comparisonExpanded"
            @select-mz="cmpSelectMz"
          />
        </div>
      </div>
    </template>

    <template #side-panel>
      <ColorBar
        class="shrink-0 py-4 w-full lg:w-[340px]"
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
            v-model:umap-alpha="umapAlpha"
            v-model:kmeans-alpha="kmeansAlpha"
            :umap-visible="umapVisible"
            :kmeans-visible="kmeansVisible"
            :overlay-loading="overlayLoading"
            :clustering-creating="clusteringCreating"
            :clustering-computing="clusteringComputing"
            :clustering-ready="clusteringReady"
            :clustering-refreshing="clusteringRefreshing"
            :overlay-error="overlayError"
            :kmeans-clusters="kmeansClusters"
            :kmeans-labels-available="kmeansLabelsAvailable"
            :kmeans-k="kmeansK"
            :kmeans-computing="kmeansComputing"
            :selected-kmeans-ids="selectedKmeansIds"
            :storage-mode="storageMode"
            :local="isLocal"
            :roi-tool="roiTool"
            :draft-ready="draftReady"
            :viewing-roi="viewingROI"
            :confirmed-rois="confirmedROIs as any"
            :gamma="gamma"
            @toggle-overlay="toggleOverlay"
            @retry-clustering="retryClustering"
            @enable-clustering="createClusteringTask"
            @refresh-clustering="refreshClusteringStatus"
            @toggle-kmeans-cluster="toggleKmeansCluster"
            @kmeans-select-all="selectAllKmeansClusters"
            @kmeans-clear-all="clearKmeansClusters"
            @run-kmeans="handleRunKmeans"
            @export-umap="exportUmapPng"
            @export-kmeans="exportKmeansPng"
            @update:roi-tool="roiSelectTool"
            @roi-confirm="roiConfirm"
            @roi-cancel="roiCancel"
            @roi-delete="handleRoiDelete"
            @roi-clear-all="handleRoiClearAll"
            @roi-reset="roiReset"
            @import-reference-rois="importReferenceRois"
            @update:gamma="gamma = $event"
          />
        </template>
      </ColorBar>
    </template>
  </ResultVisualizationLayout>
</template>
