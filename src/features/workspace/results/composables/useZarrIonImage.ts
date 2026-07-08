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
import { getZarrAccess } from '@/services/zarrAccessApi'
import {
  ZarrOssStore,
  type IonImageInfo,
  type MetadataAttrs,
  type DataMode,
} from '@/services/zarrOssStore'
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

// ---- Mean spectrum state (continuous mode) ----

export const meanChartData = shallowRef<[number, number][]>([])
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
    if (!meanData) {
      spectrumLoading.value = false
      spectrumError.value = 'Mean spectrum not available'
      return
    }

    nMz.value = axis.length
    const data: [number, number][] = []
    for (let i = 0; i < axis.length; i++) {
      const v = meanData[i]!
      if (v !== 0 && Number.isFinite(v)) {
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
    if (fastMatrix) {
      ticMatrix.value = fastMatrix
      ticLoading.value = false
      return
    }

    // Fallback: compute TIC by summing all intensity chunks
    const matrix = await store.computeTICImage()
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
  const indices: number[] = []
  for (let i = 0; i < mzAxis.length; i++) {
    const mz = mzAxis[i]!
    if (mz >= target - tolerance && mz <= target + tolerance) indices.push(i)
    else if (mz > target + tolerance) break
  }
  return indices.length ? indices : [targetIdx]
}

// ---- Helper: load ion image slice sum (continuous mode) ----

async function loadIonSliceSum(indices: number[]): Promise<Float32Array | null> {
  if (!store || !indices.length || !ionDims.value) return null
  const { width, height } = ionDims.value
  const size = width * height
  const sum = new Float32Array(size)
  for (const idx of indices) {
    try {
      const info: IonImageInfo = await store.getIonImageByMzIndex(idx)
      for (let i = 0; i < size; i++) sum[i]! += info.matrix[i]!
    } catch (e) {
      console.warn(`[useZarrIonImage] skip mzIndex=${idx}:`, (e as Error).message)
    }
  }
  return sum
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

export function findClosestPeak(mz: number, tolerance: number): number {
  const axis = mzAxisRef.value
  if (!axis || !axis.length) return -1
  const idx = findClosestMzIndex(mz)
  if (idx < 0) return -1
  if (Math.abs(axis[idx]! - mz) <= tolerance) return idx
  return -1
}

// ---- Main composable ----

export function useZarrIonImage() {
  // Continuous mode state
  const selectedMzIndex = ref(0)
  const mzTolerance = ref<number>(ZARR_STORE.defaultMzTolerance)
  const ionMatrix = ref<Float32Array | null>(null)
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
    loading.value = true
    selectedMzIndex.value = idx
    ionMatrix.value = await loadIonSliceSum(findMzRangeIndices(idx, mzTolerance.value))
    loading.value = false
  }

  const onSpectrumClickByIndex = async (idx: number) => {
    if (!mzAxisRef.value || !ready.value) return
    if (idx < 0 || idx >= mzAxisRef.value.length) return
    await loadForMzIndex(idx)
  }

  const loadDefaultImage = async () => {
    if (!mzAxisRef.value || !ready.value) return
    const idx = findClosestMzIndex(900.5)
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
    store = null
    mzAxisRef.value = null
    ionDims.value = null
    ionMatrix.value = null
    dataModeRef.value = null
    rowAxisRef.value = null
    metadataAttrsRef.value = null

    // Reset mean spectrum state
    meanChartData.value = []
    spectrumLoading.value = false
    spectrumError.value = null

    // Reset TIC state
    ticMatrix.value = null
    ticLoading.value = false
    ticError.value = null

    // Reset per-pixel spectrum state
    pixelSpectrum.value = null
    pixelSpectrumLoading.value = false
    pixelSpectrumError.value = null

    try {
      const access = await getZarrAccess(runId)
      store = new ZarrOssStore(access, {
        intensityChunkCacheSize: ZARR_STORE.intensityChunkCacheSize,
      })
      await store.init()

      // Set mode and row axis
      dataModeRef.value = store.dataMode
      rowAxisRef.value = store.rowAxis
      metadataAttrsRef.value = store.metadataAttrs

      // Set spatial dimensions
      const [height, width] = store.spatialShape
      ionDims.value = { width, height }

      if (store.dataMode === 'continuous') {
        // Load shared m/z axis
        const mzAxis = await store.loadMzAxis()
        mzAxisRef.value = mzAxis

        // Set ion shape for backward compat
        const shape = store.getIonShape()
        if (shape) {
          ionDims.value = { width: shape[2]!, height: shape[1]! }
        }

        ready.value = true
        await loadDefaultImage()
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

    // Processed mode
    selectedPixelIndex,
    loadSpectrumForPixel,
  }
}
