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
  /** Distinct formula_ion strings from isobars that were collapsed onto this
   *  representative (excludes the rep's own `formulaIon`). Lets the panel's
   *  search still find a compound by any of its merged-away isobars' formulas
   *  - `mergeInto` drops `other.formulaIon` from the kept fields, so without
   *  this archive those formulas become unsearchable. */
  altFormulas: string[]
  /** Distinct `Ion type` strings from merged-away isobars (excludes the rep's
   *  own `ionType`); mirrors {@link altFormulas} for adduct search. */
  altAdducts: string[]
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
export function normalizeResultPolarity(
  p: string | null | undefined,
): 'positive' | 'negative' | null {
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
  const ionSign = row.ionType ? readTrailingChargeSign(row.ionType) : null
  if (ionSign === '+') return 'positive'
  if (ionSign === '-') return 'negative'
  const formulaSign = row.formulaIon ? readTrailingChargeSign(row.formulaIon) : null
  if (!formulaSign) return 'unknown'
  // The adduct had no trailing charge sign. If it still carries a readable
  // composition sign right after the neutral-mass token (bare `M+H` / `M-H`
  // style) that contradicts the formula's tail, the row is internally
  // inconsistent - stay `unknown` (kept by the coarse filter) rather than
  // trusting one source over the other.
  const implied = row.ionType ? readBareAdductSign(row.ionType) : null
  if (implied && implied !== formulaSign) return 'unknown'
  return formulaSign === '+' ? 'positive' : 'negative'
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

/** The composition sign immediately after the neutral-mass token in a bare
 *  adduct (`M+H` -> `+`, `M-H` -> `-`, `M-H2O-H` -> `-`). Only used to
 *  cross-check a formula's trailing sign when the adduct itself carries no
 *  trailing charge sign; `null` when no `M<sign>` token can be read. */
function readBareAdductSign(s: string): string | null {
  const m = s.match(/M\s*([+-])/)
  return m ? m[1]! : null
}

// ---- Column-name matching -------------------------------------------------

const MZ_ALIASES = [
  'tar. m/z',
  'tar m/z',
  'target m/z',
  'target_mz',
  'tar_mz',
  'tar mz',
  'exp. m/z',
  'exp m/z',
  'experimental m/z',
  'experimental_mz',
  'exp_mz',
  'exp mz',
  'm/z',
  'mz',
  'mass',
  'm/z (exp)',
  'measured m/z',
  'observed m/z',
  'observed_mz',
  'mz_exp',
  'm-z',
  'm/z observed',
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
 * Parse a numeric m/z cell, tolerating thousands separators (`1,234.5`).
 * Commas are stripped unconditionally, so US-style thousands grouping works;
 * European decimal commas (`885,5499`) are NOT supported (they'd be parsed
 * as integers). Returns NaN when the value is not a finite positive number.
 */
function parseMzCell(raw: string): number {
  const s = raw.trim().replace(/,/g, '')
  if (!s) return NaN
  return parseFloat(s)
}

/**
 * Parse annotation CSV text into {@link AnnotationRow}s. Throws
 * {@link CsvParseError} for fatal problems (empty file, no m/z column, no data
 * rows); individual rows with a bad m/z are kept and flagged `valid: false`.
 */
export function parseAnnotationCsv(text: string): ParsedAnnotationCsv {
  // Strip UTF-8 BOM if present.
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const normalized = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n+$/, '')
  if (!normalized.trim()) throw new CsvParseError('CSV file is empty.')

  const lines = normalized.split('\n')
  const headerLine = lines.shift()!
  const delimiter = detectDelimiter(headerLine)
  const headers = splitCsvLine(headerLine, delimiter)

  const mzCol = matchColumn(headers, MZ_ALIASES)
  if (!mzCol) {
    throw new CsvParseError(
      'No m/z column found. Expected one of: "Tar. m/z", "m/z", "mz", "MZ", "target_mz", "mass", ...',
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
    const get = (i: number): string => (i >= 0 && i < fields.length ? (fields[i] ?? '').trim() : '')

    // Parse the m/z cell (commas are stripped as thousands separators;
    // European decimal comma is NOT supported). See parseMzCell for details.
    const expMz = parseMzCell(get(mzIdx))
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

const EMPTY_MATCH: Pick<
  MatchedAnnotationRow,
  'matchStatus' | 'matchedMz' | 'matchedIndex' | 'massError' | 'avgIntensity'
> = {
  matchStatus: 'unmatched',
  matchedMz: null,
  matchedIndex: null,
  massError: null,
  avgIntensity: null,
}

/** Empty `altFormulas`/`altAdducts` for freshly matched rows (before any
 *  collapsing has merged isobars in). One frozen pair is shared by every
 *  pre-collapse row - collapse builds fresh arrays on the representative
 *  only when it actually accumulates an isobar. */
const EMPTY_ALT_FORMULAS: string[] = []
const EMPTY_ALT_ADDUCTS: string[] = []

/** Coarse pre-filter options for {@link coarseFilterRows}. Rows that fail a
 *  filter are dropped before matching, so the per-row binary search is skipped
 *  entirely - meaningful for CSVs with hundreds of thousands of rows.
 *
 *  EXTENDING: add a field here, implement its predicate inside
 *  {@link coarseFilterRows}, and everything downstream (worker protocol,
 *  cache invalidation, drop counting) picks it up automatically - see
 *  {@link coarseFilterKey}. */
export interface CoarseFilter {
  /** Result polarity ('positive'/'negative'). Rows whose adduct/formula
   *  clearly imply the *opposite* polarity are dropped; `unknown` rows are
   *  kept. */
  polarity?: 'positive' | 'negative' | null
}

/** Canonical string form of a coarse filter, for cache-key comparison.
 *  Field-agnostic on purpose: entries are sorted and null/undefined fields
 *  dropped, so a filter field added to {@link CoarseFilter} later is
 *  automatically part of the key - nobody has to remember to register it in
 *  the worker's cache-invalidation comparison. */
export function coarseFilterKey(coarse?: CoarseFilter | null): string {
  if (!coarse) return ''
  const entries = Object.entries(coarse)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return entries.length ? JSON.stringify(entries) : ''
}

/** Everything one match run needs, bundled so adding a parameter is a
 *  one-field change instead of editing parallel positional signatures across
 *  the worker protocol, the worker, and the main-thread fallback. */
export interface MatchInputs {
  /** Shared m/z axis (Float64Array). null/empty -> all rows match as
   *  'unmatched'. On the worker protocol, `undefined` means "unchanged since
   *  the last request - reuse the worker's cached copy". */
  mzAxis?: Float64Array | null
  /** Raw mean-spectrum intensities aligned with `mzAxis` (may be null; same
   *  `undefined` wire semantics as `mzAxis`). */
  meanIntensity?: Float32Array | null
  /** Max acceptable error in `mode` units. */
  tolerance: number
  mode: ToleranceMode
  coarse?: CoarseFilter
  sortKey?: AnnotationSortKey
  sortDir?: AnnotationSortDir
}

/** Inline coarse-mismatch marker - reused for both the no-axis branch and the
 *  per-row loop so the labeling stays consistent. */
function coarseInvalid(): Pick<
  MatchedAnnotationRow,
  'matchStatus' | 'matchedMz' | 'matchedIndex' | 'massError' | 'avgIntensity'
> {
  return { ...EMPTY_MATCH, matchStatus: 'invalid' }
}

/**
 * Coarse pre-filter: drop rows that can never match, BEFORE matching.
 * Two filter dimensions, both skipping `invalid` rows (bad m/z in the CSV -
 * they pass through untouched so they stay in the table as `invalid`):
 *
 *  - polarity: rows whose adduct/formula clearly imply the opposite polarity
 *    of `coarse.polarity` are dropped; `unknown` rows are kept so we never
 *    discard a potentially valid match. Axis-independent, applies even when
 *    no spectrum is loaded yet.
 *  - m/z range: when `mzAxis` is non-empty, rows whose `expMz` lies outside
 *    the axis range (widened by the tolerance) are dropped - they can never
 *    match a peak.
 *
 * ppm margins must account for massErrorOf dividing by the ROW's expMz, not
 * the boundary peak's: the true keep-range is [lo/(1+t), hi/(1-t)] with
 * t = tolerance*1e-6, so loMargin = lo*t/(1+t) and hiMargin = hi*t/(1-t).
 * Using the un-divided hi*t here would drop rows in a razor-thin band just
 * above the axis top that would actually match (e.g. hi=1000, 100 ppm:
 * expMz=1000.100005 has a 99.995 ppm error).
 *
 * @returns the surviving rows plus the drop count, so callers never have to
 *          reverse-engineer it by subtracting lengths.
 */
export function coarseFilterRows(
  rows: AnnotationRow[],
  coarse: CoarseFilter | undefined,
  mzAxis: ArrayLike<number> | null,
  tolerance: number,
  mode: ToleranceMode,
): { survivors: AnnotationRow[]; dropped: number } {
  const wantPolarity = coarse?.polarity ?? null
  const hasAxis = !!mzAxis && mzAxis.length > 0
  if (!wantPolarity && !hasAxis) return { survivors: rows, dropped: 0 }

  let lo = 0
  let hi = 0
  let loMargin = 0
  let hiMargin = 0
  if (hasAxis) {
    lo = mzAxis![0]!
    hi = mzAxis![mzAxis!.length - 1]!
    const t = mode === 'ppm' ? tolerance * 1e-6 : NaN
    loMargin = mode === 'ppm' ? (lo * t) / (1 + t) : tolerance
    // t >= 1 (a tolerance of 1e6 ppm) is absurd; treat the high edge as
    // unbounded rather than dividing by 1-t <= 0.
    hiMargin = mode === 'ppm' ? (t < 1 ? (hi * t) / (1 - t) : Infinity) : tolerance
  }

  const survivors: AnnotationRow[] = []
  for (const r of rows) {
    if (!r.valid) {
      survivors.push(r)
      continue
    }
    if (wantPolarity) {
      const rp = inferRowPolarity(r)
      if (rp !== 'unknown' && rp !== wantPolarity) continue
    }
    if (hasAxis && (r.expMz < lo - loMargin || r.expMz > hi + hiMargin)) continue
    survivors.push(r)
  }
  return { survivors, dropped: rows.length - survivors.length }
}

/**
 * Match every parsed row against the average-spectrum m/z axis. Pure 1:1
 * mapping: every input row produces exactly one output row (coarse filtering
 * is a separate step - see {@link coarseFilterRows}).
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
    return rows.map((r) => ({
      ...r,
      altFormulas: EMPTY_ALT_FORMULAS,
      altAdducts: EMPTY_ALT_ADDUCTS,
      ...(r.valid ? EMPTY_MATCH : coarseInvalid()),
    }))
  }

  return rows.map((r) => {
    if (!r.valid) {
      return {
        ...r,
        altFormulas: EMPTY_ALT_FORMULAS,
        altAdducts: EMPTY_ALT_ADDUCTS,
        ...coarseInvalid(),
      }
    }
    const idx = findClosestIndex(mzAxis, r.expMz)
    const matchedMz = mzAxis[idx]!
    const err = massErrorOf(r.expMz, matchedMz, mode)
    if (err <= tolerance) {
      return {
        ...r,
        altFormulas: EMPTY_ALT_FORMULAS,
        altAdducts: EMPTY_ALT_ADDUCTS,
        matchStatus: 'matched',
        matchedMz,
        matchedIndex: idx,
        massError: err,
        avgIntensity: meanIntensity ? (meanIntensity[idx] ?? null) : null,
      }
    }
    return { ...r, altFormulas: EMPTY_ALT_FORMULAS, altAdducts: EMPTY_ALT_ADDUCTS, ...EMPTY_MATCH }
  })
}

// ---- Row collapsing (duplicates + isobars) ---------------------------------

/** Canonical identity of an *invalid* annotation row (no usable m/z), used to
 *  drop exact duplicates - identical formula + adduct + candidate list. Only
 *  invalid rows rely on this: every valid row collapses onto an m/z instead.
 *  JSON-encoded so the key is unambiguous about field boundaries (and free of
 *  invisible control-char separators). */
function rowIdentityKey(r: Pick<AnnotationRow, 'formulaIon' | 'ionType' | 'candidates'>): string {
  return JSON.stringify([r.formulaIon ?? '', r.ionType ?? '', r.candidates])
}

/**
 * Collapse rows that represent the same annotation entry into one. Isobaric
 * compounds share an exact experimental m/z, so they collapse onto the same
 * entry; a large candidate DB (LIPID MAPS / SwissLipids) yields many of them.
 * The result is a "one m/z, N candidates" list instead of a flood of
 * near-identical rows.
 *
 * Grouping is by the CSV's experimental m/z (`expMz`), NOT by the matched
 * spectrum peak: rows whose m/z merely land within tolerance of the same peak
 * are different entries and stay separate. Only true isobars - an identical
 * m/z - merge.
 *
 *   - Valid rows group by `expMz` (rounded to 6 dp), whether matched or not.
 *   - Invalid rows (no m/z to group by) only drop exact duplicates.
 *
 * The representative row is the first member: its `formulaIon`, `ionType`,
 * `expMz` and match fields are kept as-is (so the formula next to the first
 * candidate name stays consistent), and the other members' candidate names are
 * appended. Other members' distinct `formulaIon`/`ionType` are archived onto
 * the rep in `altFormulas`/`altAdducts` so the panel's search can still find a
 * compound by any of its merged-away isobars' formula.
 *
 * @returns The collapsed rows (first-seen order preserved) plus separate
 *          counts of isobar-merges and invalid-duplicate drops.
 */
/** Result of {@link collapseRows}: the kept rows plus two disjoint counts of
 *  what was removed, so callers can tell isobar-merges apart from
 *  invalid-duplicate drops (the import toast labels them differently). */
export interface CollapseResult {
  rows: MatchedAnnotationRow[]
  /** Valid rows merged onto the same experimental m/z's representative. These
   *  collapsed *onto an m/z peak* (or onto another valid row sharing the m/z)
   *  and contribute their candidate names + formula/adduct archive to the rep. */
  collapsed: number
  /** Distinct invalid rows that were identical to one already seen and dropped
   *  by exact-duplicate dedupe. These never touched an m/z, so they must not be
   *  described as "collapsed onto peaks". */
  droppedDuplicates: number
}

/** Per-representative mutable accumulation state. The scratch arrays are
 *  owned by the group - NEVER the parsed rows' own `candidates` arrays:
 *  `matchAnnotations` shallow-spreads rows, so `rep.candidates` is the same
 *  array instance the worker keeps in its parsed cache, and pushing into it
 *  would permanently pollute every later rematch. Building the merged lists
 *  in scratch buffers also keeps a K-member group O(K): no per-merge rebuild
 *  of seen-sets, no per-merge array clones. */
interface GroupState {
  candidates: string[]
  namesSeen: Set<string>
  altFormulas: string[]
  formulasSeen: Set<string>
  altAdducts: string[]
  adductsSeen: Set<string>
}

export function collapseRows(rows: MatchedAnnotationRow[]): CollapseResult {
  const out: MatchedAnnotationRow[] = []
  // group key -> index in `out` of the representative row.
  const groupIndexOf = new Map<string, number>()
  const groups = new Map<number, GroupState>()
  const invalidSeen = new Set<string>()
  let collapsed = 0
  let droppedDuplicates = 0

  for (const r of rows) {
    if (r.valid) {
      // Group isobars by the CSV's exact experimental m/z.
      const key = `mz:${r.expMz.toFixed(6)}`
      const gi = groupIndexOf.get(key)
      if (gi == null) {
        // First member of the group becomes the representative. Seed the
        // scratch state from its own fields (candidates COPIED, see above) so
        // subsequent merges don't re-add them.
        groupIndexOf.set(key, out.length)
        groups.set(out.length, {
          candidates: [...r.candidates],
          namesSeen: new Set(r.candidates),
          altFormulas: [],
          formulasSeen: new Set(r.formulaIon ? [r.formulaIon] : []),
          altAdducts: [],
          adductsSeen: new Set(r.ionType ? [r.ionType] : []),
        })
        out.push(r)
      } else {
        out[gi] = mergeInto(out[gi]!, r, groups.get(gi)!)
        collapsed++
      }
    } else {
      const key = rowIdentityKey(r)
      if (invalidSeen.has(key)) {
        droppedDuplicates++
        continue
      }
      invalidSeen.add(key)
      out.push(r)
    }
  }
  return { rows: out, collapsed, droppedDuplicates }
}

/** Merge `other` (same experimental m/z) into the representative row `rep`.
 *  The group's scratch state is mutated in place; the returned row references
 *  the scratch arrays, so the representative must be re-taken from `out` after
 *  every merge (which collapseRows does). */
function mergeInto(
  rep: MatchedAnnotationRow,
  other: MatchedAnnotationRow,
  g: GroupState,
): MatchedAnnotationRow {
  // Append `other`'s candidate names, dropping duplicates in first-seen order.
  const wasEmpty = g.candidates.length === 0
  for (const c of other.candidates) {
    if (c && !g.namesSeen.has(c)) {
      g.namesSeen.add(c)
      g.candidates.push(c)
    }
  }

  // Archive `other`'s formula/adduct when they differ from the rep's and have
  // not been archived already. Lets panel search still find a compound by any
  // isobar's formula - those fields aren't otherwise kept on the collapsed row.
  if (other.formulaIon && !g.formulasSeen.has(other.formulaIon)) {
    g.formulasSeen.add(other.formulaIon)
    g.altFormulas.push(other.formulaIon)
  }
  if (other.ionType && !g.adductsSeen.has(other.ionType)) {
    g.adductsSeen.add(other.ionType)
    g.altAdducts.push(other.ionType)
  }

  // Keep the rep's displayed `name` (it was named from its own first candidate
  // at parse, or - for a formula-only row - from its `formulaIon`; either way
  // it stays consistent with `rep.formulaIon`, which this merge preserves).
  // Re-deriving `name = candidates[0]` would rewrite the displayed name to the
  // OTHER isobar's candidate when the rep had none - a name paired with a
  // formula that never coexisted in source. Surface the merged candidate only
  // when the rep truly had no candidates of its own AND just gained one.
  const name = wasEmpty && g.candidates.length > 0 ? g.candidates[0]! : rep.name

  return {
    ...rep,
    candidates: g.candidates,
    name,
    altFormulas: g.altFormulas,
    altAdducts: g.altAdducts,
  }
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

// ---- Full match pipeline ---------------------------------------------------

/** Result of {@link matchAndCollapse}: the collapsed (NOT yet sorted) rows
 *  plus every count a caller needs to report what happened, so nothing has to
 *  be reverse-engineered by subtraction after the fact. The worker caches this
 *  so a rematch that only changes the sort key/dir can re-sort without
 *  re-running the O(rows · log axis) match + collapse. */
export interface MatchAndCollapseResult {
  /** Collapsed rows in first-seen order (sort is a separate step). */
  rows: MatchedAnnotationRow[]
  /** Status counts over the collapsed set (what the filter badges show). */
  statusCounts: MatchStatusCounts
  /** Input rows dropped by the coarse polarity / m/z-range pre-filter. */
  coarseFiltered: number
  /** Valid rows folded into a same-m/z representative (isobars). */
  collapsed: number
  /** Invalid rows dropped as exact duplicates. */
  droppedDuplicates: number
}

/** coarse-filter -> match -> collapse -> count, without the final sort. */
export function matchAndCollapse(
  rows: AnnotationRow[],
  inputs: MatchInputs,
): MatchAndCollapseResult {
  const { survivors, dropped } = coarseFilterRows(
    rows,
    inputs.coarse,
    inputs.mzAxis ?? null,
    inputs.tolerance,
    inputs.mode,
  )
  const matched = matchAnnotations(
    survivors,
    inputs.mzAxis ?? null,
    inputs.meanIntensity ?? null,
    inputs.tolerance,
    inputs.mode,
  )
  const collapsed = collapseRows(matched)
  return {
    rows: collapsed.rows,
    statusCounts: countMatchStatuses(collapsed.rows),
    coarseFiltered: dropped,
    collapsed: collapsed.collapsed,
    droppedDuplicates: collapsed.droppedDuplicates,
  }
}

/** Result of {@link runMatchPipeline}: the display-ready rows plus counts.
 *  Same fields as {@link MatchAndCollapseResult}, but `rows` is sorted. */
export type MatchPipelineResult = MatchAndCollapseResult

/** coarse-filter -> match -> collapse -> sort -> count, in one place. This is
 *  THE pipeline: the Web Worker and the main-thread fallback both build on it
 *  (the worker via {@link matchAndCollapse} + a cached re-sort, the fallback
 *  directly) so the two paths cannot drift apart (different ordering,
 *  different counts). */
export function runMatchPipeline(rows: AnnotationRow[], inputs: MatchInputs): MatchPipelineResult {
  const mc = matchAndCollapse(rows, inputs)
  return { ...mc, rows: sortMatchedRows(mc.rows, inputs.sortKey, inputs.sortDir) }
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

// ---- Export ---------------------------------------------------------------

/** Escape one CSV cell: quote when it contains the delimiter, quotes, or a line break. */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Build the CSV text for exporting matched annotations. Only rows with
 * matchStatus 'matched' are included; columns pair the experimental m/z with
 * the annotation name, then the matched peak m/z and the mass difference in
 * the active unit. `rows` are written in the order given (pass the sorted
 * list to mirror the on-screen order).
 */
export function buildAnnotationExportCsv(
  rows: MatchedAnnotationRow[],
  mode: ToleranceMode,
): string {
  const header = [
    'Name',
    'Candidates',
    'formula_ion',
    'Ion type',
    'Tar. m/z',
    'Matched m/z',
    `Mass Difference (${mode})`,
    'Avg Intensity',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    if (r.matchStatus !== 'matched') continue
    lines.push(
      [
        csvCell(r.name),
        csvCell(r.candidates.join('; ')),
        csvCell(r.formulaIon ?? ''),
        csvCell(r.ionType ?? ''),
        r.expMz.toFixed(4),
        r.matchedMz != null ? r.matchedMz.toFixed(4) : '',
        r.massError != null ? r.massError.toFixed(mode === 'ppm' ? 2 : 4) : '',
        r.avgIntensity != null && Number.isFinite(r.avgIntensity)
          ? r.avgIntensity.toFixed(2)
          : '',
      ].join(','),
    )
  }
  return lines.join('\r\n')
}
