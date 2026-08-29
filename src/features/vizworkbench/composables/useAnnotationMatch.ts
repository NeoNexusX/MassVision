/**
 * Annotation CSV import + m/z matching composable.
 *
 * Wires {@link ../utils/csvAnnotation} (pure parsing/matching) to the live
 * result state: the shared m/z axis and raw mean spectrum exported by
 * {@link ./useZarrIonImage}. Parse + match + collapse + sort run in a Web
 * Worker (see csvAnnotation.worker.ts); a debounced rematch re-runs them
 * whenever the spectrum, tolerance, result polarity, or sort changes.
 *
 * Selecting a matched row calls the injected `selectMzIndex(idx)` - the same
 * code path as clicking a spectrum peak - so the ion image refreshes and the
 * average-spectrum highlight moves automatically.
 */

import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  mzAxisRef,
  meanSpectrumRef,
  dataModeRef,
  polarityRef,
} from '@/features/vizworkbench/composables/useZarrIonImage'
import {
  parseAnnotationCsv,
  buildAnnotationExportCsv,
  normalizeResultPolarity,
  runMatchPipeline,
  sortMatchedRows,
  CsvParseError,
  type AnnotationRow,
  type MatchedAnnotationRow,
  type ToleranceMode,
  type AnnotationSortKey,
  type AnnotationSortDir,
  type MatchStatusCounts,
  type MatchInputs,
} from '@/features/vizworkbench/utils/csvAnnotation'
import { useToast } from '@/shared/composables/useToast'

export type AnnotationFilter = 'all' | 'matched' | 'unmatched'
export type { AnnotationSortKey, AnnotationSortDir }

/** Badge counts over the collapsed row set. Alias of the pipeline's
 *  MatchStatusCounts so there is exactly one definition of this shape. */
export type AnnotationCounts = MatchStatusCounts

const EMPTY_COUNTS: AnnotationCounts = { total: 0, matched: 0, unmatched: 0, invalid: 0 }

/** A match result as delivered by the worker or the main-thread fallback. */
interface MatchResult {
  rows: MatchedAnnotationRow[]
  /** Sort-only worker response: row ids in their new order instead of full
   *  row objects. The caller reorders the rows it already holds by id (see
   *  permuteRowsById); `rows` is empty in that case. */
  permIds?: Int32Array
  mzColumn: string
  statusCounts: AnnotationCounts
  /** Number of rows parsed from the CSV (before coarse polarity / m/z-range
   *  filtering and row collapsing), reported separately so the import toast
   *  doesn't under-count when rows are dropped. */
  importedTotal: number
  /** Input rows dropped by the coarse polarity / m/z-range pre-filter. */
  coarseFiltered: number
  /** Valid rows folded into another row sharing the same experimental m/z
   *  (isobars). Wording is "collapsed onto m/z peaks", so report this only
   *  when it is > 0. */
  collapsed: number
  /** Distinct invalid rows dropped as exact duplicates. These never touched an
   *  m/z, so label them separately ("duplicates dropped") in the toast rather
   *  than calling them peak-collapses. */
  droppedDuplicates: number
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
export function useAnnotationMatch(selectMzIndex: (idx: number) => void | Promise<void>) {
  const { showToast } = useToast()

  // ---- worker (off-main-thread parse + match for huge CSVs) ----
  // The worker owns the parsed rows after import; matching (the expensive
  // O(rows · log axis) step) runs there so the import spinner keeps animating
  // and tolerance/polarity/spectrum changes re-run off the main thread too.
  let worker: Worker | null = null
  /** Latched on the first worker error. Without this, an environment where the
   *  worker script can't load (CSP, stale chunk after a deploy) would make
   *  EVERY rematch construct two doomed workers before the main-thread
   *  fallback; a data-induced crash (e.g. OOM on a huge CSV) would likewise
   *  loop crash -> re-import -> crash. Once broken, requests go straight to
   *  the synchronous fallback. */
  let workerBroken = false
  /** Set in onUnmounted. Rejections caused by teardown (pending entries are
   *  rejected there) make continuations bail out instead of recovering /
   *  toasting for a panel that no longer exists. Declared with the worker
   *  state so postToWorker/rematch/importFile can read it. */
  let disposed = false
  let nextReqId = 0
  interface WorkerOut {
    id: number
    type: 'chunk' | 'perm' | 'result' | 'error'
    rows?: MatchedAnnotationRow[]
    ids?: Int32Array
    mzColumn?: string
    statusCounts?: AnnotationCounts
    importedTotal?: number
    coarseFiltered?: number
    collapsed?: number
    droppedDuplicates?: number
    message?: string
  }
  const pending = new Map<
    number,
    {
      chunks: MatchedAnnotationRow[][]
      /** Set when the worker answered with a sort-only id permutation. */
      perm?: Int32Array
      /** When set, returning true means the request was superseded: its chunk
       *  payloads are dropped instead of accumulated (they would be discarded
       *  on receipt anyway). */
      dropChunks?: () => boolean
      resolve: (v: MatchResult) => void
      reject: (e: Error) => void
    }
  >()

  // Identity of the spectrum arrays last shipped to the worker. The worker
  // caches them, so a rematch that only changes tolerance/polarity/sort sends
  // `undefined` (reuse) instead of copying + transferring megabytes per call.
  // `undefined` = nothing sent yet (forces a full send on first use).
  let sentAxis: Float64Array | null | undefined
  let sentIntensity: Float32Array | null | undefined

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
        // Superseded request: drop the payload instead of accumulating (and
        // later flat()ing) rows the caller will discard. The message itself
        // was already deserialized before this handler ran, and the worker
        // (single-threaded FIFO) can't be preempted mid-stream - this just
        // stops the retention/copy cost.
        if (!p.dropChunks?.()) p.chunks.push(msg.rows)
        return
      }
      if (msg.type === 'perm' && msg.ids) {
        // Sort-only answer: an Int32Array of row ids. Cheap to keep even for
        // a superseded request, but drop it anyway for symmetry with chunks.
        if (!p.dropChunks?.()) p.perm = msg.ids
        return
      }
      pending.delete(msg.id)
      if (msg.type === 'result') {
        const rows =
          p.chunks.length === 0 ? [] : p.chunks.length === 1 ? p.chunks[0]! : p.chunks.flat()
        p.resolve({
          rows,
          permIds: p.perm,
          mzColumn: msg.mzColumn ?? '',
          statusCounts: msg.statusCounts ?? EMPTY_COUNTS,
          importedTotal: msg.importedTotal ?? rows.length,
          coarseFiltered: msg.coarseFiltered ?? 0,
          collapsed: msg.collapsed ?? 0,
          droppedDuplicates: msg.droppedDuplicates ?? 0,
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
      workerBroken = true
      // The sent-identity tracking is moot once the latch is set (no further
      // worker requests go out); reset it for completeness.
      sentAxis = undefined
      sentIntensity = undefined
    }
    return worker
  }

  /** Ship a request to the worker. Spectrum arrays are only copied +
   *  transferred when their identity changed since the last request (the
   *  worker caches them); the copies - never the module-level refs' buffers -
   *  are transferred, so the reactive state is not hollowed out. */
  function postToWorker(
    req: { op: 'import'; text: string } | { op: 'rematch'; full?: boolean },
    inputs: MatchInputs,
    dropChunks?: () => boolean,
  ): Promise<MatchResult> {
    if (workerBroken || disposed) {
      return Promise.reject(new Error('annotation worker unavailable'))
    }
    const w = ensureWorker()
    const id = ++nextReqId
    const mzAxis = inputs.mzAxis ?? null
    const meanIntensity = inputs.meanIntensity ?? null
    const axisUnchanged = mzAxis === sentAxis
    const intensityUnchanged = meanIntensity === sentIntensity
    const axisCopy = axisUnchanged ? undefined : mzAxis ? mzAxis.slice() : null
    const intensityCopy = intensityUnchanged
      ? undefined
      : meanIntensity
        ? meanIntensity.slice()
        : null
    return new Promise((resolve, reject) => {
      pending.set(id, { chunks: [], dropChunks, resolve, reject })
      try {
        w.postMessage(
          {
            id,
            ...req,
            inputs: { ...inputs, mzAxis: axisCopy, meanIntensity: intensityCopy },
          },
          [
            ...(axisCopy ? [axisCopy.buffer] : []),
            ...(intensityCopy ? [intensityCopy.buffer] : []),
          ],
        )
      } catch (e) {
        // A throwing postMessage (e.g. DataCloneError under memory pressure)
        // must not leave a zombie pending entry nor mark the arrays as sent -
        // the worker never received them, so the next request has to re-ship.
        pending.delete(id)
        reject(e instanceof Error ? e : new Error(String(e)))
        return
      }
      sentAxis = mzAxis
      sentIntensity = meanIntensity
    })
  }

  /** Fallback synchronous path (worker unsupported). Runs the same pipeline
   *  on the main thread; kept so an obscure env can't brick the panel. */
  function runOnMain(
    op: 'import' | 'rematch',
    text: string | null,
    inputs: MatchInputs,
  ): MatchResult {
    let rows: AnnotationRow[]
    if (op === 'import') {
      const parsed = parseAnnotationCsv(text ?? '')
      cachedParsedRows = parsed.rows
      cachedMzColumn = parsed.mzColumn
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
    }
    const res = runMatchPipeline(rows, inputs)
    return {
      rows: res.rows,
      mzColumn: cachedMzColumn,
      statusCounts: res.statusCounts,
      importedTotal: rows.length,
      coarseFiltered: res.coarseFiltered,
      collapsed: res.collapsed,
      droppedDuplicates: res.droppedDuplicates,
    }
  }

  // Main-thread cache for the fallback path (mirrors the worker's parsed
  // state). Only populated when the main thread actually parsed (fallback
  // import or crash recovery); a worker-side import leaves these empty so they
  // can never go stale against the worker's newer data.
  let cachedParsedRows: AnnotationRow[] = []
  let cachedMzColumn = ''
  /** Raw CSV text retained so a crashed worker can be recovered by re-parsing
   *  (or re-importing into a fresh worker). Freed on clear(). */
  let cachedText: string | null = null

  // Terminate the worker and cancel pending timers on unmount: the worker
  // holds the parsed rows (potentially hundreds of thousands) and a trailing
  // debounced rematch would otherwise spawn a fresh worker after teardown.
  onUnmounted(() => {
    disposed = true
    if (rematchTimer) clearTimeout(rematchTimer)
    if (searchTimer) clearTimeout(searchTimer)
    // Reject in-flight requests before terminating: their messages will never
    // arrive once the worker is gone, so without this the promises (and the
    // import/rematch continuations holding the CSV text) never settle. The
    // continuations' catch paths check `disposed` and bail out quietly.
    for (const [, p] of pending) p.reject(new Error('annotation panel unmounted'))
    pending.clear()
    worker?.terminate()
    worker = null
  })

  /** Tell the worker to drop its parsed rows so clearing the panel frees the
   *  (potentially hundreds of thousands of) rows it holds, not just the
   *  main-thread copy. Fire-and-forget: the worker posts no reply. Also drops
   *  the worker's spectrum cache, so our sent-identity tracking resets too. */
  function clearWorker(): void {
    if (!worker) return
    worker.postMessage({ op: 'clear', id: ++nextReqId })
    sentAxis = undefined
    sentIntensity = undefined
  }

  // ---- imported data ----
  const fileName = ref<string | null>(null)
  const parseError = ref<string | null>(null)
  /** True while a CSV is being read/parsed/matched. Drives the loading
   *  spinner in the panel - for huge files this takes several seconds. */
  const isImporting = ref(false)

  /** Yield so the spinner can paint before synchronous work blocks the main
   *  thread. rAF never fires in a hidden tab, so a short timeout wins the race
   *  there - otherwise an import started while the tab is occluded would hang
   *  with isImporting stuck on. */
  const nextFrame = () =>
    new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 50)
      requestAnimationFrame(() => {
        clearTimeout(t)
        resolve()
      })
    })

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
  /** Debounced, normalized query that `filteredRows` actually filters on. The
   *  raw `search` ref updates per keystroke; running the full-row scan
   *  (lowercasing name + every candidate + formula + adduct per row) on each
   *  one would re-block the UI thread the worker was meant to free. */
  const searchQuery = ref('')
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  watch(search, (v) => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchQuery.value = v.trim().toLowerCase()
    }, 200)
  })
  const filter = ref<AnnotationFilter>('matched')
  /** Adduct / ion-type dropdown filter ('' = all). Intersects with the status
   *  filter and the search query. Matches the representative's own `ionType`
   *  OR any archived `altAdducts` from merged isobars, so a compound whose
   *  adduct was folded away stays selectable. */
  const filterAdduct = ref('')
  /** Molecular-formula dropdown filter ('' = all). Mirrors {@link filterAdduct}
   *  but for `formulaIon` / `altFormulas`. */
  const filterFormula = ref('')
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
   *  matching stays off the UI thread. shallowRef: the rows are immutable
   *  worker snapshots replaced wholesale, so deep reactivity would only proxy
   *  hundreds of thousands of objects on first read for no benefit. */
  const matchedRows = shallowRef<MatchedAnnotationRow[]>([])

  /** Distinct adduct values in the current (collapsed) matched set, for the
   *  dropdown. Sorted so the list is stable across re-renders. */
  const adductOptions = computed<string[]>(() => {
    const set = new Set<string>()
    for (const r of matchedRows.value) {
      if (r.ionType) set.add(r.ionType)
      for (const a of r.altAdducts) set.add(a)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  })

  /** Distinct molecular-formula values in the current matched set (see
   *  {@link adductOptions}). */
  const formulaOptions = computed<string[]>(() => {
    const set = new Set<string>()
    for (const r of matchedRows.value) {
      if (r.formulaIon) set.add(r.formulaIon)
      for (const f of r.altFormulas) set.add(f)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  })

  /** Counts shown in the filter badges. Populated by the worker (which already
   *  counts statuses while matching) or the main-thread fallback - never
   *  re-derived by iterating the potentially huge matched set on the UI thread. */
  const counts = ref<AnnotationCounts>(EMPTY_COUNTS)

  /** Rows dropped by the coarse polarity / m/z-range pre-filter for the
   *  CURRENT row set. Updated on every applied result (import AND rematch),
   *  so a spectrum/polarity that resolves after import - silently dropping
   *  out-of-range rows on the debounced rematch - is still visible in the
   *  toolbar instead of looking like lost data. */
  const coarseFiltered = ref(0)

  /** The sort key/dir the current `matchedRows` set was produced with. `null`
   *  until the first import/rematch lands. Compared against the live sortKey/
   *  sortDir so a result sorted with a stale key (user changed sort mid-import)
   *  is re-sorted instead of trusted. */
  const matchedSort = ref<{ key: AnnotationSortKey; dir: AnnotationSortDir } | null>(null)

  /** Apply a match result to the reactive state. */
  function applyResult(res: MatchResult, key: AnnotationSortKey, dir: AnnotationSortDir): void {
    matchedRows.value = res.rows
    counts.value = res.statusCounts
    coarseFiltered.value = res.coarseFiltered
    matchedSort.value = { key, dir }
  }

  /** Reorder the currently held rows by a worker-sent id permutation. Returns
   *  null when the held set doesn't line up with the permutation (length
   *  mismatch or an unknown id) - e.g. an intervening full stream was dropped
   *  as superseded, leaving a different row set on screen. */
  function permuteRowsById(
    current: MatchedAnnotationRow[],
    ids: Int32Array,
  ): MatchedAnnotationRow[] | null {
    if (ids.length !== current.length) return null
    const byId = new Map<number, MatchedAnnotationRow>()
    for (const r of current) byId.set(r.id, r)
    const out = new Array<MatchedAnnotationRow>(ids.length)
    for (let i = 0; i < ids.length; i++) {
      const r = byId.get(ids[i]!)
      if (!r) return null
      out[i] = r
    }
    return out
  }

  /** Snapshot every input a match run needs, in one place. The same object is
   *  handed to the worker and (on failure) the main-thread fallback, so the
   *  two paths can never drift on what was requested. Adding a match parameter
   *  means adding one field here and in {@link MatchInputs} - no call-site
   *  threading. */
  function captureInputs(): MatchInputs {
    return {
      mzAxis: mzAxisRef.value,
      meanIntensity: meanSpectrumRef.value,
      tolerance: tolValue.value,
      mode: tolMode.value,
      coarse: { polarity: coarsePolarity.value },
      sortKey: sortKey.value,
      sortDir: sortDir.value,
    }
  }

  /** Re-run matching in the worker against already-parsed rows. No-op when
   *  nothing has been imported yet (a CSV that coarse-filtered down to zero
   *  rows still counts as imported). Safe to call rapidly; each call bumps a
   *  sequence so a slower, older result can't overwrite a newer one. */
  let rematchSeq = 0
  /** Bumped on every import start / clear / import failure: invalidates any
   *  in-flight rematch (its inputs - and for clear, its whole dataset - are
   *  stale by the time it lands). */
  let importSeq = 0
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
    const inputs = captureInputs()
    const seq = ++rematchSeq
    const importSnapshot = importSeq
    const reqKey = inputs.sortKey!
    const reqDir = inputs.sortDir!
    /** A newer rematch/import/clear superseded this one - drop the result.
     *  `disposed` covers rejection-by-unmount (pending entries are rejected
     *  in onUnmounted): the panel is gone, so bail before any recovery. */
    const stale = () => disposed || seq !== rematchSeq || importSnapshot !== importSeq
    try {
      let res = await postToWorker({ op: 'rematch' }, inputs, stale)
      if (stale()) return
      if (res.permIds) {
        // Sort-only answer: reorder the rows we already hold by id.
        const reordered = permuteRowsById(matchedRows.value, res.permIds)
        if (reordered) {
          applyResult({ ...res, rows: reordered }, reqKey, reqDir)
          return
        }
        // The held row set doesn't line up with the worker's (an intervening
        // full stream was dropped as superseded): re-request the rows in
        // full. One extra roundtrip on a rare path.
        res = await postToWorker({ op: 'rematch', full: true }, inputs, stale)
        if (stale()) return
      }
      applyResult(res, reqKey, reqDir)
    } catch {
      if (stale()) return
      // Worker path failed. If it lost the parsed rows (crashed & respawned
      // empty), restore them by re-importing the retained CSV text into the
      // worker - otherwise EVERY later control change would fall into the
      // synchronous main-thread path and freeze the UI for seconds. Skipped
      // once the worker is latched broken (a fresh worker would fail the same
      // way).
      if (cachedText && !workerBroken) {
        try {
          const res = await postToWorker({ op: 'import', text: cachedText }, inputs, stale)
          if (stale()) return
          applyResult(res, reqKey, reqDir)
          return
        } catch {
          if (stale()) return
          // fall through to the main-thread fallback
        }
      }
      // Main-thread fallback. Recover the parsed rows from the main-thread
      // cache, or re-parse from the retained CSV text when the worker was the
      // original importer. Only when we have neither do we keep the current
      // table rather than wiping it on a spurious trigger.
      if (cachedParsedRows.length > 0 || cachedText) {
        if (stale()) return
        // This too can throw (e.g. allocation failure on a huge CSV); without
        // a catch it would escape `void rematch()` as an unhandled rejection,
        // leaving stale rows on screen with no signal.
        try {
          const fallback = runOnMain('rematch', null, inputs)
          applyResult(fallback, reqKey, reqDir)
        } catch (e) {
          if (stale()) return
          showToast(
            `Re-matching annotations failed: ${e instanceof Error ? e.message : String(e)}`,
            'error',
          )
        }
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
    if (filterAdduct.value) {
      rows = rows.filter(
        (r) => r.ionType === filterAdduct.value || r.altAdducts.includes(filterAdduct.value),
      )
    }
    if (filterFormula.value) {
      rows = rows.filter(
        (r) => r.formulaIon === filterFormula.value || r.altFormulas.includes(filterFormula.value),
      )
    }
    const q = searchQuery.value
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.candidates.some((c) => c.toLowerCase().includes(q)) ||
          (r.formulaIon ?? '').toLowerCase().includes(q) ||
          (r.ionType ?? '').toLowerCase().includes(q) ||
          // Isobars merged onto this representative left their formula/adduct in
          // `altFormulas`/`altAdducts`; search those too or those compounds
          // become unfindable by their own formula after collapse.
          (r.altFormulas ?? []).some((f) => f.toLowerCase().includes(q)) ||
          (r.altAdducts ?? []).some((a) => a.toLowerCase().includes(q)) ||
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
    if (matchedSort.value?.key === sortKey.value && matchedSort.value?.dir === sortDir.value) {
      return rows
    }
    return sortMatchedRows(rows, sortKey.value, sortDir.value)
  })

  async function importFile(file: File): Promise<void> {
    parseError.value = null
    // A new file invalidates adduct/formula values picked for the old one.
    filterAdduct.value = ''
    filterFormula.value = ''
    isImporting.value = true
    // Invalidate any in-flight rematch against the previous file: its result
    // must not land on top of this import (or after a mid-import clear()).
    const myImport = ++importSeq
    rematchSeq++
    // Wait a frame so `isImporting=true` paints before the (synchronous) read
    // starts; the heavy parse + match itself runs in the worker.
    await nextFrame()
    try {
      const text = await readFileAsText(file)
      const inputs = captureInputs()
      const reqKey = inputs.sortKey!
      const reqDir = inputs.sortDir!
      let res: MatchResult
      try {
        res = await postToWorker(
          { op: 'import', text },
          inputs,
          // A clear()/newer import supersedes this one: drop its chunks as they
          // stream in instead of buffering the whole discarded result.
          () => myImport !== importSeq,
        )
        // The worker now owns the parsed rows; the main-thread cache stays
        // empty so a later crash recovery re-parses cachedText instead of
        // trusting rows from some earlier fallback import of another file.
        cachedParsedRows = []
        cachedMzColumn = ''
      } catch {
        // Stale check BEFORE the fallback: runOnMain('import') writes the
        // main-thread parse cache, so a superseded import must not reach it -
        // otherwise its rows would poison every later main-thread rematch
        // (the rematch path trusts a non-empty cache over re-parsing
        // cachedText, which by then belongs to the NEWER file). `disposed`
        // covers rejection-by-unmount: the outer catch would try to recover
        // (and toast) for a panel that no longer exists.
        if (disposed || myImport !== importSeq) return
        // Worker path failed - fall back to synchronous main-thread parse.
        res = runOnMain('import', text, inputs)
      }
      // clear() ran while this import was in flight: the worker has already
      // been cleared (FIFO: this import, then the clear), so drop the result
      // instead of resurrecting state the user asked to discard.
      if (myImport !== importSeq) return
      applyResult(res, reqKey, reqDir)
      fileName.value = file.name
      cachedText = text
      // A rematch was requested while this import was in flight (spectrum or
      // polarity resolved mid-import, when the import had already captured the
      // then-current inputs). Re-run it now that the rows are in place.
      if (pendingRematch) {
        pendingRematch = false
        scheduleRematch()
      }
      const collapsedNote = res.collapsed > 0 ? ` (${res.collapsed} collapsed onto m/z peaks)` : ''
      const dupNote =
        res.droppedDuplicates > 0 ? ` (${res.droppedDuplicates} duplicate rows dropped)` : ''
      const filteredNote = res.coarseFiltered > 0 ? ` (${res.coarseFiltered} filtered out)` : ''
      if (spectrumAvailable.value) {
        showToast(
          `Imported ${res.importedTotal} rows from "${file.name}" (${res.mzColumn}) - ${res.statusCounts.matched} matched${collapsedNote}${dupNote}${filteredNote}.`,
          'success',
        )
      } else {
        showToast(
          `Imported ${res.importedTotal} rows${collapsedNote}${dupNote}${filteredNote}. Matching re-runs once the average spectrum loads.`,
          'info',
        )
      }
      // Keep the spinner on screen while the (cheap) first render of the
      // virtual table mounts, then clear isImporting.
      await nextFrame()
    } catch (e) {
      // Rejected because the panel unmounted mid-import - nothing to report.
      if (disposed) return
      // Invalidate any rematch still in flight against the previous file: this
      // failure wiped the state it would otherwise resurrect.
      rematchSeq++
      matchedRows.value = []
      counts.value = EMPTY_COUNTS
      coarseFiltered.value = 0
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
    // Invalidate in-flight imports/rematches FIRST: their continuations check
    // these sequences and must discard results instead of resurrecting the
    // cleared dataset (the worker drops its own copy via clearWorker).
    importSeq++
    rematchSeq++
    matchedRows.value = []
    counts.value = EMPTY_COUNTS
    coarseFiltered.value = 0
    filterAdduct.value = ''
    filterFormula.value = ''
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

  /**
   * Download the currently matched rows as a CSV (name + exp. m/z + matched
   * m/z + mass difference + intensity). Rows follow the current sort order;
   * search text and the matched/unmatched filter chips do not narrow the
   * export - everything that matched goes out.
   */
  function exportMatchedCsv(): void {
    const rows = sortMatchedRows(
      matchedRows.value.filter((r) => r.matchStatus === 'matched'),
      sortKey.value,
      sortDir.value,
    )
    if (!rows.length) {
      showToast('No matched annotations to export.', 'info')
      return
    }
    const csv = '﻿' + buildAnnotationExportCsv(rows, tolMode.value)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const base = (fileName.value ?? 'annotations').replace(/\.csv$/i, '')
    link.href = url
    link.download = `${base}_matched_mz.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    showToast(`Exported ${rows.length} matched annotations.`, 'success')
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
    counts,
    coarseFiltered,
    // table controls
    search,
    filter,
    filterAdduct,
    filterFormula,
    adductOptions,
    formulaOptions,
    sortKey,
    sortDir,
    filteredRows,
    // actions
    importFile,
    clear,
    selectRow,
    exportMatchedCsv,
  }
}
