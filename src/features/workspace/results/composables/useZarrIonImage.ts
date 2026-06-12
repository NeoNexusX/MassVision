/**
 * Ion image composable — loads zarr chunks on demand via OSS STS.
 *
 * selectedMzIndex is the single source of truth; selectedMz is derived from it.
 * The markLine red axis aligns precisely by avoiding floating-point round-trips.
 */
import { computed, ref, shallowRef } from 'vue'
import { getZarrAccess } from '@/services/zarrAccessApi'
import { ZarrOssStore, type IonImageInfo } from '@/services/zarrOssStore'
import { ZARR_STORE } from '@/shared/config/defaults'

/** Module-level shared state; mzAxis uses shallowRef so computed tracks changes */
let store: ZarrOssStore | null = null
const mzAxisRef = shallowRef<Float64Array | null>(null)
const ionDims = shallowRef<{ width: number; height: number } | null>(null)

// ---- Mean spectrum state (managed here so no component needs store access) ----
export const meanChartData = shallowRef<[number, number][]>([])
export const spectrumLoading = ref(false)
export const spectrumError = ref<string | null>(null)
export const nMz = ref(0)

export type MeanSpectrumState = {
  meanChartData: [number, number][]
  spectrumLoading: boolean
  spectrumError: string | null
  nMz: number
}

export function getSharedZarrContext(): {
  store: ZarrOssStore | null
  mzAxis: Float64Array | null
  ionShape: { width: number; height: number } | null
} & MeanSpectrumState {
  return {
    store,
    mzAxis: mzAxisRef.value,
    ionShape: ionDims.value,
    meanChartData: meanChartData.value,
    spectrumLoading: spectrumLoading.value,
    spectrumError: spectrumError.value,
    nMz: nMz.value,
  }
}

/**
 * Load the mean spectrum from the zarr store and derive non-zero chart data.
 * Only exported so SpectrumSection can call retry; normally invoked from init().
 */
export async function loadMeanSpectrum(): Promise<void> {
  const axis = mzAxisRef.value
  if (!store || !axis) return

  spectrumLoading.value = true
  spectrumError.value = null

  try {
    const meanData = await store.loadMeanSpectrum()

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

export { mzAxisRef }

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

/**
 * Binary search in mzAxis for the index closest to target.
 * Returns -1 if mzAxis is empty.
 */
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

  return Math.abs(target - a[prev]!) <= Math.abs(a[lo]! - target)
    ? prev
    : lo
}

/**
 * Find the closest real peak to the clicked m/z value, constrained
 * within a viewport-based tolerance so we don't snap to a peak far
 * from the click position.
 */
export function findClosestPeak(mz: number, tolerance: number): number {
  const axis = mzAxisRef.value
  if (!axis || !axis.length) return -1

  const idx = findClosestMzIndex(mz)
  if (idx < 0) return -1

  // Gate: only accept if the closest peak falls within tolerance
  if (Math.abs(axis[idx]! - mz) <= tolerance) return idx
  return -1
}

export function useZarrIonImage() {
  const selectedMzIndex = ref(0)
  const mzTolerance = ref<number>(ZARR_STORE.defaultMzTolerance)
  const ionMatrix = ref<Float32Array | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const ready = ref(false)

  const ionCols = computed(() => ionDims.value?.width ?? 0)
  const ionRows = computed(() => ionDims.value?.height ?? 0)
  const totalPeaks = computed(() => (mzAxisRef.value ? mzAxisRef.value.length.toLocaleString() : '--'))

  // selectedMz is DERIVED from selectedMzIndex + mzAxis — never written directly.
  // This guarantees the displayed/passed-down m/z value is exactly the one stored
  // in zarr's mz_axis, with no float round-trip or display-precision loss.
  const selectedMz = computed(() => {
    const axis = mzAxisRef.value
    const idx = selectedMzIndex.value
    if (!axis || idx < 0 || idx >= axis.length) return 0
    return axis[idx]!
  })

  const loadForMzIndex = async (idx: number) => {
    if (!mzAxisRef.value || !ready.value || idx < 0 || idx >= mzAxisRef.value.length) return
    loading.value = true
    selectedMzIndex.value = idx
    ionMatrix.value = await loadIonSliceSum(findMzRangeIndices(idx, mzTolerance.value))
    loading.value = false
  }

  // ===== Public API: spectrum bar click delivers a global mz_axis index =====
  // The spectrum component emits the interpolated m/z value + tolerance,
  // then SpectrumSection calls findPeakIndex() to locate the strongest real
  // peak in the raw mean data within that tolerance window — no reliance on
  // chart dataIndex which only covers non-zero points.
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

  // ===== Initialization =====
  const init = async (runId: string) => {
    if (!runId) return
    loading.value = true
    error.value = null
    ready.value = false
    store = null
    mzAxisRef.value = null
    ionDims.value = null
    ionMatrix.value = null
    // Reset mean spectrum state so the old chart doesn't flash.
    meanChartData.value = []
    spectrumLoading.value = false
    spectrumError.value = null
    try {
      const access = await getZarrAccess(runId)
      store = new ZarrOssStore(access, { ionChunkCacheSize: ZARR_STORE.ionChunkCacheSize })
      await store.init()
      mzAxisRef.value = (await store.loadMzAxis()) as Float64Array
      const shape = store.getIonShape()
      if (shape && shape.length >= 3) ionDims.value = { width: shape[2]!, height: shape[1]! }
      ready.value = true
      await loadDefaultImage()
      await loadMeanSpectrum()   // kick off mean spectrum load (non-blocking for ion image)
    } catch (e) {
      console.error('[useZarrIonImage] init failed:', e)
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  return {
    selectedMzIndex,
    selectedMz,
    mzTolerance,
    ionMatrix,
    ionCols,
    ionRows,
    totalPeaks,
    onSpectrumClickByIndex,
    loadForMzIndex,
    loading,
    error,
    ready,
    init,
  }
}
