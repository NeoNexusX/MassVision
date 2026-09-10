import { describe, expect, it } from 'vitest'
import { mapCollectionDetail, mapCollectionSummary } from '../collectionMapper'

const detailRaw = {
  id: 7,
  name: 'Mouse kidney MSI',
  description: 'A curated set',
  member_count: 3,
  total_size: 1024,
  owner_username: 'lyk',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-09T00:00:00Z',
  public_id: 'a'.repeat(32),
  metadata: {
    name: 'Mouse kidney MSI',
    description: 'A curated set',
    doi: ['10.1000/xyz'],
    organism: ['mouse'],
    analyzer: ['FTICR'],
  },
  members: [
    { file_id: 42, filename: 'kidney1.imzML', size: 100, status: 'completed', is_public: true, experiment_type: 'imzML' },
    { file_id: 7 },
  ],
}

describe('mapCollectionDetail', () => {
  it('maps top-level snake_case into camelCase and keeps metadata as-is', () => {
    const d = mapCollectionDetail(detailRaw)

    expect(d.id).toBe(7)
    expect(d.memberCount).toBe(3)
    expect(d.totalSize).toBe(1024)
    expect(d.ownerUsername).toBe('lyk')
    expect(d.publicId).toBe('a'.repeat(32))
    expect(d.updatedAt).toBe('2026-09-09T00:00:00Z')
    // metadata 块透传不转 camel
    expect(d.metadata).toEqual(detailRaw.metadata)
    expect(d.metadata.doi).toEqual(['10.1000/xyz'])
  })

  it('maps members defensively: missing fields get defaults', () => {
    const d = mapCollectionDetail(detailRaw)

    expect(d.members).toHaveLength(2)
    expect(d.members[0]).toEqual({
      id: 42,
      filename: 'kidney1.imzML',
      size: 100,
      status: 'completed',
      isPublic: true,
      experimentType: 'imzML',
    })
    expect(d.members[1]).toEqual({
      id: 7,
      filename: '',
      size: 0,
      status: '',
      isPublic: false,
      experimentType: null,
    })
  })

  it('falls back to top-level organism when the list row lacks it', () => {
    const d = mapCollectionDetail({ ...detailRaw, organism: ['rat', 'mouse'] })
    expect(d.organism).toEqual(['rat', 'mouse'])
  })

  it('falls back to metadata.organism when neither top-level organism nor members exist', () => {
    const d = mapCollectionDetail({ ...detailRaw, organism: undefined })
    expect(d.organism).toEqual(['mouse'])
  })

  it('tolerates empty payload', () => {
    const d = mapCollectionDetail({})
    expect(d.id).toBeUndefined()
    expect(d.memberCount).toBe(0)
    expect(d.members).toEqual([])
    expect(d.metadata).toEqual({ name: '' })
  })
})

describe('mapCollectionSummary', () => {
  it('maps list rows without touching members', () => {
    const s = mapCollectionSummary({
      id: 1,
      name: 'X',
      member_count: 2,
      total_size: 5,
      owner_username: 'u',
      organism: ['mouse'],
      updated_at: '2026-09-10T00:00:00Z',
    })

    expect(s).toMatchObject({
      id: 1,
      name: 'X',
      memberCount: 2,
      totalSize: 5,
      ownerUsername: 'u',
      organism: ['mouse'],
      publicId: null,
      title: null,
    })
  })
})
