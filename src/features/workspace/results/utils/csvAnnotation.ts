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

/**
 * Match every parsed row against the average-spectrum m/z axis.
 *
 * @param mzAxis      Shared m/z axis (Float64Array). null/empty -> all rows
 *                    become 'unmatched' (invalid rows stay 'invalid').
 * @param meanIntensity Raw mean-spectrum intensities aligned with `mzAxis`
 *                    (may be null; intensity then reports null but matching by
 *                    m/z proximity still works).
 * @param tolerance   Max acceptable error in `mode` units.
 */
export function matchAnnotations(
  rows: AnnotationRow[],
  mzAxis: ArrayLike<number> | null,
  meanIntensity: ArrayLike<number> | null,
  tolerance: number,
  mode: ToleranceMode,
): MatchedAnnotationRow[] {
  if (!mzAxis || !mzAxis.length) {
    return rows.map((r) =>
      r.valid
        ? { ...r, ...EMPTY_MATCH }
        : { ...r, ...EMPTY_MATCH, matchStatus: 'invalid' },
    )
  }
  return rows.map((r) => {
    if (!r.valid) return { ...r, ...EMPTY_MATCH, matchStatus: 'invalid' }
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
