/**
 * Ion image composable — loads zarr data on demand via OSS STS.
 *
 * Supports two data modes:
 *   - continuous (ion-major): average spectrum + ion image  (existing feature)
 *   - processed (pixel-major): TIC image + per-pixel spectrum (new feature)
 *
 * selectedMzIndex is the single source of truth for continuous mode;
 * selectedPixelIndex is the source of truth for processed mode.
 * selectedMz is derived from selectedMzIndex + mzAxis (continuous only).
 */

import { computed, ref, shallowRef } from 'vue'
import { getZarrAccess } from '@/services/zarr/api/zarrAccessApi'
import { ZarrOssStore } from '@/services/zarr/zarrOssStore'
import type { MetadataAttrs, DataMode } from '@/services/zarr/types/zarr'
import { ZARR_STORE } from '@/shared/config/defaults'

// ---- Module-level shared state ----

let store: ZarrOssStore | null = null

/** Shared m/z axis (Float64Array). Only populated for continuous mode. */
const mzAxisRef = shallowRef<Float64Array | null>(null)

/** Ion image dimensions { width, height } */
const ionDims = shallowRef<{ width: number; height: number } | null>(null)

/** Data mode: 'continuous' or 'processed' */
export const dataModeRef = shallowRef<DataMode | null>(null)

/** Row axis: 'pixel' or 'ion' */
export const rowAxisRef = shallowRef<'pixel' | 'ion' | null>(null)

/** Metadata from /metadata/.zattrs */
export const metadataAttrsRef = shallowRef<MetadataAttrs | null>(null)

/** Result polarity (e.g. 'positive'/'negative'). Populated from the zarr
 *  metadata attrs, with an API fallback applied by {@link ../useResultMeta}.
 *  Shared so consumers (the annotation panel) can read it directly like
 *  {@link mzAxisRef} instead of threading it through props. */
export const polarityRef = ref('')

// ---- Mean spectrum state (continuous mode) ----

export const meanChartData = shallowRef<[number, number][]>([])
/** Raw mean-spectrum intensities aligned with {@link mzAxisRef}. Unlike
 *  {@link meanChartData} (which drops zero/NaN points for charting), this is
 *  the unfiltered array - used for per-peak intensity lookup such as the
 *  annotation-CSV m/z matching (see useAnnotationMatch). */
export const meanSpectrumRef = shallowRef<Float32Array | null>(null)
export const spectrumLoading = ref(false)
export const spectrumError = ref<string | null>(null)
export const nMz = ref(0)

// ---- TIC image state (processed mode) ----

export const ticMatrix = shallowRef<Float32Array | null>(null)
export const ticLoading = ref(false)
export const ticError = ref<string | null>(null)

// ---- Per-pixel spectrum state (processed mode) ----

export const pixelSpectrum = shallowRef<{
  mz: Float64Array
  intensity: Float32Array
  pixelIndex: number
  x: number
  y: number
} | null>(null)

export const pixelSpectrumLoading = ref(false)
export const pixelSpectrumError = ref<string | null>(null)

// ---- Shared context snapshot ----

export interface SharedZarrContext {
  store: ZarrOssStore | null
  mzAxis: Float64Array | null
  ionShape: { width: number; height: number } | null
  dataMode: DataMode | null
  rowAxis: 'pixel' | 'ion' | null
  meanChartData: [number, number][]
  spectrumLoading: boolean
  spectrumError: string | null
  nMz: number
  ticMatrix: Float32Array | null
  pixelSpectrum: typeof pixelSpectrum.value
}

export function getSharedZarrContext(): SharedZarrContext {
  return {
    store,
    mzAxis: mzAxisRef.value,
    ionShape: ionDims.value,
    dataMode: dataModeRef.value,
    rowAxis: rowAxisRef.value,
    meanChartData: meanChartData.value,
    spectrumLoading: spectrumLoading.value,
    spectrumError: spectrumError.value,
    nMz: nMz.value,
    ticMatrix: ticMatrix.value,
    pixelSpectrum: pixelSpectrum.value,
  }
}

/**
 * Reset the module-level refs (no store disposal — callers handle the store).
 * Shared by disposeZarrState() and the composable's init() reset block.
 */
function resetModuleState(): void {
  mzAxisRef.value = null
  ionDims.value = null
  dataModeRef.value = null
  rowAxisRef.value = null
  metadataAttrsRef.value = null
  polarityRef.value = ''

  meanChartData.value = []
  meanSpectrumRef.value = null
  spectrumLoading.value = false
  spectrumError.value = null

  ticMatrix.value = null
  ticLoading.value = false
  ticError.value = null

  pixelSpectrum.value = null
  pixelSpectrumLoading.value = false
  pixelSpectrumError.value = null
}

/**
 * Release all module-level state. Call on ResultDetail unmount so that large
 * TypedArrays (mzAxis, meanChartData, ticMatrix, pixelSpectrum) and the
 * ZarrOssStore (chunk caches, in-flight requests) become GC-eligible instead
 * of persisting for the entire SPA lifetime.
 */
export function disposeZarrState(): void {
  store?.dispose()
  store = null

  ionImageRequestId++
  normalizationRequestId++
  normalizationCache.clear()
  normalizationPending.clear()
  resetModuleState()
  nMz.value = 0
}

// ---- Mean spectrum loading (continuous mode) ----

/**
 * Load the mean spectrum from stats/mean_spectrum and derive non-zero chart data.
 * Only valid for continuous mode.
 */
export async function loadMeanSpectrum(): Promise<void> {
  const axis = mzAxisRef.value
  if (!store || !axis) return
  if (dataModeRef.value !== 'continuous') return

  spectrumLoading.value = true
  spectrumError.value = null

  try {
    const meanData = await store.loadMeanSpectrum()
    // store 可能在 await 期间被 disposeZarrState() 置空（用户已离开页面）
    if (!store) return
    if (!meanData) {
      spectrumLoading.value = false
      spectrumError.value = 'Mean spectrum not available'
      return
    }

    nMz.value = axis.length
    // Keep the raw intensity array for O(1) intensity lookup by m/z index
    // (annotation matching). meanChartData below is filtered for charting.
    meanSpectrumRef.value = meanData
    // profile 模式下相邻点由折线连接，过滤掉零值会让 ECharts 在两个"幸存点"之间
    // 画直线穿过整段空白区，凭空连出并不存在的信号，所以 profile 模式必须保留零值；
    // centroid 模式每个峰是独立的 bar，过滤零值只是省去数万个空 bar，不影响视觉
    const attrs = metadataAttrsRef.value
    const isProfileMode = !!attrs?.profile_spectrum && !attrs?.centroid_spectrum
    const data: [number, number][] = []
    for (let i = 0; i < axis.length; i++) {
      const v = meanData[i]!
      if (!Number.isFinite(v)) continue
      if (isProfileMode || v !== 0) {
        data.push([axis[i]!, v])
      }
    }
    meanChartData.value = data
    spectrumLoading.value = false
  } catch (e) {
    console.error('[useZarrIonImage] loadMeanSpectrum failed:', e)
    spectrumLoading.value = false
    spectrumError.value = e instanceof Error ? e.message : String(e)
  }
}

// ---- TIC image loading (processed mode) ----

export async function loadTICImage(): Promise<void> {
  if (!store) return
  if (dataModeRef.value !== 'processed') return

  ticLoading.value = true
  ticError.value = null

  try {
    // Fast path: use pre-computed stats/tic if available
    const fastMatrix = await store.loadTIC()
    if (!store) return
    if (fastMatrix) {
      ticMatrix.value = fastMatrix
      ticLoading.value = false
      return
    }

    // Fallback: compute TIC by summing all intensity chunks
    const matrix = await store.computeTICImage()
    if (!store) return
    ticMatrix.value = matrix
    ticLoading.value = false
  } catch (e) {
    console.error('[useZarrIonImage] loadTICImage failed:', e)
    ticLoading.value = false
    ticError.value = e instanceof Error ? e.message : String(e)
  }
}

// ---- Per-pixel spectrum loading (processed mode) ----

export async function loadPixelSpectrum(pixelIndex: number): Promise<void> {
  if (!store) return
  if (dataModeRef.value !== 'processed') return

  pixelSpectrumLoading.value = true
  pixelSpectrumError.value = null
  pixelSpectrum.value = null

  try {
    const spectrum = await store.getPixelSpectrum(pixelIndex)
    if (!store) return
    if (!spectrum) {
      pixelSpectrumLoading.value = false
      pixelSpectrumError.value = 'Empty spectrum for this pixel'
      return
    }

    // Convert to chart data: only non-zero finite values
    const { mz, intensity, pixelIndex: idx, x, y } = spectrum
    pixelSpectrum.value = { mz, intensity, pixelIndex: idx, x, y }
    pixelSpectrumLoading.value = false
  } catch (e) {
    console.error('[useZarrIonImage] loadPixelSpectrum failed:', e)
    pixelSpectrumLoading.value = false
    pixelSpectrumError.value = e instanceof Error ? e.message : String(e)
  }
}

// ---- Exports ----

export { mzAxisRef }

// ---- Helper: find m/z range indices (continuous mode) ----

function findMzRangeIndices(targetIdx: number, tolerance: number): number[] {
  const mzAxis = mzAxisRef.value
  if (!mzAxis) return []
  const target = mzAxis[targetIdx]
  if (target == null) return [targetIdx]

  const lowerMz = target - tolerance
  const upperMz = target + tolerance

  // Lower bound: first axis value >= lowerMz.
  let lo = 0
  let hi = mzAxis.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (mzAxis[mid]! < lowerMz) lo = mid + 1
    else hi = mid
  }
  const start = lo

  // Upper bound: first axis value > upperMz.
  lo = start
  hi = mzAxis.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (mzAxis[mid]! <= upperMz) lo = mid + 1
    else hi = mid
  }
  const end = lo

  if (start >= end) return [targetIdx]
  return Array.from({ length: end - start }, (_, offset) => start + offset)
}

// ---- Helper: load ion image slice sum (continuous mode) ----

async function loadIonSliceSum(indices: number[]): Promise<Float32Array> {
  const s = store
  if (!s) throw new Error('Zarr store is unavailable')
  if (!indices.length) throw new Error('No m/z indices were selected')
  if (!ionDims.value) throw new Error('Ion-image dimensions are unavailable')
  const { width, height } = ionDims.value
  const matrix = await s.getSummedIonImageByMzIndices(indices)
  if (matrix.length !== width * height) {
    throw new Error(
      `ion matrix size mismatch: expected ${width * height}, got ${matrix.length}`,
    )
  }
  return matrix
}

// ---- Binary search in m/z axis ----

export function findClosestMzIndex(target: number): number {
  const a = mzAxisRef.value
  if (!a || !a.length) return -1
  if (target <= a[0]!) return 0
  const lastIndex = a.length - 1
  if (target >= a[lastIndex]!) return lastIndex

  let lo = 0
  let hi = lastIndex
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (a[mid]! < target) lo = mid + 1
    else hi = mid
  }
  const prev = lo - 1
  return Math.abs(target - a[prev]!) <= Math.abs(a[lo]! - target) ? prev : lo
}

const normalizationCache = new Map<'tic' | 'rms', Float32Array>()
const normalizationPending = new Map<
  'tic' | 'rms',
  { store: ZarrOssStore; promise: Promise<Float32Array> }
>()
let normalizationRequestId = 0
let ionImageRequestId = 0

// ---- Main composable ----

export function useZarrIonImage() {
  // Continuous mode state
  const selectedMzIndex = ref(0)
  const mzTolerance = ref<number>(ZARR_STORE.defaultMzTolerance)
  const ionMatrix = ref<Float32Array | null>(null)
  const normalizationFactors = shallowRef<Float32Array | null>(null)
  const normalizationLoading = ref(false)
  const normalizationError = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const ready = ref(false)

  // Processed mode state
  const selectedPixelIndex = ref(-1)

  // Computed
  const ionCols = computed(() => ionDims.value?.width ?? 0)
  const ionRows = computed(() => ionDims.value?.height ?? 0)
  const totalPeaks = computed(() =>
    mzAxisRef.value ? mzAxisRef.value.length.toLocaleString() : '--',
  )

  const isContinuous = computed(() => dataModeRef.value === 'continuous')
  const isProcessed = computed(() => dataModeRef.value === 'processed')

  // selectedMz is DERIVED from selectedMzIndex + mzAxis — never written directly
  const selectedMz = computed(() => {
    const axis = mzAxisRef.value
    const idx = selectedMzIndex.value
    if (!axis || idx < 0 || idx >= axis.length) return 0
    return axis[idx]!
  })

  // ---- Continuous mode: load ion image for a given m/z index ----

  const loadForMzIndex = async (idx: number) => {
    if (!mzAxisRef.value || !ready.value || idx < 0 || idx >= mzAxisRef.value.length) return
    if (dataModeRef.value !== 'continuous') return
    const requestId = ++ionImageRequestId
    const requestStore = store
    loading.value = true
    error.value = null
    selectedMzIndex.value = idx
    // 钳位容差到 [min, max]，防止外部传入越界值导致空区间或全表扫描
    const tol = Math.min(
      ZARR_STORE.maxMzTolerance,
      Math.max(ZARR_STORE.minMzTolerance, mzTolerance.value),
    )
    try {
      const matrix = await loadIonSliceSum(findMzRangeIndices(idx, tol))
      // Ignore a stale response after another peak/run has been selected.
      if (requestId !== ionImageRequestId || store !== requestStore) return
      ionMatrix.value = matrix
    } catch (e) {
      if (requestId !== ionImageRequestId || store !== requestStore) return
      error.value = e instanceof Error ? e.message : String(e)
      console.error('[useZarrIonImage] loadForMzIndex failed:', e)
    } finally {
      if (requestId === ionImageRequestId) loading.value = false
    }
  }

  const loadNormalization = async (mode: 'tic' | 'rms') => {
    if (!store || !ready.value) return
    const requestId = ++normalizationRequestId
    const requestStore = store
    normalizationFactors.value = null
    const cached = normalizationCache.get(mode)
    if (cached) {
      if (requestId === normalizationRequestId && store === requestStore) {
        normalizationFactors.value = cached
      }
      return
    }
    normalizationLoading.value = true
    normalizationError.value = null
    try {
      const pending = normalizationPending.get(mode)
      let promise = pending && pending.store === requestStore ? pending.promise : null
      if (!promise) {
        promise = requestStore.computePixelNormalization(mode)
        const trackedPromise = promise.finally(() => {
          if (normalizationPending.get(mode)?.promise === trackedPromise) {
            normalizationPending.delete(mode)
          }
        })
        normalizationPending.set(mode, { store: requestStore, promise: trackedPromise })
      }
      const factors = await promise
      if (store !== requestStore) return
      normalizationCache.set(mode, factors)
      // The computation is independent of the selected m/z. If the user switched
      // back to Linear while it was running, keep the cache but don't re-apply it.
      if (requestId !== normalizationRequestId) return
      normalizationFactors.value = factors
    } catch (e) {
      if (store !== requestStore) return
      normalizationError.value = e instanceof Error ? e.message : String(e)
      if (requestId !== normalizationRequestId) return
      normalizationFactors.value = null
    } finally {
      if (requestId === normalizationRequestId) normalizationLoading.value = false
    }
  }
  const clearNormalization = () => {
    normalizationRequestId++
    normalizationFactors.value = null
    normalizationError.value = null
    normalizationLoading.value = false
  }

  const onSpectrumClickByIndex = async (idx: number) => {
    if (!mzAxisRef.value || !ready.value) return
    if (idx < 0 || idx >= mzAxisRef.value.length) return
    await loadForMzIndex(idx)
  }

  const loadDefaultImage = async () => {
    const axis = mzAxisRef.value
    if (!axis?.length || !ready.value) return
    const idx = Math.floor(axis.length / 2)
    await loadForMzIndex(idx)
  }

  // ---- Processed mode: load pixel spectrum ----

  const loadSpectrumForPixel = async (pixelIdx: number) => {
    if (!ready.value) return
    if (dataModeRef.value !== 'processed') return
    selectedPixelIndex.value = pixelIdx
    await loadPixelSpectrum(pixelIdx)
  }

  // ---- Initialization ----

  const init = async (runId: string) => {
    if (!runId) return
    loading.value = true
    error.value = null
    ready.value = false

    // Reset all state
    store?.dispose()
    store = null
    ionImageRequestId++
    normalizationRequestId++
    normalizationCache.clear()
    normalizationPending.clear()
    normalizationFactors.value = null
    normalizationError.value = null
    ionMatrix.value = null
    resetModuleState()

    try {
      const access = await getZarrAccess(runId)
      const s = new ZarrOssStore(access, {
        intensityChunkCacheSize: ZARR_STORE.intensityChunkCacheSize,
      })
      store = s
      await s.init()
      // 如果 await 期间发生了 disposeZarrState()（用户离开页面）或重新 init()，放弃本次加载
      if (store !== s) return

      // Set mode and row axis
      dataModeRef.value = s.dataMode
      rowAxisRef.value = s.rowAxis
      metadataAttrsRef.value = s.metadataAttrs

      // Set spatial dimensions
      const [height, width] = s.spatialShape
      ionDims.value = { width, height }

      if (s.dataMode === 'continuous') {
        // Load shared m/z axis
        const mzAxis = await s.loadMzAxis()
        if (store !== s) return
        if (!mzAxis) throw new Error('[useZarrIonImage] continuous data is missing its m/z axis')
        mzAxisRef.value = mzAxis

        // Set ion shape for backward compat
        const shape = s.getIonShape()
        if (shape) {
          ionDims.value = { width: shape[2]!, height: shape[1]! }
        }

        ready.value = true
        await loadDefaultImage()
        if (store !== s) return
        loadMeanSpectrum() // background
      } else {
        // Processed mode: load TIC image
        ready.value = true
        await loadTICImage()
      }
    } catch (e) {
      console.error('[useZarrIonImage] init failed:', e)
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  return {
    // Common
    selectedMzIndex,
    selectedMz,
    mzTolerance,
    ionMatrix,
    ionCols,
    ionRows,
    totalPeaks,
    isContinuous,
    isProcessed,
    loading,
    error,
    ready,
    init,

    // Continuous mode
    onSpectrumClickByIndex,
    loadForMzIndex,
    loadNormalization,
    clearNormalization,
    normalizationFactors,
    normalizationLoading,
    normalizationError,

    // Processed mode
    selectedPixelIndex,
    loadSpectrumForPixel,
  }
}
