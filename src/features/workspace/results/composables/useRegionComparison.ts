/**
 * Region comparison composable.
 *
 * Compares two regions (KMeans clusters or ROIs) by streaming through the
 * entire intensity array once and accumulating per-ion statistics (sum,
 * sum-of-squares, non-zero count) for each region. From these it derives
 * mean intensity, detection rate, fold-change ratio, and a category
 * (A-only / B-only / A-enriched / B-enriched / shared).
 *
 * Only available in continuous mode (ion-major storage) where every ion has
 * one intensity value per pixel, indexed by axes/coordinates order.
 *
 * The 2D raster masks (KMeans labels or ROI boolean[][] -> Uint8Array) are
 * cached after a comparison so that clicking a result row can build an
 * RGBA overlay highlighting the two regions on the ion image without
 * re-fetching any data.
 */

import { ref, computed, shallowRef, watch, type Ref } from 'vue'
import {
  getSharedZarrContext,
  meanSpectrumRef,
} from '@/features/workspace/results/composables/useZarrIonImage'
import type { KmeansCluster } from '@/features/workspace/results/composables/useOverlayData'
import type { ConfirmedROI } from '@/features/workspace/results/composables/useROI'
import { hexToRgb, rgbCss, type RGB } from '@/features/workspace/results/utils/regionPalette'

// ---------- types ----------

export type ComparisonCategory = 'a-only' | 'b-only' | 'a-enriched' | 'b-enriched' | 'shared'

export interface IonComparison {
  ionIndex: number
  mz: number
  meanA: number
  meanB: number
  /** meanA / meanB. Infinity = A-only, 0 = B-only. */
  ratio: number
  /** Detection rate (0-1) in region A. */
  detA: number
  /** Detection rate (0-1) in region B. */
  detB: number
  category: ComparisonCategory
}

export type RegionSource =
  | { type: 'cluster'; id: number }
  | { type: 'roi'; id: string }

export interface RegionOption {
  /** String id for <select> value: "cluster:0" or "roi:roi-1" */
  value: string
  label: string
  source: RegionSource
  /** CSS color identifying this region (kmeans palette color or ROI color). */
  color: string
}

/** Region payload for the preview thumbnail (color resolved, mask gridded). */
export interface RegionThumbnailRegion {
  value: string
  label: string
  color: RGB
  mask: Uint8Array
}

// ---------- constants ----------

/** Fold-change threshold for "enriched" (>= 2x stronger). */
const ENRICHMENT_RATIO = 2

// ---------- composable ----------

export function useRegionComparison(deps: {
  kmeansClusters: Ref<KmeansCluster[]>
  kmeansLabelsAvailable: Ref<boolean>
  getKmeansLabels: () => Int32Array | null
  confirmedROIs: Ref<ConfirmedROI[]>
  ionCols: Ref<number>
  ionRows: Ref<number>
  onSelectMzIndex: (idx: number) => void | Promise<void>
  setComparisonOverlay: (rgba: Uint8ClampedArray | null) => void
}) {
  const regionAId = ref<string | null>(null)
  const regionBId = ref<string | null>(null)
  const minDetectionRate = ref(5) // percentage, 1-50
  const noiseFloorPercentile = ref(5) // percentile of non-zero mean spectrum, 0-20
  const comparing = ref(false)
  const progress = ref(0)
  const error = ref<string | null>(null)
  const results = shallowRef<IonComparison[]>([])
  const hasResults = ref(false)
  const overlayVisible = ref(false)
  /** Total ions in the m/z axis (before any filtering). */
  const totalIons = ref(0)
  /** Breakdown of how many ions were filtered out and why. */
  const filterStats = ref<{ total: number; kept: number; filtered: number }>({
    total: 0,
    kept: 0,
    filtered: 0,
  })

  let cancelled = false
  // Cached 2D raster masks + dims for overlay building on result click
  let cachedRasterA: Uint8Array | null = null
  let cachedRasterB: Uint8Array | null = null
  let cachedDims: { width: number; height: number } | null = null
  // Sources of the last successful comparison, so the overlay can be repainted
  // with the regions' actual colors (which may change when k is re-run).
  let cachedSourceA: RegionSource | null = null
  let cachedSourceB: RegionSource | null = null

  const availableRegions = computed<RegionOption[]>(() => {
    const regions: RegionOption[] = []
    if (deps.kmeansLabelsAvailable.value) {
      for (const c of deps.kmeansClusters.value) {
        regions.push({
          value: `cluster:${c.id}`,
          label: `Cluster ${c.id}`,
          source: { type: 'cluster', id: c.id },
          color: rgbCss({ r: c.color[0], g: c.color[1], b: c.color[2] }),
        })
      }
    }
    for (const roi of deps.confirmedROIs.value) {
      regions.push({
        value: `roi:${roi.id}`,
        label: roi.label,
        source: { type: 'roi', id: roi.id },
        color: roi.color,
      })
    }
    return regions
  })

  // A deleted region must not linger in the selectors - otherwise the
  // thumbnail/overlay would keep showing a region that no longer exists.
  watch(availableRegions, (regions) => {
    if (regionAId.value && !regions.some((r) => r.value === regionAId.value)) {
      regionAId.value = null
    }
    if (regionBId.value && !regions.some((r) => r.value === regionBId.value)) {
      regionBId.value = null
    }
  })

  /** Selected A/B options (null when unselected or stale). */
  const selectedRegionA = computed(
    () => availableRegions.value.find((r) => r.value === regionAId.value) ?? null,
  )
  const selectedRegionB = computed(
    () => availableRegions.value.find((r) => r.value === regionBId.value) ?? null,
  )

  /** Fallback colors while a side has no region selected (neutral gray). */
  const FALLBACK_RGB: RGB = { r: 148, g: 163, b: 184 }

  function optionRgb(opt: RegionOption | null): RGB {
    if (!opt) return FALLBACK_RGB
    if (opt.source.type === 'cluster') {
      const cluster = deps.kmeansClusters.value.find((c) => c.id === (opt.source as { type: 'cluster'; id: number }).id)
      if (cluster) return { r: cluster.color[0], g: cluster.color[1], b: cluster.color[2] }
      return FALLBACK_RGB
    }
    return hexToRgb(opt.color) ?? FALLBACK_RGB
  }

  const colorA = computed(() => optionRgb(selectedRegionA.value))
  const colorB = computed(() => optionRgb(selectedRegionB.value))

  const canCompare = computed(() => {
    if (comparing.value) return false
    if (!regionAId.value || !regionBId.value) return false
    return regionAId.value !== regionBId.value
  })

  // ---------- helpers ----------

  function parseRegion(id: string): RegionSource | null {
    if (id.startsWith('cluster:')) {
      return { type: 'cluster', id: parseInt(id.slice(8), 10) }
    }
    if (id.startsWith('roi:')) {
      return { type: 'roi', id: id.slice(4) }
    }
    return null
  }

  /** Build a 2D raster mask (Uint8Array, indexed by row*width+col) from a region source. */
  function buildRaster(source: RegionSource): Uint8Array | null {
    const ctx = getSharedZarrContext()
    const store = ctx.store
    if (!store) return null
    const [height, width] = store.spatialShape
    const raster = new Uint8Array(width * height)

    if (source.type === 'cluster') {
      const labels = deps.getKmeansLabels()
      if (!labels) return null
      // Local KMeans labels: -1 = background, 0..K-1 = cluster id
      for (let i = 0; i < labels.length; i++) {
        if (labels[i] === source.id) raster[i] = 1
      }
    } else {
      const roi = deps.confirmedROIs.value.find((r) => r.id === source.id)
      if (!roi) return null
      for (let r = 0; r < height; r++) {
        const row = roi.mask[r]
        if (!row) continue
        for (let c = 0; c < width; c++) {
          if (row[c]) raster[r * width + c] = 1
        }
      }
    }
    return raster
  }

  /**
   * Compute the 5th percentile of non-zero mean-spectrum values as a
   * noise floor. Ions whose region means are both below this floor are
   * treated as noise and excluded.
   */
  function computeNoiseFloor(): number {
    const meanSpec = meanSpectrumRef.value
    if (!meanSpec || !meanSpec.length) return 0
    const temp: number[] = []
    for (let i = 0; i < meanSpec.length; i++) {
      const v = meanSpec[i]!
      if (v > 0 && Number.isFinite(v)) temp.push(v)
    }
    if (!temp.length) return 0
    temp.sort((a, b) => a - b)
    const pct = Math.max(0, Math.min(100, noiseFloorPercentile.value))
    return temp[Math.floor(temp.length * (pct / 100))] ?? 0
  }

  // ---------- main compare action ----------

  async function compare() {
    if (!canCompare.value) return
    const ctx = getSharedZarrContext()
    const store = ctx.store
    if (!store) {
      error.value = 'Data not loaded yet'
      return
    }

    const sourceA = parseRegion(regionAId.value!)
    const sourceB = parseRegion(regionBId.value!)
    if (!sourceA || !sourceB) return

    comparing.value = true
    cancelled = false
    progress.value = 0
    error.value = null
    results.value = []
    hasResults.value = false
    overlayVisible.value = false
    deps.setComparisonOverlay(null)

    try {
      // Build 2D raster masks
      const rasterA = buildRaster(sourceA)
      const rasterB = buildRaster(sourceB)
      if (!rasterA || !rasterB) {
        error.value = 'Failed to build region masks - ensure KMeans/ROI data is available'
        return
      }

      const [height, width] = store.spatialShape
      cachedRasterA = rasterA
      cachedRasterB = rasterB
      cachedDims = { width, height }
      cachedSourceA = sourceA
      cachedSourceB = sourceB

      if (cancelled) return

      // Convert to 1D coordinates-order masks
      const [maskA, maskB] = await Promise.all([
        store.buildPixelMask(rasterA),
        store.buildPixelMask(rasterB),
      ])
      if (cancelled) return

      if (maskA.pixelCount === 0 || maskB.pixelCount === 0) {
        error.value = 'One or both regions contain no pixels'
        return
      }

      // Stream intensity stats for both regions
      const stats = await store.streamIonStats(
        [maskA.mask, maskB.mask],
        (done, total) => {
          progress.value = Math.round((done / total) * 100)
        },
        () => cancelled,
      )
      if (cancelled) return

      const mzAxis = ctx.mzAxis
      if (!mzAxis) {
        error.value = 'm/z axis not available'
        return
      }

      const nIons = mzAxis.length
      const minRate = minDetectionRate.value / 100
      const noiseFloor = computeNoiseFloor()

      const comparisons: IonComparison[] = []
      let filteredByDetection = 0
      let filteredByIntensity = 0
      for (let i = 0; i < nIons; i++) {
        const cntA = stats[0]!.count[i]!
        const cntB = stats[1]!.count[i]!
        const detA = maskA.pixelCount > 0 ? cntA / maskA.pixelCount : 0
        const detB = maskB.pixelCount > 0 ? cntB / maskB.pixelCount : 0

        // Filter 1: detection rate in at least one region
        if (detA < minRate && detB < minRate) {
          filteredByDetection++
          continue
        }

        // All-pixel means (sum / total pixels including zeros) - consistent
        // with the global mean spectrum and captures both intensity + coverage.
        const meanA = maskA.pixelCount > 0 ? stats[0]!.sum[i]! / maskA.pixelCount : 0
        const meanB = maskB.pixelCount > 0 ? stats[1]!.sum[i]! / maskB.pixelCount : 0

        // Filter 2: intensity above noise floor in at least one region
        if (meanA < noiseFloor && meanB < noiseFloor) {
          filteredByIntensity++
          continue
        }

        // Category
        const aPresent = detA >= minRate
        const bPresent = detB >= minRate
        let category: ComparisonCategory
        if (aPresent && !bPresent) {
          category = 'a-only'
        } else if (!aPresent && bPresent) {
          category = 'b-only'
        } else {
          // Both present
          if (meanB > 0 && meanA / meanB >= ENRICHMENT_RATIO) {
            category = 'a-enriched'
          } else if (meanA > 0 && meanB / meanA >= ENRICHMENT_RATIO) {
            category = 'b-enriched'
          } else {
            category = 'shared'
          }
        }

        const ratio = meanB > 0 ? meanA / meanB : meanA > 0 ? Infinity : 0

        comparisons.push({
          ionIndex: i,
          mz: mzAxis[i]!,
          meanA,
          meanB,
          ratio,
          detA,
          detB,
          category,
        })
      }

      const totalKept = comparisons.length
      const totalFiltered = filteredByDetection + filteredByIntensity
      totalIons.value = nIons
      filterStats.value = { total: nIons, kept: totalKept, filtered: totalFiltered }
      console.log('[useRegionComparison] filter breakdown:', {
        total: nIons,
        kept: totalKept,
        filteredByDetection,
        filteredByIntensity,
        totalFiltered,
        minDetectionRate: minDetectionRate.value + '%',
        noiseFloorPercentile: noiseFloorPercentile.value + '%',
        noiseFloor,
      })

      // Sort by |log2 ratio| descending (most different first)
      comparisons.sort((a, b) => {
        const logA = a.ratio === Infinity ? Infinity : a.ratio === 0 ? -Infinity : Math.log2(a.ratio)
        const logB = b.ratio === Infinity ? Infinity : b.ratio === 0 ? -Infinity : Math.log2(b.ratio)
        return Math.abs(logB) - Math.abs(logA)
      })

      results.value = comparisons
      hasResults.value = true
    } catch (e) {
      console.error('[useRegionComparison] compare failed:', e)
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      comparing.value = false
    }
  }

  // ---------- result interaction ----------

  /** Click a result row: load the ion image only. Region colors are shown in
   * the comparison thumbnail, not painted over the main ion image. */
  function selectMz(ionIndex: number) {
    deps.onSelectMzIndex(ionIndex)
  }

  /** Look up a region source's current display color (kmeans palette / ROI). */
  function colorForSource(source: RegionSource | null): RGB {
    if (!source) return FALLBACK_RGB
    if (source.type === 'cluster') {
      const cluster = deps.kmeansClusters.value.find((c) => c.id === source.id)
      return cluster
        ? { r: cluster.color[0], g: cluster.color[1], b: cluster.color[2] }
        : FALLBACK_RGB
    }
    const roi = deps.confirmedROIs.value.find((r) => r.id === source.id)
    return roi ? hexToRgb(roi.color) ?? FALLBACK_RGB : FALLBACK_RGB
  }

  /** Build and show the overlay highlighting region A / B in their own colors. */
  function showOverlay() {
    if (!cachedRasterA || !cachedRasterB || !cachedDims) return
    const { width, height } = cachedDims
    const n = width * height
    const ca = colorForSource(cachedSourceA)
    const cb = colorForSource(cachedSourceB)
    const rgba = new Uint8ClampedArray(n * 4)
    for (let i = 0; i < n; i++) {
      if (cachedRasterA[i]) {
        rgba[i * 4] = ca.r
        rgba[i * 4 + 1] = ca.g
        rgba[i * 4 + 2] = ca.b
        rgba[i * 4 + 3] = 80 // semi-transparent
      } else if (cachedRasterB[i]) {
        rgba[i * 4] = cb.r
        rgba[i * 4 + 1] = cb.g
        rgba[i * 4 + 2] = cb.b
        rgba[i * 4 + 3] = 80
      }
      // else: transparent (alpha stays 0)
    }
    deps.setComparisonOverlay(rgba)
    overlayVisible.value = true
  }

  function hideOverlay() {
    deps.setComparisonOverlay(null)
    overlayVisible.value = false
  }

  function toggleRegionOverlay() {
    if (overlayVisible.value) hideOverlay()
    else showOverlay()
  }

  // ---------- thumbnail ----------

  /**
   * Build thumbnail-ready masks for the currently selected A/B regions.
   * Reuses buildRaster (kmeans labels / ROI mask -> Uint8Array grid) so the
   * preview works the moment a region is selected, before any comparison run.
   * Returns null when the zarr store (grid shape) isn't available yet.
   */
  function buildThumbnailRegions(): {
    a: RegionThumbnailRegion | null
    b: RegionThumbnailRegion | null
    dims: { width: number; height: number }
  } | null {
    const ctx = getSharedZarrContext()
    const store = ctx.store
    if (!store) return null
    const [height, width] = store.spatialShape
    const dims = { width, height }

    const build = (opt: RegionOption | null): RegionThumbnailRegion | null => {
      if (!opt) return null
      const mask = buildRaster(opt.source)
      if (!mask) return null
      return { value: opt.value, label: opt.label, color: optionRgb(opt), mask }
    }
    return { a: build(selectedRegionA.value), b: build(selectedRegionB.value), dims }
  }

  // ---------- cleanup ----------

  function cancel() {
    cancelled = true
  }

  function reset() {
    cancelled = true
    results.value = []
    hasResults.value = false
    error.value = null
    progress.value = 0
    comparing.value = false
    overlayVisible.value = false
    totalIons.value = 0
    filterStats.value = { total: 0, kept: 0, filtered: 0 }
    cachedRasterA = null
    cachedRasterB = null
    cachedDims = null
    cachedSourceA = null
    cachedSourceB = null
    deps.setComparisonOverlay(null)
  }

  return {
    // State
    regionAId,
    regionBId,
    minDetectionRate,
    noiseFloorPercentile,
    comparing,
    progress,
    error,
    results,
    hasResults,
    overlayVisible,
    totalIons,
    filterStats,
    availableRegions,
    canCompare,
    selectedRegionA,
    selectedRegionB,
    colorA,
    colorB,
    // Actions
    compare,
    cancel,
    reset,
    selectMz,
    toggleRegionOverlay,
    hideOverlay,
    buildThumbnailRegions,
  }
}
