import { describe, expect, it } from 'vitest'
import {
  buildCollectionCreatePayload,
  buildMetadataPatch,
  toDateStringInput,
  toMetadataDraft,
} from '../metadataPatch'
import type { CollectionMetadata } from '../../types/collection'

const current: CollectionMetadata = {
  name: 'Mouse kidney MSI',
  description: 'A curated set',
  title: 'Original title',
  doi: ['10.1000/a'],
  organism: ['mouse'],
  analyzer: ['FTICR'],
}

describe('toMetadataDraft', () => {
  it('normalizes missing values to "" / [] by field type', () => {
    const draft = toMetadataDraft(current)

    expect(draft.name).toBe('Mouse kidney MSI')
    expect(draft.abstract).toBe('') // 缺省的 long 字段
    expect(draft.polarity).toEqual([]) // 缺省的 list 字段
    expect(draft.doi).toEqual(['10.1000/a'])
  })

  it('copies list arrays so editing the draft does not mutate the source', () => {
    const draft = toMetadataDraft(current)
    draft.organism.push('rat')

    expect(current.organism).toEqual(['mouse'])
  })

  it('keeps legacy scalar list metadata when opening the editor', () => {
    const legacy = { name: 'X', member_type: 'MSI' } as unknown as CollectionMetadata

    expect(toMetadataDraft(legacy).member_type).toEqual(['MSI'])
    expect(buildMetadataPatch(legacy, toMetadataDraft(legacy))).toEqual({})
  })
})

describe('buildMetadataPatch', () => {
  it('returns an empty patch when nothing changed', () => {
    const draft = toMetadataDraft(current)

    expect(buildMetadataPatch(current, draft)).toEqual({})
  })

  it('includes only changed keys, with snake_case field names', () => {
    const draft = toMetadataDraft(current)
    draft.title = 'New title'
    draft.organism.push('rat')

    expect(buildMetadataPatch(current, draft)).toEqual({
      title: 'New title',
      organism: ['mouse', 'rat'],
    })
  })

  it('sends explicit empty values when a field is cleared', () => {
    const draft = toMetadataDraft(current)
    draft.doi = []
    draft.description = ''

    expect(buildMetadataPatch(current, draft)).toEqual({
      doi: [],
      description: '',
    })
  })

  it('treats null and undefined in current as empty when comparing', () => {
    const draft = toMetadataDraft({ name: 'X' })
    draft.abstract = 'An abstract'
    draft.polarity = ['negative']

    expect(buildMetadataPatch({ name: 'X' }, draft)).toEqual({
      abstract: 'An abstract',
      polarity: ['negative'],
    })
  })

  it('ignores array order differences as changes (order matters by design)', () => {
    const draft = toMetadataDraft(current)
    draft.organism = ['mouse']

    // 顺序相同 → 无变化
    expect(buildMetadataPatch(current, draft)).toEqual({})

    // 顺序不同 → 视为变化（position 语义对外露字段同样成立）
    draft.doi = ['10.1000/a']
    draft.analyzer = ['FTICR']
    expect(buildMetadataPatch(current, draft)).toEqual({})
  })
})

describe('date fields (publish_time)', () => {
  it('toDateStringInput takes the date part of an ISO string and rejects garbage', () => {
    expect(toDateStringInput('2024-05-01T08:00:00Z')).toBe('2024-05-01')
    expect(toDateStringInput('2024-05-01')).toBe('2024-05-01')
    expect(toDateStringInput(null)).toBe('')
    expect(toDateStringInput('not a date')).toBe('')
  })

  it('draft normalizes full ISO to date-only, so re-saving without edits sends nothing', () => {
    const withDate: CollectionMetadata = { ...current, publish_time: '2024-05-01T08:00:00Z' }
    const draft = toMetadataDraft(withDate)

    expect(draft.publish_time).toBe('2024-05-01')
    expect(buildMetadataPatch(withDate, draft)).toEqual({})
  })

  it('sends the date-only string when changed, and explicit empty when cleared', () => {
    const withDate: CollectionMetadata = { ...current, publish_time: '2024-05-01T08:00:00Z' }
    const draft = toMetadataDraft(withDate)
    draft.publish_time = '2025-01-15'
    expect(buildMetadataPatch(withDate, draft)).toEqual({ publish_time: '2025-01-15' })

    const cleared = toMetadataDraft(withDate)
    cleared.publish_time = ''
    expect(buildMetadataPatch(withDate, cleared)).toEqual({ publish_time: '' })
  })

  it('create payload omits an unset date and carries a picked one', () => {
    const draft = toMetadataDraft(current)
    draft.publish_time = '2024-05-01'
    expect(buildCollectionCreatePayload(draft, ['1']).publish_time).toBe('2024-05-01')

    const empty = toMetadataDraft(current)
    expect(buildCollectionCreatePayload(empty, ['1']).publish_time).toBeUndefined()
  })
})

describe('buildCollectionCreatePayload', () => {
  it('omits empty fields so the backend keeps its own defaults', () => {
    const draft = toMetadataDraft({ name: 'Mouse kidney MSI' })

    expect(buildCollectionCreatePayload(draft, ['qW3rT5yU7iO9pA1s', 'zX9cV8bN6mL4kJ2h'])).toEqual({
      name: 'Mouse kidney MSI',
      file_public_ids: ['qW3rT5yU7iO9pA1s', 'zX9cV8bN6mL4kJ2h'],
    })
  })

  it('carries non-empty text and list fields through unchanged', () => {
    const draft = toMetadataDraft({
      name: 'Mouse kidney MSI',
      description: 'A curated set',
      doi: ['10.1000/a'],
      organism: ['Mouse (Mus musculus)'],
    })

    expect(buildCollectionCreatePayload(draft, ['qW3rT5yU7iO9pA1s'])).toEqual({
      name: 'Mouse kidney MSI',
      file_public_ids: ['qW3rT5yU7iO9pA1s'],
      description: 'A curated set',
      doi: ['10.1000/a'],
      organism: ['Mouse (Mus musculus)'],
    })
  })

  it('treats whitespace-only text as empty and trims the rest', () => {
    const draft = toMetadataDraft({ name: 'X' })
    draft.title = '   '
    draft.journal_name = '  Nature Methods  '

    expect(buildCollectionCreatePayload(draft, ['zX9cV8bN6mL4kJ2h'])).toEqual({
      name: 'X',
      file_public_ids: ['zX9cV8bN6mL4kJ2h'],
      journal_name: 'Nature Methods',
    })
  })
})
