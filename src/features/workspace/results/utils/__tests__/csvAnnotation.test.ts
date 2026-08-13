import { describe, it, expect } from 'vitest'
import {
  parseAnnotationCsv,
  matchAnnotations,
  massErrorOf,
  findClosestIndex,
  inferRowPolarity,
  normalizeResultPolarity,
  CsvParseError,
  formatMassError,
} from '../csvAnnotation'

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
    const matched = matchAnnotations(rows, axis, intensity, 10, 'ppm', {
      polarity: 'negative',
    })
    // positive row dropped entirely (not even returned); negative kept + matched
    expect(matched).toHaveLength(1)
    expect(matched[0]!.name).toBe('NegMatch')
    expect(matched[0]!.matchStatus).toBe('matched')
  })

  it('keeps unknown-polarity rows even when a polarity filter is set', () => {
    // No adduct/formula sign -> inferable rows kept under any polarity filter.
    const csv = `Exp. m/z,Candidate_1\n87.0091,NoAdduct`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchAnnotations(rows, axis, intensity, 10, 'ppm', {
      polarity: 'positive',
    })
    expect(matched).toHaveLength(1)
    expect(matched[0]!.matchStatus).toBe('matched')
  })

  it('drops rows whose expMz is outside the axis range', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C3H3O3+,M+H,87.0091,In
C3H3O3+,M+H,500.0,Out`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchAnnotations(rows, axis, intensity, 10, 'ppm', {
      polarity: 'positive',
    })
    expect(matched).toHaveLength(1)
    expect(matched[0]!.name).toBe('In')
  })

  it('keeps a row just beyond the axis edge when within tolerance', () => {
    // hi = 267.0739; 267.0740 is ~0.37 ppm away -> within the 10 ppm tolerance.
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C3H3O3+,M+H,267.0740,EdgeMatch`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchAnnotations(rows, axis, intensity, 10, 'ppm', {
      polarity: 'positive',
    })
    expect(matched).toHaveLength(1)
    expect(matched[0]!.matchStatus).toBe('matched')
  })

  it('still marks rows outside tolerance (but in range) as unmatched', () => {
    // 100.0 is within [87.0088, 267.0739] but never within 10 ppm of any peak.
    const csv = `Exp. m/z,Candidate_1\n100.0,BetweenPeaks`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchAnnotations(rows, axis, intensity, 10, 'ppm', {
      polarity: 'positive',
    })
    expect(matched[0]!.matchStatus).toBe('unmatched')
  })

  it('keeps invalid-mz rows visible as invalid regardless of filter', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
-,M-H,N/A,BadMz`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchAnnotations(rows, axis, intensity, 10, 'ppm', {
      polarity: 'positive', // would drop a valid negative row, but invalid stays
    })
    expect(matched).toHaveLength(1)
    expect(matched[0]!.matchStatus).toBe('invalid')
  })

  it('coarse filter with no axis still drops opposite-polarity rows', () => {
    const csv = `formula_ion,Ion type,Exp. m/z,Candidate_1
C3H3O3+,M+H,87.0091,P
C3H3O3-,M-H,89.0246,N`
    const { rows } = parseAnnotationCsv(csv)
    const matched = matchAnnotations(rows, null, null, 10, 'ppm', {
      polarity: 'positive',
    })
    expect(matched).toHaveLength(1)
    expect(matched[0]!.name).toBe('P')
    expect(matched[0]!.matchStatus).toBe('unmatched')
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
