import { describe, expect, it } from 'vitest'
import { findClosestDisplayedMz } from '../spectrumSelection'

describe('findClosestDisplayedMz', () => {
  it('selects an exact displayed centroid peak', () => {
    const data = [
      [100.1, 2],
      [450.25, 8],
      [900.5, 4],
    ] as const
    expect(findClosestDisplayedMz(data, 450.25)).toBe(450.25)
  })

  it('selects the nearest real peak in a sparse spectrum', () => {
    const data = [
      [100, 2],
      [600, 8],
      [1200, 4],
    ] as const
    expect(findClosestDisplayedMz(data, 590)).toBe(600)
  })

  it('selects the lower peak when the target is exactly between two peaks', () => {
    const data = [
      [100, 8],
      [500, 4],
      [900, 2],
    ] as const
    expect(findClosestDisplayedMz(data, 300)).toBe(100)
  })

  it('clamps targets outside the displayed range to an endpoint', () => {
    const data = [
      [100, 8],
      [500, 4],
      [900, 2],
    ] as const
    expect(findClosestDisplayedMz(data, 50)).toBe(100)
    expect(findClosestDisplayedMz(data, 950)).toBe(900)
  })

  it('returns null for an empty spectrum or invalid target', () => {
    expect(findClosestDisplayedMz([], 100)).toBeNull()
    expect(findClosestDisplayedMz([[100, 1]], Number.NaN)).toBeNull()
  })
})
