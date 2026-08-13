/**
 * Annotation CSV import + m/z matching composable.
 *
 * Wires {@link ../utils/csvAnnotation} (pure parsing/matching) to the live
 * result state: the shared m/z axis and raw mean spectrum exported by
 * {@link ./useZarrIonImage}. Matching re-runs reactively whenever the imported
 * rows, the spectrum, or the tolerance change.
 *
 * Selecting a matched row calls the injected `selectMzIndex(idx)` - the same
 * code path as clicking a spectrum peak - so the ion image refreshes and the
 * average-spectrum highlight moves automatically.
 */

import { computed, onUnmounted, ref, watch } from 'vue'
import {
  mzAxisRef,
  meanSpectrumRef,
  dataModeRef,
  polarityRef,
} from '@/features/workspace/results/composables/useZarrIonImage'
import {
  parseAnnotationCsv,
  matchAnnotations,
  normalizeResultPolarity,
  sortMatchedRows,
  countMatchStatuses,
  CsvParseError,
  type AnnotationRow,
  type MatchedAnnotationRow,
  type ToleranceMode,
  type AnnotationSortKey,
  type AnnotationSortDir,
} from '@/features/workspace/results/utils/csvAnnotation'
import { useToast } from '@/shared/composables/useToast'

export type AnnotationFilter = 'all' | 'matched' | 'unmatched'
export type { AnnotationSortKey, AnnotationSortDir }

export interface AnnotationCounts {
  total: number
  matched: number
  unmatched: number
  invalid: number
}

const EMPTY_COUNTS: AnnotationCounts = { total: 0, matched: 0, unmatched: 0, invalid: 0 }

/** A match result as delivered by the worker or the main-thread fallback. */
interface MatchResult {
  rows: MatchedAnnotationRow[]
  mzColumn: string
  statusCounts: AnnotationCounts
  /** Number of rows parsed from the CSV (before coarse polarity / m/z-range
   *  filtering), reported separately so the import toast doesn't under-count
   *  when rows are dropped by the filter. */
  importedTotal: number
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsText(file, 'utf-8')
  })
}

/**
 * @param selectMzIndex The result page's m/z-selection entry point (e.g.
 *   `onSpectrumClickByIndex` from useZarrIonImage). Invoked when the user
 *   clicks a matched annotation row.
 */
export function useAnnotationMatch(
  selectMzIndex: (idx: number) => void | Promise<void>,
) {
  const { showToast } = useToast()

  // ---- worker (off-main-thread parse + match for huge CSVs) ----
  // The worker owns the parsed rows after import; matching (the expensive
  // O(rows · log axis) step) runs there so the import spinner keeps animating
  // and tolerance/polarity/spectrum changes re-run off the main thread too.
  let worker: Worker | null = null
  let nextReqId = 0
  interface WorkerOut {
    id: number
    type: 'chunk' | 'result' | 'error'
    rows?: MatchedAnnotationRow[]
    mzColumn?: string
    statusCounts?: AnnotationCounts
    importedTotal?: number
    message?: string
  }
  const pending = new Map<
    number,
    {
      chunks: MatchedAnnotationRow[][]
      resolve: (v: MatchResult) => void
      reject: (e: Error) => void
    }
  >()
  function ensureWorker(): Worker {
    if (worker) return worker
    worker = new Worker(new URL('../utils/csvAnnotation.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const msg = e.data
      const p = pending.get(msg.id)
      if (!p) return
      if (msg.type === 'chunk' && msg.rows) {
        p.chunks.push(msg.rows)
        return
      }
      pending.delete(msg.id)
      if (msg.type === 'result') {
        const rows =
          p.chunks.length === 0 ? [] : p.chunks.length === 1 ? p.chunks[0]! : p.chunks.flat()
        p.resolve({
          rows,
          mzColumn: msg.mzColumn ?? '',
          statusCounts: msg.statusCounts ?? countMatchStatuses(rows),
          importedTotal: msg.importedTotal ?? rows.length,
        })
      } else if (msg.type === 'error') {
        p.reject(new Error(msg.message ?? 'unknown worker error'))
      }
    }
    worker.onerror = (e) => {
      for (const [, p] of pending) p.reject(new Error(e.message || 'worker crashed'))
      pending.clear()
      worker?.terminate()
      worker = null
    }
    return worker
  }

  /** Ship a request to the worker. Defensive-copies the axis/intensity
   *  buffers so the module-level reactive refs aren't hollowed out by the
   *  transfer. Returns worker's result rows + mz column name. */
  function postToWorker(
    req: { op: 'import'; text: string } | { op: 'rematch' },
    mzAxis: Float64Array | null,
    meanIntensity: Float32Array | null,
    tolerance: number,
    mode: ToleranceMode,
    polarity: 'positive' | 'negative' | null,
    sortKey?: 'name' | 'expMz' | 'massError' | 'avgIntensity',
    sortDir?: 'asc' | 'desc',
  ): Promise<MatchResult> {
    const w = ensureWorker()
    const id = ++nextReqId
    const axisCopy = mzAxis ? mzAxis.slice() : null
    const intensityCopy = meanIntensity ? meanIntensity.slice() : null
    return new Promise((resolve, reject) => {
      pending.set(id, { chunks: [], resolve, reject })
      w.postMessage(
        {
          id,
          ...req,
          mzAxis: axisCopy,
          meanIntensity: intensityCopy,
          tolerance,
          mode,
          coarse: { polarity },
          sortKey,
          sortDir,
        },
        [...(axisCopy ? [axisCopy.buffer] : []), ...(intensityCopy ? [intensityCopy.buffer] : [])],
      )
    })
  }

  /** Fallback synchronous path (worker unsupported). Runs the same parse +
   *  match on the main thread; kept so an obscure env can't brick the panel. */
  function runOnMain(
    op: 'import' | 'rematch',
    text: string | null,
    mzAxis: Float64Array | null,
    meanIntensity: Float32Array | null,
    tolerance: number,
    mode: ToleranceMode,
    polarity: 'positive' | 'negative' | null,
    sortKey?: AnnotationSortKey,
    sortDir?: AnnotationSortDir,
  ): MatchResult {
    let rows: AnnotationRow[]
    let mzColumn: string
    if (op === 'import') {
      const parsed = parseAnnotationCsv(text ?? '')
      cachedParsedRows = parsed.rows
      mzColumn = parsed.mzColumn
      rows = parsed.rows
    } else {
      // A CSV originally imported through the worker never populated
      // cachedParsedRows; re-parse from the retained text so a crashed worker
      // can still be recovered on the main thread.
      if (cachedParsedRows.length === 0 && cachedText) {
        const parsed = parseAnnotationCsv(cachedText)
        cachedParsedRows = parsed.rows
        cachedMzColumn = parsed.mzColumn
      }
      rows = cachedParsedRows
      mzColumn = cachedMzColumn
    }
    const matched = matchAnnotations(rows, mzAxis, meanIntensity, tolerance, mode, { polarity })
    return {
      rows: sortMatchedRows(matched, sortKey, sortDir),
      mzColumn,
      statusCounts: countMatchStatuses(matched),
      importedTotal: rows.length,
    }
  }

  // Main-thread cache for the fallback path (mirrors the worker's parsed state).
  let cachedParsedRows: AnnotationRow[] = []
  let cachedMzColumn = ''
  /** Raw CSV text retained so a crashed worker can be recovered by re-parsing
   *  on the main thread. Freed on clear(). */
  let cachedText: string | null = null

  // Terminate the worker on unmount: it holds the parsed rows (potentially
  // hundreds of thousands) and would otherwise leak both the thread and its
  // memory on every navigation away from the result page.
  onUnmounted(() => {
    worker?.terminate()
    worker = null
  })

  /** Tell the worker to drop its parsed rows so clearing the panel frees the
   *  (potentially hundreds of thousands of) rows it holds, not just the
   *  main-thread copy. Fire-and-forget: the worker posts no reply. */
  function clearWorker(): void {
    if (!worker) return
    worker.postMessage({ op: 'clear', id: ++nextReqId })
  }

  // ---- imported data ----
  const fileName = ref<string | null>(null)
  const parseError = ref<string | null>(null)
  /** True while a CSV is being read/parsed/matched. Drives the loading
   *  spinner in the panel - for huge files this takes several seconds. */
  const isImporting = ref(false)

  /** Yield one frame so the spinner can paint before the synchronous
   *  parse/match blocks the main thread. */
  const nextFrame = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )

  // ---- matching controls ----
  const tolMode = ref<ToleranceMode>('ppm')
  const tolValue = ref<number>(10)

  // When the tolerance mode switches, snap the value to a sensible default
  // for the new unit (10 ppm <-> 0.05 Da) so the user doesn't end up with
  // "10 Da" (impossibly wide) or "0.05 ppm" (impossibly tight).
  watch(tolMode, (mode, prev) => {
    if (mode === prev) return
    if (mode === 'ppm' && tolValue.value <= 1) tolValue.value = 10
    if (mode === 'Da' && tolValue.value > 1) tolValue.value = 0.05
  })

  // ---- table controls ----
  const search = ref('')
  const filter = ref<AnnotationFilter>('all')
  const sortKey = ref<AnnotationSortKey>('massError')
  const sortDir = ref<AnnotationSortDir>('asc')

  /** True when an average spectrum (continuous-mode m/z axis) is available. */
  const spectrumAvailable = computed(() => {
    const axis = mzAxisRef.value
    return !!axis && axis.length > 0 && dataModeRef.value === 'continuous'
  })

  /** Coarse polarity filter derived from the live result polarity. `null`
   *  disables the filter (no polarity known yet). */
  const coarsePolarity = computed<'positive' | 'negative' | null>(() =>
    normalizeResultPolarity(polarityRef.value),
  )

  /** Matched + coarse-filtered rows. Populated by the worker (import or
   *  rematch); NEVER recomputed on the main thread, so the O(rows · log axis)
   *  matching stays off the UI thread. */
  const matchedRows = ref<MatchedAnnotationRow[]>([])

  /** Counts shown in the filter badges. Populated by the worker (which already
   *  counts statuses while matching) or the main-thread fallback - never
   *  re-derived by iterating the potentially huge matched set on the UI thread,
   *  which would also proxy every row on first read. */
  const counts = ref<AnnotationCounts>(EMPTY_COUNTS)

  /** The sort key/dir the current `matchedRows` set was produced with. `null`
   *  until the first import/rematch lands. Compared against the live sortKey/
   *  sortDir so a result sorted with a stale key (user changed sort mid-import)
   *  is re-sorted instead of trusted. */
  const matchedSort = ref<{ key: AnnotationSortKey; dir: AnnotationSortDir } | null>(null)

  /** Re-run matching in the worker against already-parsed rows. No-op when
   *  nothing has been imported yet (a CSV that coarse-filtered down to zero
   *  rows still counts as imported). Safe to call rapidly; each call bumps a
   *  sequence so a slower, older result can't overwrite a newer one. */
  let rematchSeq = 0
  /** Set when a rematch is requested while an import is still in flight (the
   *  spectrum or result polarity resolved mid-import); importFile re-runs
   *  matching once the import lands so the table isn't left stale. */
  let pendingRematch = false
  async function rematch(): Promise<void> {
    if (!fileName.value) {
      if (isImporting.value) pendingRematch = true
      return
    }
    // No early return when the spectrum axis is missing: sorting and the
    // coarse polarity filter still apply to an all-`unmatched` result, so a
    // sort/polarity change made before the spectrum loads must still reach the
    // worker (its matchAnnotations marks every row `unmatched` on a null axis).
    const axis = mzAxisRef.value
    const seq = ++rematchSeq
    const reqKey = sortKey.value
    const reqDir = sortDir.value
    try {
      const res = await postToWorker(
        { op: 'rematch' },
        axis,
        meanSpectrumRef.value,
        tolValue.value,
        tolMode.value,
        coarsePolarity.value,
        reqKey,
        reqDir,
      )
      if (seq !== rematchSeq) return // superseded by a newer rematch
      matchedRows.value = res.rows
      counts.value = res.statusCounts
      matchedSort.value = { key: reqKey, dir: reqDir }
    } catch {
      if (seq !== rematchSeq) return
      // Worker path failed - fall back to main thread. Recover the parsed rows
      // from the main-thread cache, or re-parse from the retained CSV text when
      // the worker was the original importer. Only when we have neither do we
      // keep the current table rather than wiping it on a spurious trigger.
      if (cachedParsedRows.length > 0 || cachedText) {
        const fallback = runOnMain(
          'rematch',
          null,
          axis,
          meanSpectrumRef.value,
          tolValue.value,
          tolMode.value,
          coarsePolarity.value,
          reqKey,
          reqDir,
        )
        matchedRows.value = fallback.rows
        counts.value = fallback.statusCounts
        matchedSort.value = { key: reqKey, dir: reqDir }
      }
    }
  }

  // Re-run matching (off-thread) when the spectrum, tolerance, result
  // polarity, or sort key/dir resolves/changes. Each watcher triggers the same
  // debounced rematch path so the UI thread is never blocked - including the
  // sort, which the worker re-applies over the full matched set.
  let rematchTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleRematch(): void {
    if (rematchTimer) clearTimeout(rematchTimer)
    rematchTimer = setTimeout(() => {
      void rematch()
    }, 120)
  }
  watch(
    [mzAxisRef, meanSpectrumRef, tolValue, tolMode, coarsePolarity, sortKey, sortDir],
    scheduleRematch,
    { deep: false },
  )

  const filteredRows = computed<MatchedAnnotationRow[]>(() => {
    let rows = matchedRows.value
    if (filter.value !== 'all') {
      rows = rows.filter((r) => r.matchStatus === filter.value)
    }
    const q = search.value.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.candidates.some((c) => c.toLowerCase().includes(q)) ||
          (r.formulaIon ?? '').toLowerCase().includes(q) ||
          (r.ionType ?? '').toLowerCase().includes(q) ||
          (Number.isFinite(r.expMz) ? r.expMz.toString() : '').includes(q),
      )
    }
    // The full (unfiltered) set is returned as-is: its order is owned by the
    // worker. When the sort key/dir changes, the debounced rematch below
    // re-sorts off-thread; re-sorting the full set here would block the UI -
    // exactly what the worker exists to avoid.
    if (rows === matchedRows.value) {
      return rows
    }
    // Filter/search narrowed the set. Re-sort the (smaller) subset only when
    // its order is stale relative to the live sort key/dir.
    if (
      matchedSort.value?.key === sortKey.value &&
      matchedSort.value?.dir === sortDir.value
    ) {
      return rows
    }
    return sortMatchedRows(rows, sortKey.value, sortDir.value)
  })

  async function importFile(file: File): Promise<void> {
    parseError.value = null
    isImporting.value = true
    // Wait a frame so `isImporting=true` paints before the (synchronous) read
    // starts; the heavy parse + match itself runs in the worker.
    await nextFrame()
    try {
      const text = await readFileAsText(file)
      const reqKey = sortKey.value
      const reqDir = sortDir.value
      let res: MatchResult
      try {
        res = await postToWorker(
          { op: 'import', text },
          mzAxisRef.value,
          meanSpectrumRef.value,
          tolValue.value,
          tolMode.value,
          coarsePolarity.value,
          reqKey,
          reqDir,
        )
      } catch {
        // Worker path failed - fall back to synchronous main-thread parse.
        res = runOnMain(
          'import',
          text,
          mzAxisRef.value,
          meanSpectrumRef.value,
          tolValue.value,
          tolMode.value,
          coarsePolarity.value,
          reqKey,
          reqDir,
        )
      }
      matchedRows.value = res.rows
      counts.value = res.statusCounts
      matchedSort.value = { key: reqKey, dir: reqDir }
      fileName.value = file.name
      cachedText = text
      // A rematch was requested while this import was in flight (spectrum or
      // polarity resolved mid-import, when the import had already captured the
      // then-current inputs). Re-run it now that the rows are in place.
      if (pendingRematch) {
        pendingRematch = false
        scheduleRematch()
      }
      const dropped = res.importedTotal - res.statusCounts.total
      const droppedNote = dropped > 0 ? ` (${dropped} filtered out)` : ''
      if (spectrumAvailable.value) {
        showToast(
          `Imported ${res.importedTotal} rows from "${file.name}" (${res.mzColumn}) - ${res.statusCounts.matched} matched${droppedNote}.`,
          'success',
        )
      } else {
        showToast(
          `Imported ${res.importedTotal} rows${droppedNote}. Matching re-runs once the average spectrum loads.`,
          'info',
        )
      }
      // Keep the spinner on screen while the (cheap) first render of the
      // virtual table mounts, then clear isImporting.
      await nextFrame()
      void filteredRows.value
      await nextFrame()
      await nextFrame()
      await nextFrame()
    } catch (e) {
      matchedRows.value = []
      counts.value = EMPTY_COUNTS
      fileName.value = null
      cachedText = null
      pendingRematch = false
      const msg =
        e instanceof CsvParseError
          ? e.message
          : `Failed to read CSV: ${e instanceof Error ? e.message : String(e)}`
      parseError.value = msg
      showToast(msg, 'error')
    } finally {
      isImporting.value = false
    }
  }

  function clear(): void {
    matchedRows.value = []
    counts.value = EMPTY_COUNTS
    cachedParsedRows = []
    cachedMzColumn = ''
    cachedText = null
    pendingRematch = false
    fileName.value = null
    parseError.value = null
    isImporting.value = false
    clearWorker()
  }

  /** Click a table row: only matched rows select an m/z. */
  function selectRow(row: MatchedAnnotationRow): void {
    if (row.matchStatus !== 'matched' || row.matchedIndex == null) return
    void selectMzIndex(row.matchedIndex)
  }

  function toggleSort(key: AnnotationSortKey): void {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDir.value = 'asc'
    }
  }

  return {
    // data
    fileName,
    parseError,
    isImporting,
    // matching controls
    tolMode,
    tolValue,
    spectrumAvailable,
    matchedRows,
    counts,
    // table controls
    search,
    filter,
    sortKey,
    sortDir,
    filteredRows,
    // actions
    importFile,
    clear,
    selectRow,
    toggleSort,
  }
}
