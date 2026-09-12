import { describe, expect, it } from 'vitest'
import { deriveCollectionMetadata, DERIVED_METADATA_KEYS } from '../deriveCollectionMetadata'
import type { File } from '@/features/datasets/types/dataset'

const file = (over: Partial<File>): File => ({ id: '1', name: '', submitTime: '', submitter: '', status: 'completed', isPublic: true, ...over }) as File

describe('deriveCollectionMetadata', () => {
  it('returns every derived key as an empty array for an empty selection', () => {
    const result = deriveCollectionMetadata([])

    for (const key of DERIVED_METADATA_KEYS) {
      expect(result[key]).toEqual([])
    }
  })

  it('dedupes values across members and keeps first-seen order', () => {
    const result = deriveCollectionMetadata([
      file({ organism: 'Mouse (Mus musculus)', polarity: 'Negative' }),
      file({ organism: 'Human (Homo sapiens)', polarity: 'Negative' }),
      file({ organism: 'Mouse (Mus musculus)', polarity: 'Positive' }),
    ])

    expect(result.organism).toEqual(['Mouse (Mus musculus)', 'Human (Homo sapiens)'])
    expect(result.polarity).toEqual(['Negative', 'Positive'])
  })

  // 集合元数据的语义是「涵盖的取值集合」：成员不一致时保留全部，而不是取交集
  it('keeps divergent values instead of intersecting them', () => {
    const result = deriveCollectionMetadata([
      file({ organismPart: 'Brain' }),
      file({ organismPart: 'Kidney' }),
    ])

    expect(result.organism_part).toEqual(['Brain', 'Kidney'])
  })

  it('skips missing and whitespace-only values', () => {
    const result = deriveCollectionMetadata([
      file({ organism: '', sampleStabilization: '   ', tissueModification: undefined }),
      file({ organism: 'Rat (Rattus norvegicus)' }),
    ])

    expect(result.organism).toEqual(['Rat (Rattus norvegicus)'])
    expect(result.sample_stabilization).toEqual([])
    expect(result.tissue_modification).toEqual([])
  })

  it('maps camelCase File fields onto the snake_case collection keys', () => {
    const result = deriveCollectionMetadata([
      file({
        ionSource: 'MALDI',
        analyzer: 'TOF',
        sampleGrowthConditions: 'Dark, 22C',
      }),
    ])

    expect(result.ionisation_source).toEqual(['MALDI'])
    expect(result.analyzer).toEqual(['TOF'])
    expect(result.sample_growth_conditions).toEqual(['Dark, 22C'])
  })

  it('does not swallow a literal "0" in a text field', () => {
    const result = deriveCollectionMetadata([file({ polarity: '0' })])

    expect(result.polarity).toEqual(['0'])
  })
})
