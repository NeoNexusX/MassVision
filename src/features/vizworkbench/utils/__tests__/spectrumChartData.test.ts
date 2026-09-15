import { describe, expect, it } from 'vitest'
import { buildSpectrumChartData } from '../spectrumChartData'

describe('buildSpectrumChartData', () => {
  const mz = new Float64Array([100, 200, 300, 400, 500])
  const intensity = new Float32Array([5, 0, Number.NaN, 7, Number.POSITIVE_INFINITY])

  it('drops zeros and non-finite values for bar (centroid) spectra', () => {
    expect(buildSpectrumChartData(mz, intensity, false)).toEqual([
      [100, 5],
      [400, 7],
    ])
  })

  it('keeps zeros for line (profile) spectra but still drops non-finite values', () => {
    expect(buildSpectrumChartData(mz, intensity, true)).toEqual([
      [100, 5],
      [200, 0],
      [400, 7],
    ])
  })

  it('stops at the shorter array when lengths differ', () => {
    expect(buildSpectrumChartData(mz, new Float32Array([1, 2]), false)).toEqual([
      [100, 1],
      [200, 2],
    ])
  })
})
