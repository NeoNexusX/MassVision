<script setup lang="ts">
import { computed, ref, watch, onUnmounted, nextTick } from 'vue'
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
import { getConfig } from '@/shared/config/runtimeConfig'
import { rgbCss } from '@/features/workspace/results/utils/regionPalette'
import { fetchReferenceRois, decodeRleMask } from '@/features/workspace/results/utils/referenceRois'
import { useToast } from '@/shared/composables/useToast'
import type { DataMode } from '@/services/zarr/types/zarr'

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
const resultFeatureConfig = getConfig().resultFeatures
const compareEnabled = resultFeatureConfig?.compare !== false
const annotationEnabled = resultFeatureConfig?.annotation !== false

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
  onSpectrumClickByIndex,
  isProcessed,
} = zarr

// 当前数据模式
const dataMode = computed<DataMode | null>(() => dataModeRef.value)

// processed 模式下的图像矩阵（TIC）
const currentIonMatrix = computed(() => (isProcessed.value ? ticMatrix.value : ionMatrix.value))

// 当前显示强度标度对应的图像矩阵；RMS/TIC 仅在用户选择后按需计算
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
  roiReset,
  roiAddMask,
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
  storageMode,
  { localZarrPath: props.localPath || undefined },
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
  hasResults: cmpHasResults,
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
  enabled: compareEnabled,
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

const compareSectionRef = ref<HTMLElement | null>(null)
// compare 面板与结果表共享展开状态。
const comparisonExpanded = ref(false)

// 展开 compare 时将中列平滑滚到该区域顶部，展示完整控件和结果。
watch(comparisonExpanded, async (expanded) => {
  if (!compareEnabled || !expanded) return
  await nextTick()
  compareSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

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
  <ResultVisualizationLayout
    :show-left-panel="annotationEnabled"
    :show-compare="compareEnabled"
  >
    <template #left-panel>
      <AnnotationPanel
        v-if="annotationEnabled"
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
        :ion-error="ionError"
        :normalization-loading="normalizationLoading"
        @update:mz-tolerance="mzTolerance = $event"
        @update:colormap="colormap = $event"
        @update:intensity-scale="
          async (value) => {
            intensityScale = value
            if (value === 'rms' || value === 'tic') await loadNormalization(value)
            else clearNormalization()
          }
        "
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
        v-if="compareEnabled"
        ref="compareSectionRef"
        class="w-full flex flex-col items-stretch gap-4 lg:flex-row lg:items-stretch"
      >
        <!-- 左侧正常参与文档流，它的自然高度决定整个 compare 区域的高度。 -->
        <div class="w-full min-w-0 flex flex-col lg:w-0 lg:flex-[2_1_0%]">
          <CompareRegionsPanel
            :regions="cmpAvailableRegions"
            :data-mode="dataMode"
            :spectrum-mode="spectrumMode"
            v-model:region-a-ids="cmpRegionAIds"
            v-model:region-b-ids="cmpRegionBIds"
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
