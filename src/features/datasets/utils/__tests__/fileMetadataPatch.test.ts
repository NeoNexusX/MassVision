import { describe, expect, it } from 'vitest'
import { buildFileMetadataPatch, toFileMetadataDraft } from '../fileMetadataPatch'
import type { File } from '@/features/datasets/types/dataset'

const baseFile = {
  id: '7',
  name: 'kidney',
  submitTime: '2026-09-10T00:00:00',
  submitter: 'u',
  status: 'completed',
  isPublic: true,
  organism: 'Mouse',
  organismPart: 'Kidney',
  spectrumMode: 'profile',
} as File

describe('toFileMetadataDraft', () => {
  it('maps camelCase File fields into snake_case draft with "" defaults', () => {
    const draft = toFileMetadataDraft(baseFile)

    expect(draft.organism).toBe('Mouse')
    expect(draft.organism_part).toBe('Kidney')
    expect(draft.spectrum_mode).toBe('profile')
    expect(draft.maldi_matrix).toBe('') // 未填字段归一
    expect(draft.storage_mode).toBe('')
  })
})

describe('buildFileMetadataPatch', () => {
  it('returns an empty patch when nothing changed', () => {
    expect(buildFileMetadataPatch(baseFile, toFileMetadataDraft(baseFile))).toEqual({})
  })

  it('includes only changed keys with snake_case names', () => {
    const draft = toFileMetadataDraft(baseFile)
    draft.organism = 'Rat'
    draft.maldi_matrix = 'DHB (2,5-Dihydroxybenzoic acid)'

    expect(buildFileMetadataPatch(baseFile, draft)).toEqual({
      organism: 'Rat',
      maldi_matrix: 'DHB (2,5-Dihydroxybenzoic acid)',
    })
  })

  it('sends text fields even when cleared to empty string', () => {
    const draft = toFileMetadataDraft(baseFile)
    draft.organism = ''

    expect(buildFileMetadataPatch(baseFile, draft)).toEqual({ organism: '' })
  })

  it('never sends an empty enum (spectrum_mode/storage_mode)', () => {
    const draft = toFileMetadataDraft(baseFile)
    draft.spectrum_mode = '' // 用户从 profile 改回占位 '—'
    draft.storage_mode = 'processed'

    expect(buildFileMetadataPatch(baseFile, draft)).toEqual({ storage_mode: 'processed' })
  })

  // 回归：solvent 曾被漏出可改字段清单（其余样本属性都能改，只有它改不了）
  it('round-trips solvent and sends it as a plain text field when changed', () => {
    const file = { ...baseFile, solvent: '50% Methanol (MeOH), 50% Water' } as File

    expect(toFileMetadataDraft(file).solvent).toBe('50% Methanol (MeOH), 50% Water')

    const draft = toFileMetadataDraft(file)
    draft.solvent = '100% Water'
    expect(buildFileMetadataPatch(file, draft)).toEqual({ solvent: '100% Water' })
  })
})
