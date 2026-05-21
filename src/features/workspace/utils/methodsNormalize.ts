/**
 * Unified label map: backend key → display name.
 * Keys come from /processes/mine params_json.
 */
const METHOD_LABELS: Record<string, string> = {
  noise_reduction: 'Noise Reduction',
  baseline_correction: 'Baseline Correction',
  normalization: 'Normalization',
  peak_pick: 'Peak Picking',
  peak_align: 'Peak Alignment',
}

export function parseAlgorithms(paramsJson: string): string[] {
  try {
    const params = JSON.parse(paramsJson)
    const algos = params.algorithms || params
    return Object.entries(algos)
      .filter(([_, v]) => v != null)
      .map(([k]) => METHOD_LABELS[k] || k)
  } catch {
    return []
  }
}
