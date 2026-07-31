import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import { getZarrAccess } from '@/services/zarrAccessApi'
import { createClustering, type ClusteringTaskResponse } from '@/services/clusteringApi'
import { ClusteringZarrStore } from '@/services/clusteringZarrStore'
import { computeKmeansFromUmap, preloadKmeans } from '@/features/workspace/results/utils/kmeans'
import { kmeansColor } from '@/features/workspace/results/utils/regionPalette'
import { useToast } from '@/shared/composables/useToast'
import { extractBackendError } from '@/shared/api/httpClient'

export type OverlayKind = 'umap' | 'kmeans'

/** A KMeans cluster derived from the local label + RGB images. */
export interface KmeansCluster {
  /** Cluster id from the local KMeans labels. */
  id: number
  /** Display color assigned by the local KMeans renderer. */
  color: [number, number, number]
  /** Number of foreground pixels in this cluster. */
  count: number
}

/**
 * Derive the cluster list from the label image. Colors come straight from the
 * shared region palette (same table the worker renders with), so the chips,
 * overlay, compare panel and thumbnail all show the identical color without
 * sampling the rendered raster. Background is judged by the label value (-1).
 */
function deriveKmeansClusters(labels: Int32Array): KmeansCluster[] {
  const map = new Map<number, KmeansCluster>()
  for (let i = 0; i < labels.length; i++) {
    const id = labels[i]!
    if (id < 0) continue
    let c = map.get(id)
    if (!c) {
      const { r, g, b } = kmeansColor(id)
      c = { id, color: [r, g, b], count: 0 }
      map.set(id, c)
    }
    c.count++
  }
  return [...map.values()].sort((a, b) => a.id - b.id)
}

/**
 * UMAP / KMeans overlay data.
 *
 * UMAP comes from the clustering zarr (GET /processes/{run_id}/zarr?
 * zarr_type=clustering): a pre-rendered (H×W×3) uint8 raster whose RGB
 * channels are the quantized 3D UMAP embedding, matching the ion-image grid.
 * KMeans is computed LOCALLY in the browser from that raster (see
 * utils/kmeans.ts) with a user-chosen k.
 *
 * Task lifecycle (backend UMAP generation): creating → computing → ready.
 * - Page entry (continuous runs): probeExisting() silently fetches the
 *   clustering zarr. Success means a finished task already exists - the UI
 *   auto-enables without any confirmation. Failure is swallowed (no task /
 *   not finished yet); the user can still opt in manually.
 * - Opt-in confirm: createClusteringTask() POSTs (idempotent get-or-create)
 *   and branches on clustering_status. completed → load + ready; otherwise
 *   the UI shows a computing state with a Refresh button that re-POSTs.
 * - `ready` is only ever set by a successful zarr load - the status fields
 *   steer the UI, but the data itself is the final gate.
 */
export function useOverlayData(
  runId: Ref<string>,
  ionRows: Ref<number>,
  ionCols: Ref<number>,
  storageMode: Ref<string>,
) {
  // State - UMAP and KMeans are mutually exclusive: only one shows at a time.
  const umapVisible = ref(false)
  const kmeansVisible = ref(false)
  const overlayData = ref<Uint8ClampedArray | null>(null)
  const overlayLoading = ref(false)
  const overlayError = ref<string | null>(null)
  // Independent overlay opacity per mode (stored as 0-255 alpha; default 255 = 100%).
  const umapAlpha = ref(255)
  const kmeansAlpha = ref(255)
  // Comparison overlay (region A/B highlight). When set, takes priority over
  // UMAP/KMeans so the two compared regions are visible on the ion image.
  const comparisonOverlay = ref<Uint8ClampedArray | null>(null)

  let store: ClusteringZarrStore | null = null
  let umapRgb: Uint8Array | null = null
  let kmeansRgb: Uint8Array | null = null
  let kmeansLabels: Int32Array | null = null
  let dims: { height: number; width: number } | null = null
  // Entry probe runs at most once per run.
  let probedForRun: string | null = null

  /** KMeans clusters (id + sampled color + pixel count), empty until the
   *  user runs a local clustering. */
  const kmeansClusters = ref<KmeansCluster[]>([])
  /** False until a local KMeans run produced labels - the UI should say so
   *  explicitly rather than hide the picker silently. */
  const kmeansLabelsAvailable = ref(false)
  /** The k of the currently computed KMeans result (null = never run). */
  const kmeansK = ref<number | null>(null)
  /** True while a local KMeans computation is in flight. */
  const kmeansComputing = ref(false)
  /** Selected cluster ids: drives both the overlay mask and the export mask.
   *  null = show all (default); an empty Set = explicitly hide all. */
  const selectedKmeansIds = ref<Set<number> | null>(null)

  // Clustering task lifecycle refs (see the module comment above).
  const clusteringCreating = ref(false)
  const clusteringComputing = ref(false)
  const clusteringReady = ref(false)
  const clusteringRefreshing = ref(false)
  const { showToast } = useToast()

  /** Drop the cached zarr store + rasters and mark the data not-ready. */
  function clearCache() {
    store?.dispose()
    store = null
    umapRgb = null
    kmeansRgb = null
    kmeansLabels = null
    dims = null
    kmeansClusters.value = []
    kmeansLabelsAvailable.value = false
    kmeansK.value = null
    selectedKmeansIds.value = null
    comparisonOverlay.value = null
    clusteringReady.value = false
  }

  /**
   * Load the clustering zarr and cache the UMAP raster (KMeans is computed
   * locally on demand, so only umap_image is fetched). Pure read - never
   * POSTs. Safe to call repeatedly; cached after the first success. With
   * `silent`, failures are swallowed without touching overlayError (used by
   * the page-entry probe). Returns whether the data is ready afterwards.
   */
  async function loadClusteringData(opts: { silent?: boolean } = {}): Promise<boolean> {
    // Cache hit: umap raster + dims.
    if (umapRgb && dims) return true
    overlayLoading.value = true
    if (!opts.silent) overlayError.value = null
    const forRun = runId.value
    try {
      const access = await getZarrAccess(forRun, 'clustering')
      const s = new ClusteringZarrStore(access)
      await s.init()
      const umap = await s.loadUmapImage()
      // The user navigated to another run mid-load - discard, don't pollute
      // the new run's cache.
      if (forRun !== runId.value) {
        s.dispose()
        return false
      }
      store = s
      umapRgb = umap.data
      dims = { height: umap.height, width: umap.width }
      clusteringReady.value = true
      clusteringComputing.value = false
      // Preload the ml-kmeans chunk now - the user is on the result page and
      // UMAP is ready, so KMeans is the natural next action. Fire-and-forget.
      preloadKmeans()
      return true
    } catch (e) {
      if (!opts.silent) {
        console.error('[useOverlayData] failed to load clustering data:', e)
        overlayError.value = e instanceof Error ? e.message : String(e)
      } else {
        // Keep the probe quiet in the UI, but still log it so backend/zarr
        // issues don't look like "no clustering task".
        console.warn('[useOverlayData] silent clustering probe failed:', e)
      }
      // NOTE: do NOT clearCache() here. A transient failure (CORS, token,
      // decode) must not throw away rasters that already loaded fine.
      return false
    } finally {
      overlayLoading.value = false
    }
  }

  /**
   * Branch on the task record returned by the (idempotent) clustering POST.
   * 'completed' still has to prove itself by loading the zarr; anything else
   * keeps the UI in the computing state (or surfaces a failure).
   */
  async function applyTaskStatus(task: ClusteringTaskResponse) {
    const s = (task.clustering_status || '').toLowerCase()
    if (s === 'completed') {
      const ok = await loadClusteringData()
      if (ok) showToast('UMAP/KMeans overlays are ready.', 'success')
      // else: overlayError + Retry already surfaced by loadClusteringData.
      return
    }
    if (s.includes('fail') || task.error_message) {
      clusteringComputing.value = false
      overlayError.value = task.error_message || `Clustering task ${s || 'failed'}.`
      return
    }
    clusteringComputing.value = true
  }

  /**
   * Opt-in enable flow: POST /processes/{run_id}/clustering. The POST is an
   * idempotent get-or-create, so this also covers "task already exists" -
   * the response status tells us where the task stands.
   */
  async function createClusteringTask() {
    if (clusteringCreating.value) return
    clusteringCreating.value = true
    try {
      const task = await createClustering(runId.value)
      await applyTaskStatus(task)
      if (clusteringComputing.value) {
        showToast('Clustering task started - use Refresh to check progress.', 'info')
      }
    } catch (e) {
      showToast(extractBackendError(e, 'Failed to create clustering task'), 'error')
    } finally {
      clusteringCreating.value = false
    }
  }

  /**
   * Refresh button: re-POST (idempotent) and branch on clustering_status.
   * Only meaningful while the task is computing.
   */
  async function refreshClusteringStatus() {
    if (clusteringRefreshing.value) return
    clusteringRefreshing.value = true
    try {
      const task = await createClustering(runId.value)
      await applyTaskStatus(task)
      if (clusteringComputing.value) {
        showToast('Clustering is still computing…', 'info')
      }
    } catch (e) {
      showToast(extractBackendError(e, 'Failed to refresh clustering status'), 'error')
    } finally {
      clusteringRefreshing.value = false
    }
  }

  /**
   * Page-entry probe (continuous runs only): if the clustering zarr already
   * exists, load it silently and mark ready - the enable toggle then turns
   * itself on and the buttons work without any confirmation, since no new
   * compute is triggered. A failed probe means "no task / not finished" and
   * is swallowed; the user can still opt in manually.
   */
  async function probeExisting() {
    if (probedForRun === runId.value) return
    probedForRun = runId.value
    await loadClusteringData({ silent: true })
  }

  /**
   * Turn an (H×W×3) uint8 raster into an ion-image-sized RGBA overlay.
   * Background pixels (0,0,0) get alpha 0 (transparent). Returns null (and
   * sets overlayError) if the raster grid doesn't match the ion image.
   */
  function rgbToRgba(
    rgb: Uint8Array,
    height: number,
    width: number,
    alpha: number,
  ): Uint8ClampedArray | null {
    const rows = ionRows.value
    const cols = ionCols.value
    if (!rows || !cols) return null
    if (height !== rows || width !== cols) {
      overlayError.value = `Clustering image (${height}×${width}) does not match the ion image (${rows}×${cols}).`
      return null
    }
    const rgba = new Uint8ClampedArray(rows * cols * 4)
    const n = rows * cols
    for (let i = 0; i < n; i++) {
      const r = rgb[i * 3]!
      const g = rgb[i * 3 + 1]!
      const b = rgb[i * 3 + 2]!
      if (r === 0 && g === 0 && b === 0) continue
      const off = i * 4
      rgba[off] = r
      rgba[off + 1] = g
      rgba[off + 2] = b
      rgba[off + 3] = alpha
    }
    return rgba
  }

  function toggleKmeansCluster(id: number) {
    const all = kmeansClusters.value.map(c => c.id)
    const cur = selectedKmeansIds.value ?? new Set(all)
    const next = new Set(cur)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedKmeansIds.value = next
  }

  function selectAllKmeansClusters() {
    selectedKmeansIds.value = null // null = all
  }

  function clearKmeansClusters() {
    selectedKmeansIds.value = new Set()
  }

  const computeUmapOverlay = () => {
    if (!umapRgb || !dims) return null
    return rgbToRgba(umapRgb, dims.height, dims.width, umapAlpha.value)
  }

  const computeKmeansOverlay = () => {
    if (!kmeansRgb || !dims) return null
    const rgba = rgbToRgba(kmeansRgb, dims.height, dims.width, kmeansAlpha.value)
    if (!rgba) return null
    // Mask out unselected clusters. Background stays decided by RGB (0,0,0)
    // since the label image's background convention is ambiguous.
    if (selectedKmeansIds.value !== null && kmeansLabels) {
      const selected = selectedKmeansIds.value
      for (let i = 0; i < kmeansLabels.length; i++) {
        if (!selected.has(kmeansLabels[i]!)) rgba[i * 4 + 3] = 0
      }
    }
    return rgba
  }

  const recomputeOverlay = () => {
    // Comparison overlay takes priority over UMAP/KMeans.
    if (comparisonOverlay.value) {
      overlayData.value = comparisonOverlay.value
      return
    }
    // Overlays are mutually exclusive, so at most one is non-null here.
    if (umapVisible.value) overlayData.value = computeUmapOverlay()
    else if (kmeansVisible.value) overlayData.value = computeKmeansOverlay()
    else overlayData.value = null
  }

  /**
   * Set a custom comparison overlay (region A/B highlight) that takes
   * priority over UMAP/KMeans. Pass null to clear and restore the previous
   * overlay mode.
   */
  function setComparisonOverlay(rgba: Uint8ClampedArray | null) {
    comparisonOverlay.value = rgba
    recomputeOverlay()
  }

  /**
   * Run KMeans locally over the UMAP raster with a user-chosen k, cache the
   * resulting labels + rendered RGB, and show the KMeans overlay. Deterministic
   * (fixed seed): same k → same clusters. Re-running with a different k
   * replaces the previous result.
   */
  async function runKmeans(k: number): Promise<boolean> {
    const ok = await loadClusteringData()
    if (!ok || !umapRgb || !dims) return false
    kmeansComputing.value = true
    try {
      const result = await computeKmeansFromUmap(umapRgb, dims.height, dims.width, k)
      kmeansRgb = result.rgb
      kmeansLabels = result.labels
      kmeansClusters.value = deriveKmeansClusters(result.labels)
      kmeansLabelsAvailable.value = true
      selectedKmeansIds.value = null // default: show all clusters
      kmeansK.value = k
      // Show the result (mutually exclusive with UMAP).
      kmeansVisible.value = true
      umapVisible.value = false
      recomputeOverlay()
      return true
    } catch (e) {
      console.error('[useOverlayData] local kmeans failed:', e)
      overlayError.value = e instanceof Error ? e.message : String(e)
      return false
    } finally {
      kmeansComputing.value = false
    }
  }

  const toggleOverlay = async (kind: OverlayKind) => {
    const visible = kind === 'umap' ? umapVisible : kmeansVisible
    const other = kind === 'umap' ? kmeansVisible : umapVisible
    if (!visible.value) {
      // Load first; only flip visibility on success so a failed load doesn't
      // leave the overlay "on" with nothing to draw.
      const ok = await loadClusteringData()
      if (!ok) return
      visible.value = true
      // Mutually exclusive: opening one overlay closes the other.
      other.value = false
    } else {
      visible.value = false
    }
    recomputeOverlay()
  }

  /** Retry after a failed clustering load. Re-reads the zarr without
   *  clearing the cache, so a transient error doesn't blank the overlays. */
  const retryClustering = async () => {
    overlayError.value = null
    await loadClusteringData()
    recomputeOverlay()
  }

  // Recompute only the affected overlay when its opacity changes.
  watch(umapAlpha, () => {
    if (umapVisible.value && umapRgb) recomputeOverlay()
  })
  watch(kmeansAlpha, () => {
    if (kmeansVisible.value && kmeansRgb) recomputeOverlay()
  })

  // Recompute the KMeans overlay when the cluster selection changes. Deep
  // watch: the ref holds a Set whose membership is mutated in place.
  watch(selectedKmeansIds, () => {
    if (kmeansVisible.value && kmeansRgb && kmeansLabels) recomputeOverlay()
  }, { deep: true })

  // Recompute overlays once BOTH the raster data and the ion dimensions are
  // available, whichever arrives last (probe can beat the ion image).
  watch([ionRows, ionCols, clusteringReady], () => {
    if (!ionRows.value || !ionCols.value) return
    if (umapVisible.value && !umapRgb) return
    if (kmeansVisible.value && !kmeansRgb) return
    if (umapVisible.value || kmeansVisible.value) recomputeOverlay()
  })

  // Page-entry probe: once per run, only for continuous storage.
  watch([runId, storageMode], ([id, mode]) => {
    if (id && mode === 'continuous') probeExisting()
  }, { immediate: true })

  // Invalidate the cache when the run changes (same component, new result).
  watch(runId, () => {
    clearCache()
    overlayError.value = null
    overlayData.value = null
    umapVisible.value = false
    kmeansVisible.value = false
    clusteringCreating.value = false
    clusteringComputing.value = false
    clusteringRefreshing.value = false
  })

  // Release the clustering zarr store + cached rasters on unmount.
  onBeforeUnmount(() => {
    clearCache()
    overlayData.value = null
  })

  /** Export stub: selected cluster ids + H×W 0/1 mask. null = no filter
   *  (all clusters). This is the contract for the backend export API. */
  function getKmeansSelection(): { labels: number[]; mask: Uint8Array } | null {
    if (!kmeansLabels || !dims || selectedKmeansIds.value === null) return null
    const selected = selectedKmeansIds.value
    const mask = new Uint8Array(kmeansLabels.length)
    for (let i = 0; i < kmeansLabels.length; i++) {
      const r = kmeansRgb![i * 3]!
      const g = kmeansRgb![i * 3 + 1]!
      const b = kmeansRgb![i * 3 + 2]!
      if (r === 0 && g === 0 && b === 0) continue // background: never exported
      mask[i] = selected.has(kmeansLabels[i]!) ? 1 : 0
    }
    return { labels: [...selected].sort((a, b) => a - b), mask }
  }

  /** Current KMeans labels (Int32Array, -1 = background) or null if not run. */
  function getKmeansLabels(): Int32Array | null {
    return kmeansLabels
  }

  /** Dimensions of the cached KMeans/UMAP raster grid, or null if not loaded. */
  function getKmeansDims(): { width: number; height: number } | null {
    return dims ? { width: dims.width, height: dims.height } : null
  }

  /**
   * Export an RGB raster (H×W×3 uint8) as a scaled-up PNG download.
   * Background pixels (0,0,0) become transparent. Used by the UMAP/KMeans
   * export buttons so the user gets a clean image without the ion image.
   */
  function exportRgbPng(
    rgb: Uint8Array,
    width: number,
    height: number,
    filename: string,
  ) {
    const scale = 4 // upscale for a usable image (originals are small, e.g. 93×227)
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    // Build a 1:1 ImageData from the RGB raster, then drawImage upscaled.
    const src = document.createElement('canvas')
    src.width = width
    src.height = height
    const sctx = src.getContext('2d')!
    const imgData = sctx.createImageData(width, height)
    for (let i = 0; i < width * height; i++) {
      const r = rgb[i * 3]!
      const g = rgb[i * 3 + 1]!
      const b = rgb[i * 3 + 2]!
      imgData.data[i * 4] = r
      imgData.data[i * 4 + 1] = g
      imgData.data[i * 4 + 2] = b
      // Background (0,0,0) = transparent, everything else = opaque
      imgData.data[i * 4 + 3] = (r || g || b) ? 255 : 0
    }
    sctx.putImageData(imgData, 0, 0)
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height)

    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  /** Export the UMAP RGB image as a standalone PNG (no ion image background). */
  function exportUmapPng() {
    if (!umapRgb || !dims) return
    exportRgbPng(umapRgb, dims.width, dims.height, 'umap_image.png')
  }

  /** Export the KMeans RGB image as a standalone PNG (no ion image background). */
  function exportKmeansPng() {
    if (!kmeansRgb || !dims) return
    exportRgbPng(kmeansRgb, dims.width, dims.height, `kmeans_k${kmeansK.value ?? 0}.png`)
  }

  return {
    umapVisible,
    kmeansVisible,
    overlayData,
    overlayLoading,
    overlayError,
    /** True while the initial create-task POST is in flight. */
    clusteringCreating,
    /** True when the task exists but hasn't completed - show Refresh. */
    clusteringComputing,
    /** True once the clustering zarr is loaded - buttons become interactive. */
    clusteringReady,
    /** True while a refresh POST is in flight. */
    clusteringRefreshing,
    umapAlpha,
    kmeansAlpha,
    /** KMeans clusters (id + color + pixel count) for the picker UI. */
    kmeansClusters,
    /** False until a local KMeans run produced labels - show a hint instead of the picker. */
    kmeansLabelsAvailable,
    /** The k of the current KMeans result (null = never run). */
    kmeansK,
    /** True while a local KMeans computation is in flight. */
    kmeansComputing,
    /** Selected cluster ids (null = all); drives overlay + export mask. */
    selectedKmeansIds,
    toggleOverlay,
    recomputeOverlay,
    retryClustering,
    /** Run KMeans locally over the UMAP raster with a user-chosen k. */
    runKmeans,
    toggleKmeansCluster,
    selectAllKmeansClusters,
    clearKmeansClusters,
    getKmeansSelection,
    /** Current KMeans labels (Int32Array, -1 = background) or null. */
    getKmeansLabels,
    /** Dimensions of the cached KMeans/UMAP raster grid, or null. */
    getKmeansDims,
    /** Set/clear a comparison overlay (region A/B highlight) that overrides UMAP/KMeans. */
    setComparisonOverlay,
    /** Export the UMAP RGB image as a standalone PNG. */
    exportUmapPng,
    /** Export the KMeans RGB image as a standalone PNG. */
    exportKmeansPng,
    /** Opt-in enable: POST the (idempotent) clustering task. */
    createClusteringTask,
    /** Refresh button: re-POST and branch on clustering_status. */
    refreshClusteringStatus,
  }
}
