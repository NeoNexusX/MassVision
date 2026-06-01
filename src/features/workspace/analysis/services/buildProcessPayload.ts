import { buildParamKey } from '@/features/workspace/analysis/composables/usePreprocessingMethods'

interface BuildProcessPayloadOptions {
  selectedDataset: any
  selectedMethods: Record<string, string>
  methodParams: Record<string, string | number>
  methodGroups: any[]
  isPublic: boolean
}

const BACKEND_ALGORITHM_KEYS: Record<string, string> = {
  noise: 'noise_reduction',
  baseline: 'baseline_correction',
  norm: 'normalization',
  pick: 'peak_pick',
  align: 'peak_align',
}

export function buildProcessPayload(options: BuildProcessPayloadOptions) {
  const algorithms: Record<string, any> = {}

  for (const group of options.methodGroups) {
    const methodId = options.selectedMethods[group.key]
    if (!methodId) continue

    const backendKey = BACKEND_ALGORITHM_KEYS[group.key]
    if (!backendKey) continue

    if (group.key === 'baseline') {
      algorithms[backendKey] = { method: methodId }
      continue
    }

    const method = group.methods.find((item: any) => item.id === methodId)
    if (!method) continue

    const params: Record<string, any> = { method: methodId }

    if (method.params) {
      for (const param of method.params) {
        const value = options.methodParams[buildParamKey(group.key, methodId, param.key)]
        if (
          (param.type === 'text' || param.type === 'float') &&
          (value === '' || value === undefined || value === 'none')
        ) {
          continue
        }
        params[param.key] = value ?? param.default
      }
    }

    if (backendKey === 'peak_pick' || backendKey === 'peak_align') {
      params.backend = 'python'
    }

    algorithms[backendKey] = params
  }

  return {
    file_id: Number(options.selectedDataset?.id) ?? 0,
    algorithms,
    is_public: options.isPublic,
  }
}
