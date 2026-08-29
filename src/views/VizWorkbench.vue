<script setup lang="ts">
import { computed, ref, watch, onUnmounted, nextTick } from 'vue'
import ColorBar from '@/features/vizworkbench/components/visuals/ColorBar.vue'
import ResultVisualizationLayout from '@/features/vizworkbench/components/ResultVisualizationLayout.vue'
import ResultHeader from '@/features/vizworkbench/components/visuals/ResultHeader.vue'
import IonImageSection from '@/features/vizworkbench/components/IonImageSection.vue'
import SpectrumSection from '@/features/vizworkbench/components/SpectrumSection.vue'
import OverlayControls from '@/features/vizworkbench/components/OverlayControls.vue'
import AnnotationPanel from '@/features/vizworkbench/components/AnnotationPanel.vue'
import CompareRegionsPanel from '@/features/vizworkbench/components/CompareRegionsPanel.vue'
import ComparisonResultsTable from '@/features/vizworkbench/components/ComparisonResultsTable.vue'
import RegionPreviewThumbnail from '@/features/vizworkbench/components/RegionPreviewThumbnail.vue'
import {
  useZarrIonImage,
  ticMatrix,
  pixelSpectrum,
  loadPixelSpectrum,
  dataModeRef,
  mzAxisRef,
  getSharedZarrContext,
  disposeZarrState,
} from '@/features/vizworkbench/composables/useZarrIonImage'
import { useDisplayRange } from '@/features/vizworkbench/composables/useDisplayRange'
import { useOverlayData } from '@/features/vizworkbench/composables/useOverlayData'
import { useResultROI } from '@/features/vizworkbench/composables/useResultROI'
import { useResultMeta } from '@/features/vizworkbench/composables/useResultMeta'
import { useRegionComparison } from '@/features/vizworkbench/composables/useRegionComparison'
import { ZARR_STORE } from '@/shared/config/defaults'
import { rgbCss } from '@/features/vizworkbench/utils/regionPalette'
import { findClosestIndex } from '@/features/vizworkbench/utils/csvAnnotation'
import { useToast } from '@/shared/composables/useToast'
import type { DataMode } from '@/services/zarr/types/zarr'

interface VizWorkbenchState {
  runId?: string
  processName?: string
  datasetName?: string
  filename?: string
  fileId?: number
  methods?: string[]
  status?: string
}

const state = history.state as VizWorkbenchState | null
const runId = computed(() => (state?.runId != null ? String(state.runId) : ''))
const isStale = computed(() => state?.runId == null)

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
// Collapsed by default on all screens (desktop: thin rail; mobile: off-canvas drawer).
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
  error: ionError,
  loadNormalization,
  clearNormalization,
  normalizationFactors,
  normalizationLoading,
  normalizationError,
  hasTic,
  onSpectrumClickByIndex,
  isProcessed,
} = zarr

// 当前数据模式
const dataMode = computed<DataMode | null>(() => dataModeRef.value)

// processed 模式下的图像矩阵（TIC）
const currentIonMatrix = computed(() => (isProcessed.value ? ticMatrix.value : ionMatrix.value))

// 当前显示强度标度对应的图像矩阵；TIC 仅在用户选择后按需计算
const normalizedIonMatrix = computed(() => {
  const matrix = currentIonMatrix.value
  const factors = normalizationFactors.value
  if (!matrix || !factors || intensityScale.value === 'linear' || intensityScale.value === 'log')
    return matrix
  // Processed 数据本身就是 TIC 图像，不重复对 TIC 做归一化
  if (isProcessed.value) return matrix
  const result = new Float32Array(matrix.length)
  for (let i = 0; i < matrix.length; i++) {
    const denominator = factors[i]!
    result[i] = denominator > 0 ? matrix[i]! / denominator : 0
  }
  return result
})

const displaySourceMatrix = computed(() => normalizedIonMatrix.value)

// 数据集没有 stats/tic（旧数据/processed）时归一化选项会被隐藏；
// 若当前还停在 TIC，强制回到 Linear，避免值与选项不一致。
watch(hasTic, (v) => {
  if (!v && intensityScale.value === 'tic') {
    intensityScale.value = 'linear'
    clearNormalization()
  }
})

// ---- 初始化 ----

// init/dispose 的并发守卫（代次检查）在 useZarrIonImage 内部完成：
// init() 期间发生 disposeZarrState() 或重新 init() 时，旧的 init 会自行
// dispose 孤儿 store 并放弃写入模块状态。
watch(runId, (id) => {
  zarr.init(id)
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
} = useDisplayRange(displaySourceMatrix, colormap, ionCols, ionRows)

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
  onDraftUpdated,
  onDraftCleared,
} = useResultROI(displaySourceMatrix, ionCols, ionRows)

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
)

// ---- Region comparison ----

const {
  regionAIds: cmpRegionAIds,
  regionBIds: cmpRegionBIds,
  minDetectionRate: cmpMinDetectionRate,
  noiseFloorPercentile: cmpNoiseFloorPercentile,
  comparing: cmpComparing,
  progress: cmpProgress,
  error: cmpError,
  results: cmpResults,
  filterStats: cmpFilterStats,
  availableRegions: cmpAvailableRegions,
  canCompare: cmpCanCompare,
  selectedRegionsA: cmpSelectedRegionsA,
  selectedRegionsB: cmpSelectedRegionsB,
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
  confirmedROIs: confirmedROIs,
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
  // Only reset when the deleted ROI was one of the compared regions; deleting
  // an unrelated ROI (or any ROI when comparing KMeans-vs-KMeans) is harmless.
  if (cmpInvolvesRoi(id)) cmpReset()
  roiDelete(id)
}

// ---- Reference ROI import (local mode) ----

const { showToast } = useToast()

const compareSectionRef = ref<HTMLElement | null>(null)
// compare 面板与结果表共享展开状态。
const comparisonExpanded = ref(false)

// 展开 compare 时将中列平滑滚到该区域顶部，展示完整控件和结果。
watch(comparisonExpanded, async (expanded) => {
  if (!expanded) return
  await nextTick()
  compareSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

// ---- 统计信息 ----

const spectrumStats = computed(() => ({
  intensityRange: getIntensityRange(),
}))

const displayInfo = computed(() => ({
  ...imageInfo.value,
  polarity: polarity.value,
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

/** m/z 搜索：在质量轴上二分查找最近的峰，落在容差内则切换离子，否则提示。 */
async function onSearchMz(raw: string) {
  const target = Number(raw.trim())
  if (!Number.isFinite(target) || target <= 0) {
    showToast('Please enter a valid m/z value.', 'error')
    return
  }
  const axis = mzAxisRef.value
  if (!axis || !axis.length) {
    showToast('m/z axis is not loaded yet.', 'error')
    return
  }
  const idx = findClosestIndex(axis, target)
  const nearest = axis[idx]!
  const delta = Math.abs(nearest - target)
  if (delta > mzTolerance.value) {
    const fmtDelta = delta < 0.001 ? delta.toExponential(2) : delta.toFixed(4)
    showToast(
      `No peak within ±${mzTolerance.value} of ${target}: nearest is ${nearest.toFixed(4)} (Δ ${fmtDelta}). Widen the tolerance or try another value.`,
      'error',
    )
    return
  }
  await handleSelectMzIndex(idx)
}

/** 重置所有控件到默认值 */
const resetControls = () => {
  mzTolerance.value = ZARR_STORE.defaultMzTolerance
  colormap.value = 'inferno'
  intensityScale.value = 'linear'
  gamma.value = 1
  clearNormalization()
  resetRange()
}

/** 切换强度标度（TIC 归一化需异步加载，其他即时切换） */
async function onIntensityScaleChange(value: string) {
  intensityScale.value = value
  if (value === 'tic') await loadNormalization('tic')
  else clearNormalization()
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
  <ResultVisualizationLayout :left-panel-collapsed="!annotationExpanded">
    <template #left-panel>
      <AnnotationPanel
        v-model:expanded="annotationExpanded"
        :select-mz-index="handleSelectMzIndex"
        :selected-mz-index="selectedMzIndex"
        :spectrum-mode="spectrumMode"
      />
    </template>

    <template #viz>
      <ResultHeader class="shrink-0" :dataset-name="datasetName" :status="status" />
      <IonImageSection
        :is-stale="isStale"
        :ion-matrix="displaySourceMatrix"
        :display-matrix="displayMatrix"
        :selected-mz="selectedMz"
        :mz-tolerance="mzTolerance"
        :colormap="colormap"
        :intensity-scale="intensityScale"
        :gamma="gamma"
        :display-min="displayMin"
        :display-max="displayMax"
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
        :ion-error="ionError"
        :normalization-loading="normalizationLoading"
        :normalization-error="normalizationError"
        :has-tic="hasTic"
        @update:mz-tolerance="mzTolerance = $event"
        @update:colormap="colormap = $event"
        @update:intensity-scale="onIntensityScaleChange"
        @search-mz="onSearchMz"
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
    </template>

    <template #compare>
      <!-- Region comparison：左 controls+preview，右结果表。
           桌面端折叠栏保留在首屏，展开后由中列承载滚动。 -->
      <div
        ref="compareSectionRef"
        class="w-full flex flex-col items-stretch gap-4 lg:flex-row lg:items-stretch"
      >
        <!-- 左侧正常参与文档流，它的自然高度决定整个 compare 区域的高度。 -->
        <div class="w-full min-w-0 flex flex-col lg:w-0 lg:flex-[2_1_0%]">
          <CompareRegionsPanel
            :regions="cmpAvailableRegions"
            :spectrum-mode="spectrumMode"
            v-model:region-a-ids="cmpRegionAIds"
            v-model:region-b-ids="cmpRegionBIds"
            v-model:min-detection-rate="cmpMinDetectionRate"
            v-model:noise-floor-percentile="cmpNoiseFloorPercentile"
            v-model:expanded="comparisonExpanded"
            :comparing="cmpComparing"
            :progress="cmpProgress"
            :error="cmpError"
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
        <!-- 桌面端右侧不参与父容器高度计算，只填满左侧确定的共享高度。 -->
        <div class="w-full min-w-0 lg:relative lg:w-0 lg:flex-[5_1_0%] lg:min-h-0">
          <ComparisonResultsTable
            class="lg:absolute lg:inset-0"
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
        class="shrink-0 py-4 w-full"
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
            @update:viewing-roi="viewingROI = $event"
            @roi-confirm="roiConfirm"
            @roi-cancel="roiCancel"
            @roi-delete="handleRoiDelete"
            @roi-clear-all="handleRoiClearAll"
            @update:gamma="gamma = $event"
          />
        </template>
      </ColorBar>
    </template>
  </ResultVisualizationLayout>
</template>
