import { buildParamKey } from '@/features/workspace/analysis/composables/usePreprocessingMethods'

interface BuildProcessPayloadOptions {
  selectedDataset: any
  selectedMethods: Record<string, string>
  methodParams: Record<string, string | number>
  methodGroups: any[]
}

const BACKEND_ALGORITHM_KEYS: Record<string, string> = {
  noise: 'noise_reduction',
  baseline: 'baseline_correction',
  norm: 'normalization',
  pick: 'peak_pick',
  align: 'peak_align',
}

/**
 * 读取某方法的参数写入 params：text/float 类型的空值（'' / undefined / 'none'）跳过，
 * 其余取用户输入，缺省回落到参数默认值。align 与通用分支共用。
 */
function collectParams(
  options: BuildProcessPayloadOptions,
  groupKey: string,
  methodId: string,
  method: any,
  params: Record<string, any>,
) {
  if (!method?.params) return
  for (const param of method.params) {
    const value = options.methodParams[buildParamKey(groupKey, methodId, param.key)]
    if (
      (param.type === 'text' || param.type === 'float') &&
      (value === '' || value === undefined || value === 'none')
    ) {
      continue
    }
    params[param.key] = value ?? param.default
  }
}

export function buildProcessPayload(options: BuildProcessPayloadOptions) {
  const algorithms: Record<string, any> = {}

  for (const group of options.methodGroups) {
    const methodId = options.selectedMethods[group.key]
    if (!methodId) continue

    const backendKey = BACKEND_ALGORITHM_KEYS[group.key]
    if (!backendKey) continue

    if (group.key === 'align') {
      // peak_align has no "method" field in backend spec
      const method = group.methods.find((item: any) => item.id === methodId)
      const params: Record<string, any> = {}

      collectParams(options, group.key, methodId, method, params)

      params.units = 'ppm'
      params.binratio = 2

      algorithms[backendKey] = params
      continue
    }

    if (group.key === 'baseline') {
      algorithms[backendKey] = { method: methodId }
      continue
    }

    const method = group.methods.find((item: any) => item.id === methodId)
    if (!method) continue

    const params: Record<string, any> = { method: methodId }

    collectParams(options, group.key, methodId, method, params)

    if (backendKey === 'peak_pick') {
      params.backend = 'python'
    }

    algorithms[backendKey] = params
  }

  return {
    file_id: Number(options.selectedDataset?.id) ?? 0,
    algorithms,
  }
}
