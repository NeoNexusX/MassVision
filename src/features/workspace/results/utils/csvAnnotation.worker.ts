/**
 * Web Worker: owns the parsed annotation rows and runs matching off the main
 * thread. Designed for large CSVs (hundreds of thousands of rows) where a
 * synchronous main-thread parse+match blocks the UI for seconds.
 *
 * The worker keeps the parsed rows in memory after the first import, so a
 * re-match (tolerance / polarity / spectrum changed) only needs a small
 * request instead of re-shipping the whole CSV.
 *
 * Protocol:
 *   main -> worker:
 *     { op: 'import', id, text, mzAxis, meanIntensity, tolerance, mode, coarse }
 *     { op: 'rematch', id, mzAxis, meanIntensity, tolerance, mode, coarse }
 *     { op: 'clear', id }                            // drop parsedRows (no reply)
 *   worker -> main:
 *     { id, type: 'chunk', start, rows }            // one slice of the result
 *     { id, type: 'result', mzColumn, statusCounts, importedTotal } // after last chunk
 *     { id, type: 'error', message }
 *
 * `rows` is streamed back in `CHUNK_SIZE` slices rather than one giant
 * postMessage: a single 200k-object transfer would be deserialized on the main
 * thread in one synchronous burst and visibly freeze the UI (the import spinner
 * included). Chunking keeps each deserialization short so the browser can paint
 * between slices.
 */
import {
  parseAnnotationCsv,
  matchAnnotations,
  sortMatchedRows,
  countMatchStatuses,
  type AnnotationRow,
  type MatchedAnnotationRow,
  type ToleranceMode,
  type CoarseFilter,
  type AnnotationSortKey,
  type AnnotationSortDir,
} from './csvAnnotation'

interface BaseReq {
  id: number
  sortKey?: AnnotationSortKey
  sortDir?: AnnotationSortDir
}
interface ImportReq extends BaseReq {
  op: 'import'
  text: string
  mzAxis: Float64Array | null
  meanIntensity: Float32Array | null
  tolerance: number
  mode: ToleranceMode
  coarse?: CoarseFilter
}
interface RematchReq extends BaseReq {
  op: 'rematch'
  mzAxis: Float64Array | null
  meanIntensity: Float32Array | null
  tolerance: number
  mode: ToleranceMode
  coarse?: CoarseFilter
}
interface ClearReq {
  op: 'clear'
  id: number
}
type Req = ImportReq | RematchReq | ClearReq

// Worker-owned parsed state. Survives across rematch requests.
let parsedRows: AnnotationRow[] = []
let parsedMzColumn = ''

/** Rows sent per postMessage. Small enough that deserializing one slice stays
 *  well under a frame budget on the main thread. */
const CHUNK_SIZE = 10000

self.onmessage = (e: MessageEvent<Req>) => {
  const req = e.data
  try {
    if (req.op === 'import') {
      const parsed = parseAnnotationCsv(req.text)
      parsedRows = parsed.rows
      parsedMzColumn = parsed.mzColumn
      const rows = runMatch(req.mzAxis, req.meanIntensity, req.tolerance, req.mode, req.coarse)
      const sorted = sortMatchedRows(rows, req.sortKey, req.sortDir)
      postResult(req.id, sorted, parsedMzColumn)
    } else if (req.op === 'rematch') {
      // rematch against the kept parsedRows
      if (!parsedRows.length) {
        self.postMessage({ id: req.id, type: 'error', message: 'no parsed rows to re-match' })
        return
      }
      const rows = runMatch(req.mzAxis, req.meanIntensity, req.tolerance, req.mode, req.coarse)
      const sorted = sortMatchedRows(rows, req.sortKey, req.sortDir)
      postResult(req.id, sorted, parsedMzColumn)
    } else {
      // clear: drop the parsed rows so a cleared panel doesn't keep them alive
      parsedRows = []
      parsedMzColumn = ''
    }
  } catch (err) {
    const msg = {
      id: req.id,
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } as const
    self.postMessage(msg)
  }
}

/** Stream `rows` back in chunks, then a final result carrying the counts. */
function postResult(id: number, rows: MatchedAnnotationRow[], mzColumn: string): void {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    self.postMessage({
      id,
      type: 'chunk',
      start: i,
      rows: rows.slice(i, i + CHUNK_SIZE),
    })
  }
  self.postMessage({
    id,
    type: 'result',
    mzColumn,
    statusCounts: countMatchStatuses(rows),
    importedTotal: parsedRows.length,
  })
}

function runMatch(
  mzAxis: Float64Array | null,
  meanIntensity: Float32Array | null,
  tolerance: number,
  mode: ToleranceMode,
  coarse?: CoarseFilter,
): MatchedAnnotationRow[] {
  // Reuse matchAnnotations as the single source of truth for the coarse
  // polarity + m/z-range filter; no duplicated filtering logic here.
  return matchAnnotations(parsedRows, mzAxis, meanIntensity, tolerance, mode, coarse)
}
