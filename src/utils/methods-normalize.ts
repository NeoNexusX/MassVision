export const STANDARD_METHODS: Record<string, string> = {
  'TIC': 'TIC Normalization',
  'RMS': 'RMS Normalization',
  'Median': 'Median Normalization',
  'Baseline correction': 'Baseline Correction',
  'Gaussian': 'Gaussian Smoothing',
  'Median Filtering': 'Median Filtering',
  'Savitzky–Golay': 'Savitzky–Golay Smoothing',
  'Peak Picking': 'Peak Picking',
  'Spectral Alignment': 'Spectral Alignment',
  'm/z Binning': 'm/z Binning',
  'Log Intensity Transform': 'Log Intensity Transform',
  'm/z Recalibration': 'm/z Recalibration'
}

export function formatMethods(methods: Array<string> | undefined) {
  if (!methods || methods.length === 0) return ''
  const mapped = methods.map(m => {
    const key = String(m).trim()
    return STANDARD_METHODS[key] || key
  })
  return mapped.join(' + ')
}
