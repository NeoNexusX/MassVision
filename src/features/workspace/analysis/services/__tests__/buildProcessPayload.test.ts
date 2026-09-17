import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/workspace/analysis/composables/usePreprocessingMethods', () => ({
  buildParamKey: (group: string, method: string, key: string) => `${group}.${method}.${key}`,
}))

import { buildProcessPayload } from '../buildProcessPayload'

const PUBLIC_ID = 'qW3rT5yU7iO9pA1s'

describe('buildProcessPayload', () => {
  it('sends the source file as a 16-char file_public_id string, never a numeric file_id', () => {
    const payload = buildProcessPayload({
      selectedDataset: { publicId: PUBLIC_ID } as any,
      selectedMethods: {},
      methodParams: {},
      methodGroups: [],
    })

    expect(payload.file_public_id).toBe(PUBLIC_ID)
    expect(typeof payload.file_public_id).toBe('string')
    expect(payload).not.toHaveProperty('file_id')
    expect(payload.algorithms).toEqual({})
  })

  it('carries baseline method selection into algorithms', () => {
    const payload = buildProcessPayload({
      selectedDataset: { publicId: PUBLIC_ID } as any,
      selectedMethods: { baseline: 'polynomial' },
      methodParams: {},
      methodGroups: [
        { key: 'baseline', methods: [{ id: 'polynomial' }] },
      ] as any,
    })

    expect(payload.file_public_id).toBe(PUBLIC_ID)
    expect(payload.algorithms.baseline_correction).toEqual({ method: 'polynomial' })
  })
})
