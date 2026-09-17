/**
 * Build ECharts [m/z, intensity] pairs from index-aligned m/z / intensity
 * arrays. Non-finite intensities are always dropped.
 *
 * 零值只在 keepZeros 时保留：profile 模式下相邻点由折线连接，过滤掉零值会让
 * ECharts 在两个"幸存点"之间画直线穿过整段空白区，凭空连出并不存在的信号，
 * 所以 profile 模式必须保留零值；centroid 模式每个峰是独立的 bar，过滤零值
 * 只是省去数万个空 bar，不影响视觉。
 */
export function buildSpectrumChartData(
  mz: ArrayLike<number>,
  intensity: ArrayLike<number>,
  keepZeros: boolean,
): [number, number][] {
  const length = Math.min(mz.length, intensity.length)
  const data: [number, number][] = []
  for (let i = 0; i < length; i++) {
    const v = intensity[i]!
    if (!Number.isFinite(v)) continue
    if (keepZeros || v !== 0) data.push([mz[i]!, v])
  }
  return data
}

export function formatSpectrumIntensity(value: number): string {
  if (value === 0) return '0'
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}e6`
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}e3`
  if (Math.abs(value) < 0.01) return value.toExponential(1)
  return value.toFixed(1)
}
