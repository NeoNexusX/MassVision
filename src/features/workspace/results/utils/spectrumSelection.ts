export type SpectrumPoint = readonly [mz: number, intensity: number]

/**
 * Return the real displayed m/z value nearest to a click-derived target.
 *
 * A centroid spectrum can be very sparse, so a viewport-derived tolerance can
 * silently reject clicks that are not close enough to a peak centre. Selecting
 * from the rendered data itself guarantees that the emitted value belongs to
 * the shared m/z axis. Spectrum data preserves the ascending order of that
 * axis, so lookup uses binary search.
 */
export function findClosestDisplayedMz(
  data: ReadonlyArray<SpectrumPoint>,
  target: number,
): number | null {
  if (!data.length || !Number.isFinite(target)) return null

  const lastIndex = data.length - 1
  if (target <= data[0]![0]) return data[0]![0]
  if (target >= data[lastIndex]![0]) return data[lastIndex]![0]

  // Lower bound: first displayed m/z greater than or equal to target.
  let lo = 0
  let hi = lastIndex
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (data[mid]![0] < target) lo = mid + 1
    else hi = mid
  }

  const previousMz = data[lo - 1]![0]
  const nextMz = data[lo]![0]
  return target - previousMz <= nextMz - target ? previousMz : nextMz
}
