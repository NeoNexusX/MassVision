/**
 * Region comparison composable.
 *
 * Compares two region GROUPS (each a non-empty set of KMeans clusters and/or
 * ROIs) by OR-combining the member masks into one raster per side, then
 * streaming through the entire intensity array once and accumulating per-ion
 * statistics (sum, sum-of-squares, non-zero count) for each side. From these
 * it derives mean intensity, detection rate, fold-change ratio, and a
 * category (A-only / B-only / A-enriched / B-enriched / shared). The
 * streaming/stats pipeline only ever sees two masks, so group semantics live
 * entirely in mask construction.
 *
 * Continuous mode (ion-major storage): every ion has one intensity value
 * per pixel, indexed by axes/coordinates order. Processed mode (pixel-major):
 * intensities are aggregated into fixed-width m/z bins via
 * streamIonStatsProcessed, so results are per bin rather than per ion.
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
import type { DataMode } from '@/services/zarr/types/zarr'

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

/** m/z bin width (Da) for processed-mode region comparison. */
const PROCESSED_BIN_WIDTH = 0.01

// ---------- composable ----------

export function useRegionComparison(deps: {
  enabled?: boolean
  kmeansClusters: Ref<KmeansCluster[]>
  kmeansLabelsAvailable: Ref<boolean>
  getKmeansLabels: () => Int32Array | null
  confirmedROIs: Ref<ConfirmedROI[]>
  ionCols: Ref<number>
  ionRows: Ref<number>
  dataMode: Ref<DataMode | null>
  onSelectMzIndex: (idx: number) => void | Promise<void>
  setComparisonOverlay: (rgba: Uint8ClampedArray | null) => void
}) {
  const featureEnabled = deps.enabled !== false
  const regionAIds = ref<string[]>([])
  const regionBIds = ref<string[]>([])
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
  // Cached per-member 2D raster masks (with their sources) + dims for overlay
  // building on result click. Members are kept separate so the overlay can
  // paint each member in its own identity color.
  let cachedMembersA: { source: RegionSource; raster: Uint8Array }[] = []
  let cachedMembersB: { source: RegionSource; raster: Uint8Array }[] = []
  let cachedDims: { width: number; height: number } | null = null

  const availableRegions = computed<RegionOption[]>(() => {
    if (!featureEnabled) return []
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

  // Deleted regions must not linger in the selectors - otherwise the
  // thumbnail/overlay would keep showing a region that no longer exists.
  if (featureEnabled) {
    watch(availableRegions, (regions) => {
      regionAIds.value = regionAIds.value.filter((id) => regions.some((r) => r.value === id))
      regionBIds.value = regionBIds.value.filter((id) => regions.some((r) => r.value === id))
    })
  }

  /** Selected A/B options (stale ids filtered out). */
  const selectedRegionsA = computed(
    () =>
      regionAIds.value
        .map((id) => availableRegions.value.find((r) => r.value === id))
        .filter((r): r is RegionOption => !!r),
  )
  const selectedRegionsB = computed(
    () =>
      regionBIds.value
        .map((id) => availableRegions.value.find((r) => r.value === id))
        .filter((r): r is RegionOption => !!r),
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

  // Group identity color: first member's color (fallback gray when empty).
  const colorA = computed(() => optionRgb(selectedRegionsA.value[0] ?? null))
  const colorB = computed(() => optionRgb(selectedRegionsB.value[0] ?? null))

  const canCompare = computed(() => {
    if (!featureEnabled) return false
    if (comparing.value) return false
    if (!regionAIds.value.length || !regionBIds.value.length) return false
    // A region may not participate in both groups
    return !regionAIds.value.some((id) => regionBIds.value.includes(id))
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
   * Build per-member rasters for a group of sources. Returns null when any
   * member's data is unavailable (e.g. KMeans labels not loaded).
   */
  function buildMemberRasters(
    sources: RegionSource[],
  ): { source: RegionSource; raster: Uint8Array }[] | null {
    const members: { source: RegionSource; raster: Uint8Array }[] = []
    for (const source of sources) {
      const raster = buildRaster(source)
      if (!raster) return null
      members.push({ source, raster })
    }
    return members
  }

  /** OR-combine member rasters into one group mask. */
  function combineRasters(
    members: { raster: Uint8Array }[],
    size: number,
  ): Uint8Array {
    const combined = new Uint8Array(size)
    for (const m of members) {
      const r = m.raster
      for (let i = 0; i < size; i++) {
        if (r[i]) combined[i] = 1
      }
    }
    return combined
  }

  /**
   * Percentile of a sorted-or-unsorted array of values.
   * @param values values to compute from (will be copied + sorted)
   * @param pct percentile 0-100
   */
  function percentile(values: number[], pct: number): number {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const clamped = Math.max(0, Math.min(100, pct))
    return sorted[Math.floor(sorted.length * (clamped / 100))] ?? 0
  }

  /**
   * Compute the noise floor from the pre-computed mean spectrum (continuous
   * mode). Ions whose region means are both below this floor are treated as
   * noise and excluded.
   */
  function computeNoiseFloor(): number {
    const meanSpec = meanSpectrumRef.value
    if (!meanSpec || !meanSpec.length) return 0
    const temp: number[] = []
    for (let i = 0; i < meanSpec.length; i++) {
      const v = meanSpec[i]!
      if (v > 0 && Number.isFinite(v)) temp.push(v)
    }
    return percentile(temp, noiseFloorPercentile.value)
  }

  // ---------- main compare action ----------

  /**
   * Convert raw per-ion/per-bin stats into IonComparison[] with filtering and
   * categorisation. Shared by continuous and processed paths so the result
   * shape and classification logic stays identical.
   */
  function buildComparisons(
    nItems: number,
    mzAt: (i: number) => number,
    sumA: Float64Array, countA: Int32Array,
    sumB: Float64Array, countB: Int32Array,
    pixelCountA: number, pixelCountB: number,
    noiseFloor: number,
  ): IonComparison[] {
    const minRate = minDetectionRate.value / 100
    const comparisons: IonComparison[] = []
    let filteredByDetection = 0
    let filteredByIntensity = 0

    for (let i = 0; i < nItems; i++) {
      const cntA = countA[i]!
      const cntB = countB[i]!
      const detA = pixelCountA > 0 ? cntA / pixelCountA : 0
      const detB = pixelCountB > 0 ? cntB / pixelCountB : 0

      if (detA < minRate && detB < minRate) {
        filteredByDetection++
        continue
      }

      const meanA = pixelCountA > 0 ? sumA[i]! / pixelCountA : 0
      const meanB = pixelCountB > 0 ? sumB[i]! / pixelCountB : 0

      if (meanA < noiseFloor && meanB < noiseFloor) {
        filteredByIntensity++
        continue
      }

      const aPresent = detA >= minRate
      const bPresent = detB >= minRate
      let category: ComparisonCategory
      if (aPresent && !bPresent) {
        category = 'a-only'
      } else if (!aPresent && bPresent) {
        category = 'b-only'
      } else {
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
        mz: mzAt(i),
        meanA,
        meanB,
        ratio,
        detA,
        detB,
        category,
      })
    }

    totalIons.value = nItems
    filterStats.value = {
      total: nItems,
      kept: comparisons.length,
      filtered: filteredByDetection + filteredByIntensity,
    }

    comparisons.sort((a, b) => {
      const logA = a.ratio === Infinity ? Infinity : a.ratio === 0 ? -Infinity : Math.log2(a.ratio)
      const logB = b.ratio === Infinity ? Infinity : b.ratio === 0 ? -Infinity : Math.log2(b.ratio)
      return Math.abs(logB) - Math.abs(logA)
    })

    return comparisons
  }

  async function compare() {
    if (!featureEnabled) return
    if (!canCompare.value) return
    const ctx = getSharedZarrContext()
    const store = ctx.store
    if (!store) {
      error.value = 'Data not loaded yet'
      return
    }

    const sourcesA = regionAIds.value
      .map(parseRegion)
      .filter((s): s is RegionSource => !!s)
    const sourcesB = regionBIds.value
      .map(parseRegion)
      .filter((s): s is RegionSource => !!s)
    if (!sourcesA.length || !sourcesB.length) return

    comparing.value = true
    cancelled = false
    progress.value = 0
    error.value = null
    results.value = []
    hasResults.value = false
    overlayVisible.value = false
    deps.setComparisonOverlay(null)

    try {
      // Build per-member rasters, then OR-combine into one group mask per side
      const membersA = buildMemberRasters(sourcesA)
      const membersB = buildMemberRasters(sourcesB)
      if (!membersA || !membersB) {
        error.value = 'Failed to build region masks - ensure KMeans/ROI data is available'
        return
      }

      const [height, width] = store.spatialShape
      const rasterA = combineRasters(membersA, width * height)
      const rasterB = combineRasters(membersB, width * height)
      cachedMembersA = membersA
      cachedMembersB = membersB
      cachedDims = { width, height }

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

      const isProcessed = deps.dataMode.value === 'processed'

      let comparisons: IonComparison[]

      if (isProcessed) {
        // ---- Processed mode: m/z binning ----
        const { bins, binCount } = await store.streamIonStatsProcessed(
          [maskA.mask, maskB.mask],
          PROCESSED_BIN_WIDTH,
          (done, total) => {
            progress.value = Math.round((done / total) * 100)
          },
          () => cancelled,
        )
        if (cancelled) return
        if (binCount === 0) {
          error.value = 'No m/z bins found in the selected regions'
          return
        }

        // Noise floor: percentile of non-zero bin means across both regions
        const allMeans: number[] = []
        for (let b = 0; b < binCount; b++) {
          const mA = maskA.pixelCount > 0 ? bins[b]!.sum[0]! / maskA.pixelCount : 0
          const mB = maskB.pixelCount > 0 ? bins[b]!.sum[1]! / maskB.pixelCount : 0
          const mx = Math.max(mA, mB)
          if (mx > 0 && Number.isFinite(mx)) allMeans.push(mx)
        }
        const noiseFloor = percentile(allMeans, noiseFloorPercentile.value)

        comparisons = buildComparisons(
          binCount,
          (i) => bins[i]!.mz,
          Float64Array.from(bins, (b) => b.sum[0]!),
          Int32Array.from(bins, (b) => b.count[0]!),
          Float64Array.from(bins, (b) => b.sum[1]!),
          Int32Array.from(bins, (b) => b.count[1]!),
          maskA.pixelCount, maskB.pixelCount,
          noiseFloor,
        )
      } else {
        // ---- Continuous mode: shared m/z axis ----
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

        const noiseFloor = computeNoiseFloor()

        comparisons = buildComparisons(
          mzAxis.length,
          (i) => mzAxis[i]!,
          stats[0]!.sum, stats[0]!.count,
          stats[1]!.sum, stats[1]!.count,
          maskA.pixelCount, maskB.pixelCount,
          noiseFloor,
        )
      }

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

  /** Click a result row: load the ion image (continuous mode only).
   *  Processed mode has no ion image - the row click is a no-op. */
  function selectMz(ionIndex: number) {
    if (!featureEnabled) return
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

  /** Build and show the overlay highlighting region A / B members, each in
   *  its own identity color. B members are painted after A so overlap reads
   *  as B - same precedence as before. */
  function showOverlay() {
    if (!cachedDims || (!cachedMembersA.length && !cachedMembersB.length)) return
    const { width, height } = cachedDims
    const n = width * height
    const rgba = new Uint8ClampedArray(n * 4)
    const paint = (members: { source: RegionSource; raster: Uint8Array }[]) => {
      for (const m of members) {
        const c = colorForSource(m.source)
        for (let i = 0; i < n; i++) {
          if (!m.raster[i]) continue
          rgba[i * 4] = c.r
          rgba[i * 4 + 1] = c.g
          rgba[i * 4 + 2] = c.b
          rgba[i * 4 + 3] = 80 // semi-transparent
        }
      }
    }
    paint(cachedMembersA)
    paint(cachedMembersB)
    // else: transparent (alpha stays 0)
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
   * Build thumbnail-ready masks for the currently selected A/B group members.
   * Reuses buildRaster (kmeans labels / ROI mask -> Uint8Array grid) so the
   * preview works the moment a region is selected, before any comparison run.
   * Returns null when the zarr store (grid shape) isn't available yet.
   */
  function buildThumbnailRegions(): {
    a: RegionThumbnailRegion[]
    b: RegionThumbnailRegion[]
    dims: { width: number; height: number }
  } | null {
    if (!featureEnabled) return null
    const ctx = getSharedZarrContext()
    const store = ctx.store
    if (!store) return null
    const [height, width] = store.spatialShape
    const dims = { width, height }

    const build = (opts: RegionOption[]): RegionThumbnailRegion[] => {
      const out: RegionThumbnailRegion[] = []
      for (const opt of opts) {
        const mask = buildRaster(opt.source)
        if (!mask) continue
        out.push({ value: opt.value, label: opt.label, color: optionRgb(opt), mask })
      }
      return out
    }
    return { a: build(selectedRegionsA.value), b: build(selectedRegionsB.value), dims }
  }

  // ---------- cleanup ----------

  function cancel() {
    cancelled = true
  }

  /** True when the last comparison involved an ROI (either side). Used to
   *  decide whether clearing/deleting ROIs should also reset the comparison —
   *  a pure KMeans-vs-KMeans comparison is unaffected by ROI changes. */
  function involvesRoi(): boolean {
    return (
      cachedMembersA.some((m) => m.source.type === 'roi') ||
      cachedMembersB.some((m) => m.source.type === 'roi')
    )
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
    cachedMembersA = []
    cachedMembersB = []
    cachedDims = null
    deps.setComparisonOverlay(null)
  }

  return {
    // State
    regionAIds,
    regionBIds,
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
    selectedRegionsA,
    selectedRegionsB,
    colorA,
    colorB,
    // Actions
    compare,
    cancel,
    reset,
    involvesRoi,
    selectMz,
    toggleRegionOverlay,
    hideOverlay,
    buildThumbnailRegions,
  }
}
