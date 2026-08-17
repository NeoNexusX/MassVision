import { describe, it, expect } from 'vitest'
import {
  parseAnnotationCsv,
  matchAnnotations,
  coarseFilterRows,
  coarseFilterKey,
  collapseRows,
  runMatchPipeline,
  massErrorOf,
  findClosestIndex,
  inferRowPolarity,
  normalizeResultPolarity,
  CsvParseError,
  formatMassError,
  type AnnotationRow,
  type CoarseFilter,
  type ToleranceMode,
} from '../csvAnnotation'

/** Compose coarseFilterRows + matchAnnotations the way matchAndCollapse does
 *  (the pipeline's pre-match filtering is a separate step now). */
function matchWithCoarse(
  rows: AnnotationRow[],
  coarse: CoarseFilter,
  axis: ArrayLike<number> | null,
  intensity: ArrayLike<number> | null,
  tolerance: number,
  mode: ToleranceMode,
) {
  const { survivors } = coarseFilterRows(rows, coarse, axis, tolerance, mode)
  return matchAnnotations(survivors, axis, intensity, tolerance, mode)
}

const SAMPLE = `formula_ion,Ion type,Exp. m/z,Candidate_1,Candidate_2,Candidate_3,Candidate_4,Candidate_5
C3H3O3-,M-H,87.0091,Pyruvate,,,,
C3H5O3-,M-H,89.0246,Lactate,,,,
C2H6NO3S-,M-H,124.0075,Taurine,,,,
C10H11N4O5-,M-H,267.0741,Inosine,,Guanosine,,`

describe('parseAnnotationCsv', () => {
  it('parses the standard sample CSV', () => {
    const { rows, mzColumn } = parseAnnotationCsv(SAMPLE)
    expect(mzColumn).toBe('Exp. m/z')
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({
      name: 'Pyruvate',
      formulaIon: 'C3H3O3-',
      ionType: 'M-H',
      expMz: 87.0091,
      valid: true,
    })
    expect(rows[0]!.candidates).toEqual(['Pyruvate'])
  })

  it('merges multiple candidate columns, dropping empties', () => {
    const { rows } = parseAnnotationCsv(SAMPLE)
    expect(rows[3]!.candidates).toEqual(['Inosine', 'Guanosine'])
    expect(rows[3]!.name).toBe('Inosine')
  })

  it('strips a UTF-8 BOM', () => {
    const bom = '﻿' + SAMPLE
    const { rows } = parseAnnotationCsv(bom)
    expect(rows).toHaveLength(4)
    expect(rows[0]!.name).toBe('Pyruvate')
  })

  it('recognises m/z column aliases', () => {
    const csv = `mz,Name\n87.0091,Pyruvate\n89.0246,Lactate`
    const { rows, mzColumn } = parseAnnotationCsv(csv)
    expect(mzColumn).toBe('mz')
    expect(rows[0]!.expMz).toBe(87.0091)
  })

  it('accepts semicolon delimiters', () => {
    const csv = `Exp. m/z;Candidate_1\n87.0091;Pyruvate`
    const { rows } = parseAnnotationCsv(csv)
    expect(rows[0]!.name).toBe('Pyruvate')
  })

  it('accepts tab delimiters', () => {
    const csv = 'Exp. m/z\tCandidate_1\n87.0091\tPyruvate'
    const { rows } = parseAnnotationCsv(csv)
    expect(rows[0]!.name).toBe('Pyruvate')
  })

  it('handles quoted fields with commas/quotes', () => {
    const csv = `Exp. m/z,Candidate_1\n87.0091,"Citrate/Isocitrate, ion"\n89,"say ""hi"""`
    const { rows } = parseAnnotationCsv(csv)
    expect(rows[0]!.name).toBe('Citrate/Isocitrate, ion')
    expect(rows[1]!.name).toBe('say "hi"')
  })

  it('flags rows with a non-numeric m/z as invalid but keeps them', () => {
    const csv = `Exp. m/z,Candidate_1\n87.0091,Pyruvate\nN/A,Bad\n,Empty`
    const { rows } = parseAnnotationCsv(csv)
    expect(rows).toHaveLength(3)
    expect(rows[0]!.valid).toBe(true)
    expect(rows[1]!.valid).toBe(false)
    expect(rows[2]!.valid).toBe(false)
    expect(rows[1]!.name).toBe('Bad') // invalid m/z falls back to candidate
    expect(rows[2]!.name).toBe('Empty')
  })

  it('throws on empty input', () => {
    expect(() => parseAnnotationCsv('')).toThrow(CsvParseError)
    expect(() => parseAnnotationCsv('   \n\n')).toThrow(CsvParseError)
  })

  it('throws when no m/z column is present', () => {
    expect(() => parseAnnotationCsv('Name,Formula\nPyruvate,C3H3O3')).toThrow(CsvParseError)
  })

  it('throws when there is a header but no data rows', () => {
    expect(() => parseAnnotationCsv('Exp. m/z,Candidate_1\n')).toThrow(CsvParseError)
  })

  it('tolerates thousands separators in m/z (non-comma delimiter)', () => {
    // Comma can't be both a thousands separator and the CSV delimiter for an
    // unquoted value, so exercise this with a semicolon delimiter.
    const csv = `Exp. m/z;Candidate_1\n1,234.5;Big`
    const { rows } = parseAnnotationCsv(csv)
    expect(rows[0]!.expMz).toBe(1234.5)
  })
})

describe('matching', () => {
  const axis = Float64Array.of(87.0088, 89.0244, 124.0078, 200.0, 267.0739)
  const intensity = Float32Array.of(10, 20, 30, 0, 50)

  it('marks rows within ppm tolerance as matched with error + intensity', () => {
    const { rows } = parseAnnotationCsv(SAMPLE)
    const matched = matchAnnotations(rows, axis, intensity, 10, 'ppm')
    const pyr = matched.find((r) => r.name === 'Pyruvate')!
    expect(pyr.matchStatus).toBe('matched')
    expect(pyr.matchedMz).toBe(87.0088)
    expect(pyr.matchedIndex).toBe(0)
    expect(pyr.massError).toBeCloseTo(massErrorOf(87.0091, 87.0088, 'ppm'), 6)
    expect(pyr.avgIntensity).toBe(10)
  })

  it('marks rows outside tolerance as unmatched', () => {
    const { rows } = parseAnnotationCsv(SAMPLE)
    const matched = matchAnnotations(rows, axis, intensity, 0.1, 'ppm')
    const lac = matched.find((r) => r.name === 'Lactate')!
    expect(lac.matchStatus).toBe('unmatched')
    expect(lac.matchedMz).toBeNull()
    expect(lac.avgIntensity).toBeNull()
  })

  it('works in Da mode', () => {
    const { rows } = parseAnnotationCsv(SAMPLE)
    const matched = matchAnnotations(rows, axis, intensity, 0.005, 'Da')
    expect(matched.find((r) => r.name === 'Pyruvate')!.matchStatus).toBe('matched')
    expect(matched.find((r) => r.name === 'Taurine')!.matchStatus).toBe('matched')
  })

  it('keeps invalid rows as invalid regardless of tolerance', () => {
    const csv = `Exp. m/z,Candidate_1\nN/A,Bad\n87.0091,Pyruvate`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchAnnotations(rows, axis, intensity, 10, 'ppm')
    expect(matched[0]!.matchStatus).toBe('invalid')
    expect(matched[0]!.matchedMz).toBeNull()
  })

  it('treats a null/empty axis as all-unmatched (no crash)', () => {
    const { rows } = parseAnnotationCsv(SAMPLE)
    const matched = matchAnnotations(rows, null, null, 10, 'ppm')
    expect(matched.every((r) => r.matchStatus === 'unmatched')).toBe(true)
    expect(matched.every((r) => r.matchedMz === null)).toBe(true)
  })

  it('does not deduplicate rows that share an m/z', () => {
    const csv = `Exp. m/z,Candidate_1\n87.0091,A\n87.0091,B`
    const { rows } = parseAnnotationCsv(csv)
    expect(rows).toHaveLength(2)
    const matched = matchAnnotations(rows, axis, intensity, 10, 'ppm')
    expect(matched).toHaveLength(2)
    expect(matched.every((r) => r.matchStatus === 'matched')).toBe(true)
  })
})

describe('collapseRows', () => {
  const axis = Float64Array.of(87.0088, 89.0244, 124.0078, 267.0739)
  const intensity = Float32Array.of(10, 20, 30, 50)

  it('merges isobaric rows on the same peak into one row of candidates', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C40H66O5,M+H,627.498302,Anhydride
C40H66O5,M+H,627.498302,DG 17:2/20:4
C40H66O5,M+H,627.498302,DG 17:1/20:5`
    const { rows } = parseAnnotationCsv(csv)
    // null axis keeps every row unmatched, so match against a real axis instead
    const { rows: collapsedRows, collapsed } = collapseRows(
      matchAnnotations(rows, Float64Array.of(627.4983), intensity, 10, 'ppm'),
    )
    expect(collapsedRows).toHaveLength(1)
    expect(collapsed).toBe(2)
    expect(collapsedRows[0]!.matchStatus).toBe('matched')
    expect(collapsedRows[0]!.candidates).toEqual(['Anhydride', 'DG 17:2/20:4', 'DG 17:1/20:5'])
    // every member shares the same formula/adduct -> kept
    expect(collapsedRows[0]!.formulaIon).toBe('C40H66O5')
    expect(collapsedRows[0]!.ionType).toBe('M+H')
  })

  it('drops exact-duplicate matched rows via the same collapse', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C3H3O3-,M-H,87.0091,A
C3H3O3-,M-H,87.0091,A`
    const { rows } = parseAnnotationCsv(csv)
    const { rows: collapsedRows, collapsed } = collapseRows(
      matchAnnotations(rows, axis, intensity, 10, 'ppm'),
    )
    expect(collapsedRows).toHaveLength(1)
    expect(collapsed).toBe(1)
    expect(collapsedRows[0]!.candidates).toEqual(['A'])
  })

  it('keeps the first member formula/adduct even when isobars disagree', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C40H66O5,M+H,627.498302,Anhydride
C41H68O5,M+H,627.498302,OtherIsobar`
    const { rows } = parseAnnotationCsv(csv)
    const { rows: collapsedRows } = collapseRows(
      matchAnnotations(rows, Float64Array.of(627.4983), intensity, 10, 'ppm'),
    )
    expect(collapsedRows).toHaveLength(1)
    // representative keeps its own formula/adduct (consistent with its name)
    expect(collapsedRows[0]!.formulaIon).toBe('C40H66O5')
    expect(collapsedRows[0]!.ionType).toBe('M+H')
    expect(collapsedRows[0]!.candidates).toEqual(['Anhydride', 'OtherIsobar'])
    // the merged-away isobar's distinct formula/adduct is archived so the
    // panel's search can still find the compound by that formula.
    expect(collapsedRows[0]!.altFormulas).toEqual(['C41H68O5'])
  })

  it('keeps a formula-only representative name after it absorbs an isobar', () => {
    // Rep row has no candidate names, so at parse `name = formulaIon` (formula
    // as the display name). It then absorbs an isobar that DOES have a real
    // candidate. The merged row's `name` should surface that candidate (so the
    // user sees a real name) - but `formulaIon` stays the rep's, so the name
    // no longer contradicts the formula shown beside it.
    const csv = `formula_ion,Exp. m/z,Candidate_1
C10H20O2,200.0,
,200.0,X`
    const { rows } = parseAnnotationCsv(csv)
    const { rows: collapsedRows, collapsed } = collapseRows(
      matchAnnotations(rows, Float64Array.of(200.0), intensity, 0.5, 'Da'),
    )
    expect(collapsedRows).toHaveLength(1)
    expect(collapsed).toBe(1)
    expect(collapsedRows[0]!.candidates).toEqual(['X'])
    expect(collapsedRows[0]!.name).toBe('X')
    // rep's formula ref stays intact - not overwritten by the isobar's empty
    // formula nor the isobar's candidate.
    expect(collapsedRows[0]!.formulaIon).toBe('C10H20O2')
  })

  it('keeps rows with different m/z separate even when they share a peak', () => {
    const csv = `Exp. m/z,Candidate_1
627.4989,Far
627.4984,Near`
    const { rows } = parseAnnotationCsv(csv)
    const { rows: collapsedRows, collapsed } = collapseRows(
      matchAnnotations(rows, Float64Array.of(627.4983), intensity, 10, 'ppm'),
    )
    // different experimental m/z -> not isobars, never collapsed together
    expect(collapsedRows).toHaveLength(2)
    expect(collapsed).toBe(0)
    expect(collapsedRows.map((r) => r.name)).toEqual(['Far', 'Near'])
  })

  it('deduplicates candidate names across a merged group', () => {
    const csv = `Exp. m/z,Candidate_1,Candidate_2
627.498302,A,B
627.498302,B,C`
    const { rows } = parseAnnotationCsv(csv)
    const { rows: collapsedRows } = collapseRows(
      matchAnnotations(rows, Float64Array.of(627.4983), intensity, 10, 'ppm'),
    )
    expect(collapsedRows).toHaveLength(1)
    expect(collapsedRows[0]!.candidates).toEqual(['A', 'B', 'C'])
  })

  it('groups unmatched isobars by m/z into one candidate list', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C3H3O3-,M-H,100.0,Between
C3H3O3-,M-H,100.0,Between
C3H3O3-,M-H,100.0,IsobarB`
    const { rows } = parseAnnotationCsv(csv)
    const { rows: collapsedRows, collapsed } = collapseRows(
      matchAnnotations(rows, axis, intensity, 10, 'ppm'),
    )
    // exact dup + isobar (different name, same m/z) all collapse onto one entry
    expect(collapsedRows).toHaveLength(1)
    expect(collapsed).toBe(2)
    expect(collapsedRows[0]!.matchStatus).toBe('unmatched')
    expect(collapsedRows[0]!.candidates).toEqual(['Between', 'IsobarB'])
  })

  it('keeps unmatched rows with different m/z separate', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C3H3O3-,M-H,100.0,A
C3H3O3-,M-H,100.5,B`
    const { rows } = parseAnnotationCsv(csv)
    const { rows: collapsedRows, collapsed } = collapseRows(
      matchAnnotations(rows, axis, intensity, 10, 'ppm'),
    )
    expect(collapsedRows).toHaveLength(2)
    expect(collapsed).toBe(0)
    expect(collapsedRows.map((r) => r.name)).toEqual(['A', 'B'])
  })

  it('leaves invalid rows untouched but dedupes identical invalid rows', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
-,M-H,N/A,Bad
-,M-H,N/A,Bad`
    const { rows } = parseAnnotationCsv(csv)
    const {
      rows: collapsedRows,
      collapsed,
      droppedDuplicates,
    } = collapseRows(matchAnnotations(rows, axis, intensity, 10, 'ppm'))
    expect(collapsedRows).toHaveLength(1)
    // Invalid-row exact-dupes are reported separately - they never touched a
    // peak, so they must not be counted as "collapsed onto peaks".
    expect(collapsed).toBe(0)
    expect(droppedDuplicates).toBe(1)
    expect(collapsedRows[0]!.matchStatus).toBe('invalid')
  })

  it('keeps distinct invalid rows whose fields only collide under naive joining', () => {
    // formula 'AB'+adduct 'C' vs 'A'+'BC', and candidates ['AB'] vs ['A','B']:
    // an ambiguous identity key would drop one as a false "duplicate".
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1,Candidate_2
AB,C,N/A,X
A,BC,N/A,Y`
    const csv2 = `Exp. m/z,Candidate_1,Candidate_2
N/A,AB,
N/A,A,B`
    for (const text of [csv, csv2]) {
      const { rows } = parseAnnotationCsv(text)
      const { rows: collapsedRows, droppedDuplicates } = collapseRows(
        matchAnnotations(rows, axis, intensity, 10, 'ppm'),
      )
      expect(collapsedRows).toHaveLength(2)
      expect(droppedDuplicates).toBe(0)
    }
  })
})

describe('coarse pre-filter', () => {
  const axis = Float64Array.of(87.0088, 89.0244, 124.0078, 267.0739)
  const intensity = Float32Array.of(10, 20, 30, 50)

  it('inferRowPolarity reads adduct + formula charge signs', () => {
    expect(inferRowPolarity({ ionType: 'M+H', formulaIon: 'C3H3O3+' })).toBe('positive')
    expect(inferRowPolarity({ ionType: 'M-H', formulaIon: 'C3H3O3-' })).toBe('negative')
    expect(inferRowPolarity({ ionType: '[M+H]+', formulaIon: null })).toBe('positive')
    expect(inferRowPolarity({ ionType: '[M-H]-', formulaIon: null })).toBe('negative')
    // adducts that carry the opposite sign *inside* the bracket (adduct
    // composition) but a net charge at the end - the trailing sign wins.
    expect(inferRowPolarity({ ionType: '[M+Cl]-', formulaIon: null })).toBe('negative')
    expect(inferRowPolarity({ ionType: '[M+OAc]-', formulaIon: null })).toBe('negative')
    expect(inferRowPolarity({ ionType: '[M+Na-H]+', formulaIon: null })).toBe('positive')
    // water-loss neutral loss without a trailing charge sign -> unknown (the
    // current single-source-of-truth parser only relies on the trailing sign).
    expect(inferRowPolarity({ ionType: 'M-H-H2O', formulaIon: null })).toBe('unknown')
    expect(inferRowPolarity({ ionType: 'M-H-H2O-', formulaIon: null })).toBe('negative')
    // multiply-charged ions read their trailing sign
    expect(inferRowPolarity({ ionType: '[M+2H]2+', formulaIon: null })).toBe('positive')
    expect(inferRowPolarity({ ionType: '[M-2H]2-', formulaIon: null })).toBe('negative')
    // bare non-proton adducts without a trailing sign stay unknown (conservative)
    expect(inferRowPolarity({ ionType: 'M+Na', formulaIon: null })).toBe('unknown')
    expect(inferRowPolarity({ ionType: 'M+Cl', formulaIon: null })).toBe('unknown')
    // no trailing charge sign -> unknown (keep, don't risk dropping a valid row)
    expect(inferRowPolarity({ ionType: '[M+Na-H]', formulaIon: null })).toBe('unknown')
    expect(inferRowPolarity({ ionType: null, formulaIon: 'C24H50NO4' })).toBe('unknown')
    expect(inferRowPolarity({ ionType: null, formulaIon: null })).toBe('unknown')
    // internally inconsistent row: bare adduct implies one polarity, the
    // formula's trailing sign says the other -> unknown (kept), never trusted
    expect(inferRowPolarity({ ionType: 'M+H', formulaIon: 'C40H66O5-' })).toBe('unknown')
    expect(inferRowPolarity({ ionType: 'M-H', formulaIon: 'C40H66O5+' })).toBe('unknown')
  })

  it('normalizeResultPolarity handles casing/wording', () => {
    expect(normalizeResultPolarity('Positive')).toBe('positive')
    expect(normalizeResultPolarity('NEGATIVE')).toBe('negative')
    expect(normalizeResultPolarity('pos')).toBe('positive')
    expect(normalizeResultPolarity('negative mode')).toBe('negative')
    expect(normalizeResultPolarity('')).toBeNull()
    expect(normalizeResultPolarity(null)).toBeNull()
    expect(normalizeResultPolarity('unknown')).toBeNull()
  })

  it('drops rows of the opposite polarity before matching', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C3H3O3+,M+H,87.0091,PosMatch
C3H3O3-,M-H,89.0246,NegMatch`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchWithCoarse(rows, { polarity: 'negative' }, axis, intensity, 10, 'ppm')
    // positive row dropped entirely (not even returned); negative kept + matched
    expect(matched).toHaveLength(1)
    expect(matched[0]!.name).toBe('NegMatch')
    expect(matched[0]!.matchStatus).toBe('matched')
  })

  it('keeps unknown-polarity rows even when a polarity filter is set', () => {
    // No adduct/formula sign -> inferable rows kept under any polarity filter.
    const csv = `Exp. m/z,Candidate_1\n87.0091,NoAdduct`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchWithCoarse(rows, { polarity: 'positive' }, axis, intensity, 10, 'ppm')
    expect(matched).toHaveLength(1)
    expect(matched[0]!.matchStatus).toBe('matched')
  })

  it('drops rows whose expMz is outside the axis range', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C3H3O3+,M+H,87.0091,In
C3H3O3+,M+H,500.0,Out`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchWithCoarse(rows, { polarity: 'positive' }, axis, intensity, 10, 'ppm')
    expect(matched).toHaveLength(1)
    expect(matched[0]!.name).toBe('In')
  })

  it('keeps a row just beyond the axis edge when within tolerance', () => {
    // hi = 267.0739; 267.0740 is ~0.37 ppm away -> within the 10 ppm tolerance.
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C3H3O3+,M+H,267.0740,EdgeMatch`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchWithCoarse(rows, { polarity: 'positive' }, axis, intensity, 10, 'ppm')
    expect(matched).toHaveLength(1)
    expect(matched[0]!.matchStatus).toBe('matched')
  })

  it('still marks rows outside tolerance (but in range) as unmatched', () => {
    // 100.0 is within [87.0088, 267.0739] but never within 10 ppm of any peak.
    const csv = `Exp. m/z,Candidate_1\n100.0,BetweenPeaks`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchWithCoarse(rows, { polarity: 'positive' }, axis, intensity, 10, 'ppm')
    expect(matched[0]!.matchStatus).toBe('unmatched')
  })

  it('keeps invalid-mz rows visible as invalid regardless of filter', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
-,M-H,N/A,BadMz`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchWithCoarse(rows, { polarity: 'positive' }, axis, intensity, 10, 'ppm')
    expect(matched).toHaveLength(1)
    expect(matched[0]!.matchStatus).toBe('invalid')
  })

  it('coarse filter with no axis still drops opposite-polarity rows', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C3H3O3+,M+H,87.0091,P
C3H3O3-,M-H,89.0246,N`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchWithCoarse(rows, { polarity: 'positive' }, null, null, 10, 'ppm')
    expect(matched).toHaveLength(1)
    expect(matched[0]!.name).toBe('P')
    expect(matched[0]!.matchStatus).toBe('unmatched')
  })

  it('coarseFilterKey is field-agnostic: any added filter field changes the key', () => {
    // Cache invalidation must cover filter fields added later without anyone
    // registering them - pin the canonicalization rules that make that true.
    expect(coarseFilterKey(undefined)).toBe('')
    expect(coarseFilterKey(null)).toBe('')
    expect(coarseFilterKey({})).toBe('')
    expect(coarseFilterKey({ polarity: null })).toBe('')
    expect(coarseFilterKey({ polarity: 'positive' })).not.toBe('')
    expect(coarseFilterKey({ polarity: 'positive' })).not.toBe(
      coarseFilterKey({ polarity: 'negative' }),
    )
    // a hypothetical future field shows up in the key without code changes
    expect(coarseFilterKey({ polarity: 'positive', ...({ maxMz: 500 } as object) })).not.toBe(
      coarseFilterKey({ polarity: 'positive' }),
    )
  })

  it('keeps a boundary-peak match just past the ppm high-edge margin', () => {
    // massErrorOf divides by the ROW's expMz, so the true upper keep-bound is
    // hi/(1-t), not hi*(1+t). hi=1000, t=100 ppm: true cutoff 1000.10001;
    // 1000.100005 sits inside it (err ~ 99.995 ppm) and must be matched, while
    // 1000.10002 (err ~ 100.009 ppm) is genuinely out.
    const edgeAxis = Float64Array.of(500, 1000)
    const edgeIntensity = Float32Array.of(10, 20)
    const csv = `Exp. m/z,Candidate_1
1000.100005,EdgeIn
1000.10002,EdgeOut`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchWithCoarse(rows, {}, edgeAxis, edgeIntensity, 100, 'ppm')
    expect(matched).toHaveLength(1)
    expect(matched[0]!.name).toBe('EdgeIn')
    expect(matched[0]!.matchStatus).toBe('matched')
    expect(matched[0]!.matchedIndex).toBe(1)
  })
})

describe('runMatchPipeline', () => {
  const axis = Float64Array.of(87.0088, 89.0244, 124.0078, 267.0739)
  const intensity = Float32Array.of(10, 20, 30, 50)

  it('reports coarse-filter drops, isobar collapses and dup drops explicitly', () => {
    // P1/P2: same m/z isobars (merge). N1: negative row dropped by the polarity
    // filter. OUT: beyond the axis range (dropped). BAD: invalid row.
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C3H3O3+,M+H,87.0091,P1
C3H3O3+,M+H,87.0091,P2
C3H3O3-,M-H,89.0246,N1
C3H3O3+,M+H,500.0,OUT
-,M+H,N/A,BAD`
    const { rows } = parseAnnotationCsv(csv)
    const res = runMatchPipeline(rows, {
      mzAxis: axis,
      meanIntensity: intensity,
      tolerance: 10,
      mode: 'ppm',
      coarse: { polarity: 'positive' },
    })
    expect(res.rows).toHaveLength(2) // merged isobar group + invalid row
    expect(res.coarseFiltered).toBe(2) // N1 (polarity) + OUT (m/z range)
    expect(res.collapsed).toBe(1) // P2 merged onto P1
    expect(res.droppedDuplicates).toBe(0)
    expect(res.statusCounts).toEqual({ total: 2, matched: 1, unmatched: 0, invalid: 1 })
    expect(res.rows[0]!.candidates).toEqual(['P1', 'P2'])
  })

  it('sorts the collapsed set when a key/dir is supplied', () => {
    const csv = `Exp. m/z,Candidate_1
89.0244,B
87.0088,A`
    const { rows } = parseAnnotationCsv(csv)
    const res = runMatchPipeline(rows, {
      mzAxis: axis,
      meanIntensity: intensity,
      tolerance: 10,
      mode: 'ppm',
      sortKey: 'name',
      sortDir: 'asc',
    })
    expect(res.rows.map((r) => r.name)).toEqual(['A', 'B'])
  })
})

describe('collapseRows input immutability', () => {
  it('never mutates the input rows own candidates/alt arrays', () => {
    // Regression: matchAnnotations shallow-spreads rows, so rep.candidates is
    // the SAME array the caller (worker) keeps in its parsed cache. A merge
    // that pushed into it would pollute every later rematch.
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C40H66O5,M+H,627.498302,Anhydride
C40H66O5,M+H,627.498302,DG 17:2/20:4`
    const { rows: parsed } = parseAnnotationCsv(csv)
    const matched = matchAnnotations(
      parsed,
      Float64Array.of(627.4983),
      Float32Array.of(10),
      10,
      'ppm',
    )
    const repBefore = matched[0]!.candidates
    const otherBefore = matched[1]!.candidates
    const { rows } = collapseRows(matched)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.candidates).toEqual(['Anhydride', 'DG 17:2/20:4'])
    // the input rows (and any parsed cache sharing their arrays) are untouched
    expect(matched[0]!.candidates).toBe(repBefore)
    expect(matched[0]!.candidates).toEqual(['Anhydride'])
    expect(matched[1]!.candidates).toBe(otherBefore)
    expect(parsed[0]!.candidates).toEqual(['Anhydride'])
  })
})

describe('helpers', () => {
  it('findClosestIndex returns nearest value index', () => {
    const a = Float64Array.of(10, 20, 30, 40)
    expect(findClosestIndex(a, 22)).toBe(1)
    expect(findClosestIndex(a, 9)).toBe(0)
    expect(findClosestIndex(a, 100)).toBe(3)
    expect(findClosestIndex(a, 0)).toBe(0)
  })

  it('formatMassError respects mode', () => {
    expect(formatMassError(1.23, 'ppm')).toBe('1.23')
    expect(formatMassError(0.00012, 'Da')).toBe('0.0001')
    expect(formatMassError(null, 'ppm')).toBe('-')
  })

  it('massErrorOf computes ppm vs Da', () => {
    expect(massErrorOf(100, 100.0001, 'ppm')).toBeCloseTo(1, 4)
    expect(massErrorOf(100, 100.0001, 'Da')).toBeCloseTo(0.0001, 6)
  })
})
