/**
 * Web Worker: owns the parsed annotation rows and runs matching off the main
 * thread. Designed for large CSVs (hundreds of thousands of rows) where a
 * synchronous main-thread parse+match blocks the UI for seconds.
 *
 * The worker keeps the parsed rows AND the last spectrum arrays in memory, so
 * a re-match (tolerance / polarity / sort changed) only needs a small request
 * instead of re-shipping the CSV or the m/z axis. The main thread sends
 * `mzAxis`/`meanIntensity` as `undefined` when they haven't changed identity
 * since the last request (structured clone preserves `undefined` properties),
 * as `null` when the spectrum is genuinely absent.
 *
 * Protocol:
 *   main -> worker:
 *     { op: 'import', id, text, inputs: MatchInputs }
 *     { op: 'rematch', id, inputs: MatchInputs, full? }
 *     { op: 'clear', id }                            // drop parsedRows (no reply)
 *   (`inputs.mzAxis`/`inputs.meanIntensity` arrive as `undefined` when
 *    unchanged since the last request - the worker reuses its cached copy)
 *   worker -> main:
 *     { id, type: 'chunk', rows }                   // one slice of the result
 *     { id, type: 'perm', ids }                     // sort-only result: row ids in
 *                                                   // the new order (transferable);
 *                                                   // main reorders the rows it holds
 *     { id, type: 'result', mzColumn, statusCounts, importedTotal, coarseFiltered, collapsed, droppedDuplicates }
 *     { id, type: 'error', message }
 *
 * The collapsed (pre-sort) pipeline result is cached alongside the inputs that
 * produced it, so a rematch that only changes the sort re-sorts the cache
 * instead of re-running the match + collapse over every row. When the row SET
 * the main thread holds is known to be identical (the previous response
 * streamed it in full), a sort-only rematch ships just an Int32Array of row
 * ids instead of re-cloning every row object - megabytes of structured-clone
 * deserialization saved per sort click on a huge CSV. The main thread
 * validates the ids against the rows it actually holds and falls back to a
 * `full: true` rematch if they don't line up (e.g. an intervening full stream
 * was dropped as superseded).
 *
 * `rows` is streamed back in `CHUNK_SIZE` slices rather than one giant
 * postMessage: a single 200k-object transfer would be deserialized on the main
 * thread in one synchronous burst and visibly freeze the UI (the import spinner
 * included). Chunking keeps each deserialization short so the browser can paint
 * between slices.
 */
import {
  parseAnnotationCsv,
  matchAndCollapse,
  sortMatchedRows,
  coarseFilterKey,
  type AnnotationRow,
  type MatchedAnnotationRow,
  type MatchInputs,
  type MatchAndCollapseResult,
} from './csvAnnotation'

interface BaseReq {
  id: number
  inputs: MatchInputs
}
interface ImportReq extends BaseReq {
  op: 'import'
  text: string
}
interface RematchReq extends BaseReq {
  op: 'rematch'
  /** Force a full row stream even for a sort-only change (used by the main
   *  thread when a permutation can't be applied to the rows it holds). */
  full?: boolean
}
interface ClearReq {
  op: 'clear'
  id: number
}
type Req = ImportReq | RematchReq | ClearReq

// Worker-owned state. Survives across rematch requests.
let parsedRows: AnnotationRow[] = []
let parsedMzColumn = ''
let lastAxis: Float64Array | null = null
let lastIntensity: Float32Array | null = null

/** Collapsed (pre-sort) pipeline result plus the inputs that produced it.
 *  A rematch whose match-relevant inputs are all unchanged (only the sort
 *  key/dir differs) re-sorts this cache instead of re-running the
 *  O(rows · log axis) match + collapse over every row.
 *  `coarseKey` is the canonical form of the WHOLE coarse filter
 *  ({@link coarseFilterKey}), so a filter field added to CoarseFilter later
 *  invalidates the cache automatically - no per-field registration here. */
let cachedCollapse: MatchAndCollapseResult | null = null
const cachedInputs = {
  axis: null as Float64Array | null,
  intensity: null as Float32Array | null,
  tolerance: NaN,
  mode: '' as MatchInputs['mode'] | '',
  coarseKey: null as string | null,
}

/** The collapse whose rows were last streamed to the main thread IN FULL
 *  (so it provably holds that exact row set). A sort-only rematch against
 *  the same collapse ships an id permutation instead of the rows. Reset on
 *  clear/import and updated by every full stream. */
let lastFullStream: MatchAndCollapseResult | null = null

/** Rows sent per postMessage. Small enough that deserializing one slice stays
 *  well under a frame budget on the main thread. */
const CHUNK_SIZE = 10000

self.onmessage = (e: MessageEvent<Req>) => {
  const req = e.data
  try {
    if (req.op === 'clear') {
      // clear: drop the parsed rows + spectrum so a cleared panel doesn't keep
      // them alive
      parsedRows = []
      parsedMzColumn = ''
      lastAxis = null
      lastIntensity = null
      cachedCollapse = null
      lastFullStream = null
      return
    }
    // import / rematch share the spectrum-cache update (undefined = unchanged,
    // reuse the worker's copy).
    const inputs = req.inputs
    if (inputs.mzAxis !== undefined) lastAxis = inputs.mzAxis
    if (inputs.meanIntensity !== undefined) lastIntensity = inputs.meanIntensity

    if (req.op === 'import') {
      const parsed = parseAnnotationCsv(req.text)
      parsedRows = parsed.rows
      parsedMzColumn = parsed.mzColumn
      cachedCollapse = null // new rows: any cached collapse is for another file
      lastFullStream = null
    } else if (!parsedRows.length) {
      // rematch against the kept parsedRows
      self.postMessage({ id: req.id, type: 'error', message: 'no parsed rows to re-match' })
      return
    }
    // Sort-only change? Re-sort the cached collapse instead of re-matching.
    const coarseKey = coarseFilterKey(inputs.coarse)
    const inputsUnchanged =
      cachedCollapse !== null &&
      cachedInputs.axis === lastAxis &&
      cachedInputs.intensity === lastIntensity &&
      cachedInputs.tolerance === inputs.tolerance &&
      cachedInputs.mode === inputs.mode &&
      cachedInputs.coarseKey === coarseKey
    if (!inputsUnchanged) {
      cachedCollapse = matchAndCollapse(parsedRows, {
        ...inputs,
        mzAxis: lastAxis,
        meanIntensity: lastIntensity,
      })
      cachedInputs.axis = lastAxis
      cachedInputs.intensity = lastIntensity
      cachedInputs.tolerance = inputs.tolerance
      cachedInputs.mode = inputs.mode
      cachedInputs.coarseKey = coarseKey
    }
    const collapse = cachedCollapse!
    const sorted = sortMatchedRows(collapse.rows, inputs.sortKey, inputs.sortDir)
    // Sort-only rematch over a row set the main thread already holds (it was
    // streamed in full): ship just the row-id permutation (a transferable)
    // instead of re-cloning every row object.
    if (req.op === 'rematch' && !req.full && inputsUnchanged && lastFullStream === collapse) {
      postPermutation(req.id, sorted, collapse)
      return
    }
    postResult(req.id, sorted, collapse)
  } catch (err) {
    const msg = {
      id: req.id,
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } as const
    self.postMessage(msg)
  }
}

/** Stream the result rows back in chunks, then a final message carrying the
 *  counts. Records the collapse as fully streamed so a later sort-only
 *  rematch can ship a permutation instead. */
function postResult(
  id: number,
  rows: MatchedAnnotationRow[],
  counts: MatchAndCollapseResult,
): void {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    self.postMessage({
      id,
      type: 'chunk',
      rows: rows.slice(i, i + CHUNK_SIZE),
    })
  }
  lastFullStream = counts
  postCounts(id, counts)
}

/** Sort-only result: the row ids in their new order, as a transferable
 *  Int32Array (300k rows = ~1.2 MB, zero-copy) instead of re-cloned row
 *  objects. The main thread reorders the rows it already holds by id. */
function postPermutation(
  id: number,
  sorted: MatchedAnnotationRow[],
  counts: MatchAndCollapseResult,
): void {
  const ids = new Int32Array(sorted.length)
  for (let i = 0; i < sorted.length; i++) ids[i] = sorted[i]!.id
  // The project compiles with the DOM lib only (no WebWorker lib), so `self`
  // is typed as Window, whose postMessage takes a targetOrigin string as its
  // second parameter. Cast to Worker, which has the Transferable[] overload.
  ;(self as unknown as Worker).postMessage({ id, type: 'perm', ids }, [ids.buffer])
  postCounts(id, counts)
}

/** Final message of every response, carrying the counts. */
function postCounts(id: number, counts: MatchAndCollapseResult): void {
  self.postMessage({
    id,
    type: 'result',
    mzColumn: parsedMzColumn,
    statusCounts: counts.statusCounts,
    importedTotal: parsedRows.length,
    coarseFiltered: counts.coarseFiltered,
    collapsed: counts.collapsed,
    droppedDuplicates: counts.droppedDuplicates,
  })
}
