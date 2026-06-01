import { computed, onMounted, reactive, ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  usePreprocessingMethods,
  allMethodGroups,
  buildParamKey,
  buildDefaultMethodParams,
} from '@/features/workspace/analysis/composables/usePreprocessingMethods'
import { createProcess, getUserQuota, type UserQuota } from '@/features/datasets/api/datasetApi'
import { formatBytes } from '@/shared/utils/format'
import { extractBackendError } from '@/shared/api/httpClient'
import { useToast } from '@/shared/composables/useToast'
import { buildProcessPayload } from '@/features/workspace/analysis/services/buildProcessPayload'

export function useAnalysisBuilder(
  // Arguments
  selectedDataset: Ref<any>,
) {
  // External composables
  const router = useRouter()
  const { showToast } = useToast()

  // State
  const spectrumMode = ref('')
  const storageMode = ref('')
  const { availableMethods, isFiltered, modeNotice } = usePreprocessingMethods(
    spectrumMode,
    storageMode,
  )

  const selectedMethods = reactive<Record<string, string>>({})
  // 默认参数由方法定义生成（单一数据源，见 buildDefaultMethodParams），不再在此硬编码
  const methodParams = reactive(buildDefaultMethodParams())

  const analysisForm = reactive({
    polarity: '' as 'positive' | 'negative' | '',
    ionSource: '',
    analyzer: '',
    pixelSizeX: '',
    pixelSizeY: '',
  })

  const autoFilled = reactive({
    polarity: false,
    ionSource: false,
    analyzer: false,
    pixelSize: false,
  })

  const isPublic = ref(false)
  const quota = ref<UserQuota | null>(null)
  const quotaLoading = ref(false)
  const submitting = ref(false)

  allMethodGroups.forEach((group) => {
    selectedMethods[group.key] = ''
  })

  // Computed
  const totalSelectedCount = computed(() => {
    let sum = 0
    for (const value of Object.values(selectedMethods)) {
      if (value) sum += 1
    }
    return sum
  })

  const canSubmit = computed(() => {
    return !!selectedDataset.value && totalSelectedCount.value > 0 && !!analysisForm.polarity
  })

  const pipelineSummary = computed(() => {
    return availableMethods.value.map((group: any) => {
      const selected = selectedMethods[group.key]
      return {
        key: group.key,
        title: group.title,
        method: selected ? getMethodLabel(group.key, selected) : '',
        present: !!selected,
      }
    })
  })

  const msSettingsList = computed(() => {
    const list: Array<{ key: string; label: string; value: string }> = []
    if (analysisForm.polarity) {
      list.push({
        key: 'polarity',
        label: 'Polarity',
        value: analysisForm.polarity === 'positive' ? 'Positive' : 'Negative',
      })
    }
    if (analysisForm.ionSource) {
      list.push({ key: 'source', label: 'Ionisation Source', value: analysisForm.ionSource })
    }
    if (analysisForm.analyzer) {
      list.push({ key: 'analyzer', label: 'Analyzer', value: analysisForm.analyzer })
    }

    const px = analysisForm.pixelSizeX || ''
    const py = analysisForm.pixelSizeY || ''
    if (px && py) list.push({ key: 'pixel', label: 'Pixel', value: `${px}×${py} μm` })
    else if (px) list.push({ key: 'pixel', label: 'Pixel', value: `${px} μm` })
    else if (py) list.push({ key: 'pixel', label: 'Pixel', value: `${py} μm` })

    const dataset = selectedDataset.value
    if (dataset?.organism)
      list.push({ key: 'organism', label: 'Organism', value: dataset.organism })
    if (dataset?.organismPart) {
      list.push({ key: 'organismPart', label: 'Organism Part', value: dataset.organismPart })
    }
    if (dataset?.condition)
      list.push({ key: 'condition', label: 'Condition', value: dataset.condition })
    if (spectrumMode.value) {
      list.push({ key: 'spectrumMode', label: 'Spectrum Mode', value: spectrumMode.value })
    }
    if (storageMode.value) {
      list.push({ key: 'storageMode', label: 'Storage Mode', value: storageMode.value })
    }
    return list
  })

  const summaryReady = computed(() => {
    return (
      !!selectedDataset.value &&
      pipelineSummary.value.every((item: any) => item.present) &&
      !!analysisForm.polarity
    )
  })

  const statusBadge = computed(() => ({
    text: summaryReady.value ? 'Ready' : 'Incomplete',
    cls: summaryReady.value ? 'badge badge-success' : 'badge badge-warning',
  }))

  const estimateTimeDisplay = computed(() => {
    if (totalSelectedCount.value === 0) return 'Waiting for configuration'
    return `${totalSelectedCount.value * 3}–${totalSelectedCount.value * 5} min`
  })

  const quotaStorage = computed(() => {
    if (!quota.value) return '—'
    return `${formatBytes(quota.value.total_processed_size_bytes)} / ${quota.value.max_processing_size_gb} GB`
  })

  const quotaTasks = computed(() => {
    if (!quota.value) return '—'
    return `${quota.value.file_count} / ${quota.value.max_files_per_user}`
  })

  // Methods （buildParamKey 由 usePreprocessingMethods 导入，与默认值生成、载荷构建同源）
  const getParam = (groupKey: string, methodId: string, paramKey: string) =>
    methodParams[buildParamKey(groupKey, methodId, paramKey)]

  const setParam = (
    groupKey: string,
    methodId: string,
    paramKey: string,
    value: string | number,
  ) => {
    methodParams[buildParamKey(groupKey, methodId, paramKey)] = value
  }

  const onIntInput = (groupKey: string, methodId: string, paramKey: string, event: Event) => {
    const raw = (event.target as HTMLInputElement).value
    setParam(groupKey, methodId, paramKey, raw.replace(/[^0-9]/g, ''))
  }

  const onFloatInput = (groupKey: string, methodId: string, paramKey: string, event: Event) => {
    const raw = (event.target as HTMLInputElement).value
    setParam(groupKey, methodId, paramKey, raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))
  }

  const onNumBlur = (
    groupKey: string,
    methodId: string,
    paramKey: string,
    kind: 'int' | 'float',
  ) => {
    const raw = methodParams[buildParamKey(groupKey, methodId, paramKey)]
    if (raw === '' || raw === undefined) return
    const value = kind === 'int' ? parseInt(String(raw), 10) : parseFloat(String(raw))
    if (!isNaN(value)) setParam(groupKey, methodId, paramKey, value)
  }

  const isSelected = (groupKey: string, methodId: string) => selectedMethods[groupKey] === methodId

  const toggleSingle = (groupKey: string, methodId: string, event?: MouseEvent) => {
    event?.preventDefault()
    selectedMethods[groupKey] = isSelected(groupKey, methodId) ? '' : methodId
  }

  const getMethodLabel = (groupKey: string, id: string) => {
    const group = allMethodGroups.find((item: any) => item.key === groupKey)
    const method = group?.methods?.find((item: any) => item.id === id)
    return method?.label || id
  }

  const tryAutoFill = () => {
    Object.keys(autoFilled).forEach((key) => {
      ;(autoFilled as any)[key] = false
    })
    if (!selectedDataset.value) return
    const dataset = selectedDataset.value

    analysisForm.polarity = ''
    analysisForm.ionSource = ''
    analysisForm.analyzer = ''
    analysisForm.pixelSizeX = ''
    analysisForm.pixelSizeY = ''

    const polarity = (dataset.polarity || '').toString().toLowerCase()
    if (polarity) {
      analysisForm.polarity = polarity.includes('neg') ? 'negative' : 'positive'
      autoFilled.polarity = true
    }

    const source = (dataset.ionSource || '').toString().toLowerCase()
    if (source) {
      if (source.includes('maldi')) analysisForm.ionSource = 'MALDI'
      else if (source.includes('desi')) analysisForm.ionSource = 'DESI'
      else if (source.includes('sims')) analysisForm.ionSource = 'SIMS'
      else analysisForm.ionSource = dataset.ionSource
      autoFilled.ionSource = true
    }

    const analyzer = (dataset.analyzer || '').toString().toLowerCase()
    if (analyzer) {
      if (analyzer.includes('orbit')) analysisForm.analyzer = 'Orbitrap'
      else if (analyzer.includes('ft') || analyzer.includes('fticr'))
        analysisForm.analyzer = 'FTICR'
      else if (analyzer.includes('q') && analyzer.includes('tof')) analysisForm.analyzer = 'Q-TOF'
      else if (analyzer.includes('tof')) analysisForm.analyzer = 'TOF'
      else analysisForm.analyzer = dataset.analyzer
      autoFilled.analyzer = true
    }

    if (dataset.pixelSizeHorizontal != null) {
      analysisForm.pixelSizeX = String(dataset.pixelSizeHorizontal)
      autoFilled.pixelSize = true
    }
    if (dataset.pixelSizeVertical != null) {
      analysisForm.pixelSizeY = String(dataset.pixelSizeVertical)
      autoFilled.pixelSize = true
    }
  }

  const fetchQuota = async () => {
    quotaLoading.value = true
    try {
      quota.value = await getUserQuota()
    } catch {
      /* ignore */
    } finally {
      quotaLoading.value = false
    }
  }

  const submit = async () => {
    if (!canSubmit.value || submitting.value) return
    submitting.value = true
    try {
      const payload = buildProcessPayload({
        selectedDataset: selectedDataset.value,
        selectedMethods,
        methodParams,
        methodGroups: allMethodGroups,
        isPublic: isPublic.value,
      })
      await createProcess(payload)
      showToast('Analysis started', 'success')
      router.push('/workspace')
    } catch (error) {
      showToast(extractBackendError(error) || 'Failed to start analysis', 'error')
    } finally {
      submitting.value = false
    }
  }

  // Watchers
  watch(selectedDataset, (dataset) => {
    spectrumMode.value = dataset?.spectrumMode || ''
    storageMode.value = dataset?.storageMode || ''
    tryAutoFill()
  })

  // Lifecycle
  onMounted(fetchQuota)

  return {
    allMethodGroups,
    availableMethods,
    isFiltered,
    modeNotice,
    selectedMethods,
    methodParams,
    analysisForm,
    isPublic,
    quota,
    quotaLoading,
    quotaStorage,
    quotaTasks,
    submitting,
    totalSelectedCount,
    canSubmit,
    pipelineSummary,
    msSettingsList,
    statusBadge,
    estimateTimeDisplay,
    buildParamKey,
    getParam,
    setParam,
    onIntInput,
    onFloatInput,
    onNumBlur,
    isSelected,
    toggleSingle,
    getMethodLabel,
    submit,
  }
}
