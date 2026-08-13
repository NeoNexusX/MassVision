/**
 * Annotation CSV import & m/z matching utilities (pure, no Vue deps).
 *
 * Parse an external metabolite/lipid annotation table (CSV) and match each
 * row's experimental m/z against the current result's average-spectrum m/z
 * axis. Used by {@link ../composables/useAnnotationMatch}.
 *
 * CSV contract (deliberately flexible):
 *   - UTF-8 / UTF-8 BOM supported; delimiter auto-detected (,/;/\t/|).
 *   - m/z column recognised by many aliases: `Exp. m/z`, `mz`, `m/z`, `MZ`,
 *     `experimental_mz`, `exp_mz`, `mass`, ...
 *   - Candidate names merged from `Candidate_1`..`Candidate_N` (+ bare
 *     `Candidate`), empty values dropped, original rows never deduplicated.
 *   - `formula_ion` / `formula` and `Ion type` / `adduct` picked up when present.
 *   - Rows lacking a valid numeric m/z are kept but flagged `invalid` so the
 *     table stays complete and the page never throws on a single bad row.
 */

/** Tolerance unit for m/z matching. */
export type ToleranceMode = 'ppm' | 'Da'

/** Match outcome for a row. */
export type MatchStatus = 'matched' | 'unmatched' | 'invalid'

/** A parsed annotation row, before matching. */
export interface AnnotationRow {
  /** Stable id (original CSV row order). */
  id: number
  /** Merged candidate names (Candidate_1..N), empty values dropped. */
  candidates: string[]
  /** Primary display name: first candidate, else formula_ion, else 'Unknown'. */
  name: string
  formulaIon: string | null
  ionType: string | null
  /** Experimental m/z parsed from the CSV (NaN if invalid/missing). */
  expMz: number
  /** False when expMz is missing/non-finite. */
  valid: boolean
}

/** An {@link AnnotationRow} enriched with m/z-match results. */
export interface MatchedAnnotationRow extends AnnotationRow {
  matchStatus: MatchStatus
  /** Closest m/z value in the spectrum (null unless matched). */
  matchedMz: number | null
  /** Index of the closest peak in the m/z axis (null unless matched). */
  matchedIndex: number | null
  /** |Δ| in the active unit (ppm or Da). null unless matched. */
  massError: number | null
  /** Average-spectrum intensity at the matched peak. null unless matched. */
  avgIntensity: number | null
}

/** Thrown when the CSV cannot be used at all (empty / no m/z column). */
export class CsvParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CsvParseError'
  }
}

/** Coarse polarity a row implies, derived from its adduct/formula notation.
 *  `unknown` rows are kept - only rows that clearly imply the *opposite*
 *  polarity get dropped by the coarse filter. */
export type RowPolarity = 'positive' | 'negative' | 'unknown'

/** Normalise a result-level polarity string ('Positive', 'negative',
 *  'POS', ...) to the canonical form, or `null` if it can't be read. */
export function normalizeResultPolarity(p: string | null | undefined): 'positive' | 'negative' | null {
  if (!p) return null
  const s = p.toLowerCase()
  if (s.includes('pos')) return 'positive'
  if (s.includes('neg')) return 'negative'
  return null
}

/** Infer a row's polarity from its adduct / formula_ion text.
 *
 *  The charge sign is the *trailing* symbol of the notation (after brackets)
 *  - that's what encodes the ion's net charge. The `+`/`-` inside the
 *  brackets (e.g. `[M+Cl]-`, `[M+Na-H]2+`) describe adduct composition /
 *  losses, not the ion polarity. So we read the last `+` or `-` token and
 *  use it, falling back to the secondary source (formula_ion for an explicit
 *  `C24H50NO4+` tail).
 *
 *  Recognised patterns:
 *    - `[M+H]+`, `[M+Na]+`, `[M+Cl]-`, `[M+OAc]-`, `[M-H]-`, `[M-H-H2O]-`
 *    - `C24H50NO4+`, `C3H3O3-` (charge sign at the end of the formula)
 *    - `[M+2H]2+`, `[M+3H]3+` (multiply charged positives)
 *  Falls back to `unknown` when no trailing sign can be read (e.g. a bare
 *  `M+H`/`M-H` adduct with a neutral formula, or a bare name) so the coarse
 *  filter keeps the row rather than risks dropping it. */
export function inferRowPolarity(row: Pick<AnnotationRow, 'ionType' | 'formulaIon'>): RowPolarity {
  for (const src of [row.ionType, row.formulaIon]) {
    if (!src) continue
    const sign = readTrailingChargeSign(src)
    if (sign === '+') return 'positive'
    if (sign === '-') return 'negative'
  }
  return 'unknown'
}

/** Read the charge sign at the very end of the string (`[M+Cl]-` -> `-`,
 *  `[M+2H]2+` -> `+`). Returns `null` when the string does not end with a
 *  charge sign. */
function readTrailingChargeSign(s: string): string | null {
  let i = s.length - 1
  while (i >= 0 && /\s/.test(s[i]!)) i-- // skip trailing whitespace
  if (i < 0) return null
  const last = s[i]!
  if (last === '+' || last === '-') return last
  return null
}

// ---- Column-name matching -------------------------------------------------

const MZ_ALIASES = [
  'exp. m/z', 'exp m/z', 'experimental m/z', 'experimental_mz', 'exp_mz',
  'exp mz', 'm/z', 'mz', 'mass', 'm/z (exp)', 'measured m/z', 'observed m/z',
  'observed_mz', 'mz_exp', 'm-z', 'm/z observed',
]

const FORMULA_ALIASES = ['formula_ion', 'formula ion', 'formula', 'formulaion']
const ION_TYPE_ALIASES = ['ion type', 'ion_type', 'adduct', 'iontype']

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

function matchColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map(normalizeHeader)
  for (const alias of aliases) {
    const i = normalized.indexOf(alias)
    if (i >= 0) return headers[i]!
  }
  return null
}

/** Collect Candidate_1..Candidate_N columns (any N) preserving numeric order,
 *  plus a bare `Candidate` column as a final fallback. */
function findCandidateColumns(headers: string[]): string[] {
  const re = /^candidate[_\s-]*(\d+)$/i
  const numbered: { col: string; n: number }[] = []
  headers.forEach((h, i) => {
    if (h === undefined) return
    const m = normalizeHeader(h).match(re)
    if (m) numbered.push({ col: headers[i]!, n: parseInt(m[1]!, 10) })
  })
  numbered.sort((a, b) => a.n - b.n)
  const result = numbered.map((c) => c.col)
  const singleIdx = headers.findIndex((h) => normalizeHeader(h) === 'candidate')
  if (singleIdx >= 0 && !result.includes(headers[singleIdx]!)) {
    result.push(headers[singleIdx]!)
  }
  return result
}

// ---- CSV splitting (quoted-field aware) -----------------------------------

/** Parse a single CSV line into fields, honouring quoted fields + "" escapes. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

/** Pick the delimiter that splits the header into the most fields. */
function detectDelimiter(headerLine: string): string {
  const candidates = [',', '\t', ';', '|']
  let best = ','
  let bestCount = -1
  for (const d of candidates) {
    let count = 0
    let inQuotes = false
    for (let i = 0; i < headerLine.length; i++) {
      const ch = headerLine[i]!
      if (ch === '"') inQuotes = !inQuotes
      else if (ch === d && !inQuotes) count++
    }
    if (count > bestCount) {
      bestCount = count
      best = d
    }
  }
  return best
}

// ---- Parsing --------------------------------------------------------------

export interface ParsedAnnotationCsv {
  rows: AnnotationRow[]
  /** Name of the m/z column that was used (for feedback). */
  mzColumn: string
}

/**
 * Parse annotation CSV text into {@link AnnotationRow}s. Throws
 * {@link CsvParseError} for fatal problems (empty file, no m/z column, no data
 * rows); individual rows with a bad m/z are kept and flagged `valid: false`.
 */
export function parseAnnotationCsv(text: string): ParsedAnnotationCsv {
  // Strip UTF-8 BOM if present.
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const normalized = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n+$/, '')
  if (!normalized.trim()) throw new CsvParseError('CSV file is empty.')

  const lines = normalized.split('\n')
  const headerLine = lines.shift()!
  const delimiter = detectDelimiter(headerLine)
  const headers = splitCsvLine(headerLine, delimiter)

  const mzCol = matchColumn(headers, MZ_ALIASES)
  if (!mzCol) {
    throw new CsvParseError(
      'No m/z column found. Expected one of: "Exp. m/z", "m/z", "mz", "MZ", "experimental_mz", "mass", ...',
    )
  }
  const formulaCol = matchColumn(headers, FORMULA_ALIASES)
  const ionTypeCol = matchColumn(headers, ION_TYPE_ALIASES)
  const candidateCols = findCandidateColumns(headers)

  const mzIdx = headers.indexOf(mzCol)
  const formulaIdx = formulaCol ? headers.indexOf(formulaCol) : -1
  const ionTypeIdx = ionTypeCol ? headers.indexOf(ionTypeCol) : -1
  const candIdxs = candidateCols.map((c) => headers.indexOf(c))

  const rows: AnnotationRow[] = []
  let id = 0
  for (const line of lines) {
    if (!line.trim()) continue
    const fields = splitCsvLine(line, delimiter)
    const get = (i: number): string =>
      i >= 0 && i < fields.length ? (fields[i] ?? '').trim() : ''

    // Tolerate thousands separators / surrounding whitespace in the m/z cell.
    const expMzRaw = get(mzIdx).replace(/,/g, '').trim()
    const expMz = parseFloat(expMzRaw)
    const valid = Number.isFinite(expMz) && expMz > 0

    const candidates = candIdxs
      .map((i) => get(i))
      .filter((v) => v.length > 0 && v !== '-' && v.toLowerCase() !== 'nan')

    const formulaIon = formulaIdx >= 0 ? get(formulaIdx) : ''
    const ionType = ionTypeIdx >= 0 ? get(ionTypeIdx) : ''
    const name = candidates[0] || formulaIon || 'Unknown'

    rows.push({
      id: id++,
      candidates,
      name,
      formulaIon: formulaIon || null,
      ionType: ionType || null,
      expMz: valid ? expMz : NaN,
      valid,
    })
  }

  if (!rows.length) throw new CsvParseError('CSV has a header but no data rows.')
  return { rows, mzColumn: mzCol }
}

// ---- Matching -------------------------------------------------------------

/** Binary-search the closest index in a sorted ascending numeric array. */
export function findClosestIndex(axis: ArrayLike<number>, target: number): number {
  const n = axis.length
  if (!n) return -1
  if (target <= axis[0]!) return 0
  if (target >= axis[n - 1]!) return n - 1
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (axis[mid]! < target) lo = mid + 1
    else hi = mid
  }
  const prev = lo - 1
  return Math.abs(target - axis[prev]!) <= Math.abs(axis[lo]! - target) ? prev : lo
}

/** |Δ| between exp. and matched m/z, expressed in the given unit (always >= 0). */
export function massErrorOf(expMz: number, matchedMz: number, mode: ToleranceMode): number {
  const da = Math.abs(matchedMz - expMz)
  return mode === 'ppm' ? (da / expMz) * 1e6 : da
}

const EMPTY_MATCH: Pick<MatchedAnnotationRow, 'matchStatus' | 'matchedMz' | 'matchedIndex' | 'massError' | 'avgIntensity'> = {
  matchStatus: 'unmatched',
  matchedMz: null,
  matchedIndex: null,
  massError: null,
  avgIntensity: null,
}

/** Coarse pre-filter options for {@link matchAnnotations}. Rows that fail a
 *  filter are dropped before matching, so the per-row binary search is skipped
 *  entirely - meaningful for CSVs with hundreds of thousands of rows. */
export interface CoarseFilter {
  /** Result polarity ('positive'/'negative'). Rows whose adduct/formula
   *  clearly imply the *opposite* polarity are dropped; `unknown` rows are
   *  kept. */
  polarity?: 'positive' | 'negative' | null
}

/** Inline coarse-mismatch marker - reused for both the no-axis branch and the
 *  per-row loop so the labeling stays consistent. */
function coarseInvalid(): Pick<MatchedAnnotationRow, 'matchStatus' | 'matchedMz' | 'matchedIndex' | 'massError' | 'avgIntensity'> {
  return { ...EMPTY_MATCH, matchStatus: 'invalid' }
}

/**
 * Match every parsed row against the average-spectrum m/z axis.
 *
 * @param mzAxis      Shared m/z axis (Float64Array). null/empty -> all rows
 *                    become 'unmatched' (invalid rows stay 'invalid').
 * @param meanIntensity Raw mean-spectrum intensities aligned with `mzAxis`
 *                    (may be null; intensity then reports null but matching by
 *                    m/z proximity still works).
 * @param tolerance   Max acceptable error in `mode` units.
 * @param coarse      Optional coarse pre-filter. Rows filtered here are dropped
 *                    (no matching attempted). When `mzAxis` is non-empty, rows
 *                    whose `expMz` is outside `[axis[0], axis[last]]` are also
 *                    dropped.
 */
export function matchAnnotations(
  rows: AnnotationRow[],
  mzAxis: ArrayLike<number> | null,
  meanIntensity: ArrayLike<number> | null,
  tolerance: number,
  mode: ToleranceMode,
  coarse?: CoarseFilter,
): MatchedAnnotationRow[] {
  // Coarse polarity filter - independent of the axis, so apply it first even
  // when no spectrum is loaded yet.
  const wantPolarity = coarse?.polarity ?? null
  let polarityPrefiltered: AnnotationRow[]
  if (wantPolarity) {
    polarityPrefiltered = []
    for (const r of rows) {
      if (!r.valid) {
        polarityPrefiltered.push(r)
        continue
      }
      const rp = inferRowPolarity(r)
      // Drop only rows that *clearly* have the opposite polarity; unknown
      // rows pass through so we never discard a potentially valid match.
      if (rp !== 'unknown' && rp !== wantPolarity) continue
      polarityPrefiltered.push(r)
    }
  } else {
    polarityPrefiltered = rows
  }

  if (!mzAxis || !mzAxis.length) {
    return polarityPrefiltered.map((r) =>
      r.valid
        ? { ...r, ...EMPTY_MATCH }
        : { ...r, ...coarseInvalid() },
    )
  }

  const lo = mzAxis[0]!
  const hi = mzAxis[mzAxis.length - 1]!

  // Drop rows far outside the m/z axis (they can never match). Widen each bound
  // by the tolerance so a row just past the edge that is still within tolerance
  // of the boundary peak is matched rather than silently dropped. Invalid rows
  // (bad m/z in the CSV) pass through untouched so they stay in the table as
  // `invalid`, matching the long-standing behavior.
  const loMargin = mode === 'ppm' ? lo * tolerance * 1e-6 : tolerance
  const hiMargin = mode === 'ppm' ? hi * tolerance * 1e-6 : tolerance
  const survivors: AnnotationRow[] = []
  for (const r of polarityPrefiltered) {
    if (!r.valid) {
      survivors.push(r)
      continue
    }
    if (r.expMz >= lo - loMargin && r.expMz <= hi + hiMargin) survivors.push(r)
  }

  return survivors.map((r) => {
    if (!r.valid) return { ...r, ...coarseInvalid() }
    const idx = findClosestIndex(mzAxis, r.expMz)
    const matchedMz = mzAxis[idx]!
    const err = massErrorOf(r.expMz, matchedMz, mode)
    if (err <= tolerance) {
      return {
        ...r,
        matchStatus: 'matched',
        matchedMz,
        matchedIndex: idx,
        massError: err,
        avgIntensity: meanIntensity ? (meanIntensity[idx] ?? null) : null,
      }
    }
    return { ...r, ...EMPTY_MATCH }
  })
}

// ---- Sorting --------------------------------------------------------------

export type AnnotationSortKey = 'name' | 'expMz' | 'massError' | 'avgIntensity'
export type AnnotationSortDir = 'asc' | 'desc'

/** Sort matched rows by a column, pinning null/NaN numeric values to the bottom
 *  regardless of direction. Shared by the worker and the main-thread fallback so
 *  both produce an identical order. Returns a new array (or `rows` when no sort
 *  key/dir is supplied). */
export function sortMatchedRows(
  rows: MatchedAnnotationRow[],
  key?: AnnotationSortKey,
  dir?: AnnotationSortDir,
): MatchedAnnotationRow[] {
  if (!key || !dir) return rows
  const sign = dir === 'asc' ? 1 : -1
  const arr = [...rows]
  arr.sort((a, b) => {
    if (key === 'name') {
      return a.name.localeCompare(b.name) * sign
    }
    const av = numericSortField(a, key)
    const bv = numericSortField(b, key)
    const aNull = av == null
    const bNull = bv == null
    if (aNull && bNull) return 0
    if (aNull) return 1 // always bottom
    if (bNull) return -1
    if (av! < bv!) return -1 * sign
    if (av! > bv!) return 1 * sign
    return 0
  })
  return arr
}

function numericSortField(
  r: MatchedAnnotationRow,
  key: 'expMz' | 'massError' | 'avgIntensity',
): number | null {
  const v = r[key]
  return v == null || !Number.isFinite(v) ? null : v
}

// ---- Status counting ------------------------------------------------------

export interface MatchStatusCounts {
  total: number
  matched: number
  unmatched: number
  invalid: number
}

/** Count match statuses across rows. Shared by the worker and the main-thread
 *  fallback so the UI thread never has to re-iterate a large result set just to
 *  build the badge counts (and never proxies hundreds of thousands of rows by
 *  reading them through a reactive ref). */
export function countMatchStatuses(rows: MatchedAnnotationRow[]): MatchStatusCounts {
  const c: MatchStatusCounts = { total: 0, matched: 0, unmatched: 0, invalid: 0 }
  for (const r of rows) {
    c.total++
    c[r.matchStatus]++
  }
  return c
}

/** Format a mass error for display with the active unit. */
export function formatMassError(err: number | null, mode: ToleranceMode): string {
  if (err == null || !Number.isFinite(err)) return '-'
  const digits = mode === 'ppm' ? 2 : 4
  return err.toFixed(digits)
}

/** Format an average intensity for display (compact). */
export function formatIntensity(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '-'
  if (v === 0) return '0'
  if (v >= 1e6 || v < 1e-3) return v.toExponential(2)
  if (v >= 1000) return v.toFixed(0)
  if (v >= 10) return v.toFixed(1)
  return v.toFixed(2)
}
