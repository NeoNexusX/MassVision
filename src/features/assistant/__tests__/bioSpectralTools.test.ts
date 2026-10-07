import { describe, expect, it } from 'vitest'
import {
  searchHmdbIndex,
  massSearchHmdbIndex,
  type HmdbRow,
} from '../tools/bioTools'
import { parsePeakList, matchedPeakCount } from '../tools/spectralTools'
import { ADDUCTS } from '../tools/knowledgeTools'

const HMDB: HmdbRow[] = [
  [
    'HMDB00165',
    'L-Malic acid',
    'C4H6O5',
    134.021528,
    'C00149',
    ['Cytoplasm', 'Mitochondria'],
    ['Diabetes mellitus'],
    'A dicarboxylic acid intermediate in the citric acid cycle.',
  ],
  [
    'HMDB0000122',
    'D-Glucose',
    'C6H12O6',
    180.063388,
    'C00031',
    ['Cytosol', 'Blood'],
    [],
    'Primary energy source.',
  ],
  [
    'HMDB0000673',
    'Caffeine',
    'C8H10N4O2',
    194.080375,
    'C07481',
    [],
    [],
    'A central nervous system stimulant.',
  ],
]

describe('searchHmdbIndex', () => {
  it('matches names case/punctuation-insensitively', () => {
    const hits = searchHmdbIndex(HMDB, 'l malic', 5)
    expect(hits).toHaveLength(1)
    expect(hits[0]![0]).toBe('HMDB00165')
  })

  it('matches accession fragments', () => {
    expect(searchHmdbIndex(HMDB, 'hmdb0000673', 5)).toHaveLength(1)
  })

  it('caps results', () => {
    expect(searchHmdbIndex(HMDB, 'e', 1)).toHaveLength(1)
  })
})

describe('massSearchHmdbIndex', () => {
  it('finds [M-H]- of malic acid within ppm and sorts by |Δppm|', () => {
    const neutral = HMDB[0]![3]!
    // 检索表语义：neutral = mz − shift → 离子 m/z = neutral + shift
    const shift = ADDUCTS.negative['[M-H]-']!
    const ionMz = neutral + shift
    expect(ionMz).toBeCloseTo(neutral - 1.007276, 6)
    const hits = massSearchHmdbIndex(HMDB, ionMz, 'negative', 10, 5)
    expect(hits[0]!.row[0]).toBe('HMDB00165')
    expect(hits[0]!.adduct).toBe('[M-H]-')
    expect(Math.abs(hits[0]!.ppm)).toBeLessThan(1)
  })
})

describe('spectralTools', () => {
  it('parses peak lists in "mz:int" and loose formats', () => {
    expect(parsePeakList('123.4:100, 125.2:55')).toEqual([
      { mz: 123.4, intensity: 100 },
      { mz: 125.2, intensity: 55 },
    ])
    expect(parsePeakList('123.4 100;125.2 55')).toHaveLength(2)
    expect(parsePeakList('garbage')).toEqual([])
  })

  it('counts matched library peaks within the window', () => {
    const lib = [
      [85.05, 59],
      [99.08, 100],
      [299.23, 95],
    ]
    const q = [
      { mz: 85.06, intensity: 50 }, // 命中 85.05（±0.5 Da）
      { mz: 120.0, intensity: 10 }, // 无对应
      { mz: 299.24, intensity: 90 }, // 命中 299.23
    ]
    const r = matchedPeakCount(lib, q)
    expect(r.matched).toBe(2)
    expect(r.libTotal).toBe(3)
    expect(r.queryTotal).toBe(3)
  })
})
