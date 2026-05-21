import { computed, onMounted, reactive, ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  usePreprocessingMethods,
  allMethodGroups,
} from '@/features/workspace/analysis/composables/usePreprocessingMethods'
import { createProcess, getUserQuota, type UserQuota } from '@/features/datasets/api/datasetApi'
import { formatBytes } from '@/shared/utils/format'
import { buildProcessPayload } from '@/features/workspace/analysis/services/buildProcessPayload'

export function useAnalysisBuilder(selectedDataset: Ref<any>) {
  const router = useRouter()

  const spectrumMode = ref('')
  const storageMode = ref('')
  const { availableMethods, isFiltered, modeNotice } = usePreprocessingMethods(
    spectrumMode,
    storageMode,
  )

  const selectedMethods = reactive<Record<string, string>>({})
  const methodParams = reactive<Record<string, string | number>>({
    'noise.savgol_numba.window': 5,
    'noise.savgol_numba.polyorder': 3,
    'noise.savgol_numba.deriv': 0,
    'noise.savgol_numba.delta': 1.0,
    'noise.gaussian_numba.window': 5,
    'noise.gaussian_numba.sd': 2.0,
    'noise.ma_numba.window': 5,
    'norm.tic_numba.scale': 1.0,
    'norm.rms_numba.scale': 1.0,
    'norm.ref_numba.scale': 1.0,
    'norm.ref_numba.ref': '',
    'norm.ref_numba.ref_tolerance': 0.1,
    'pick.diff.method': 'diff',
    'pick.diff.snr': 2.0,
    'pick.diff.return_type': 'height',
    'pick.diff.width': 5,
    'align.align_py.tolerance': 'none',
    'align.align_py.units': 'ppm',
    'align.align_py.binfun': 'median',
    'align.align_py.binratio': 2.0,
  })

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

  const buildParamKey = (groupKey: string, methodId: string, paramKey: string) =>
    `${groupKey}.${methodId}.${paramKey}`

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

  watch(selectedDataset, (dataset) => {
    spectrumMode.value = dataset?.spectrumMode || ''
    storageMode.value = dataset?.storageMode || ''
    tryAutoFill()
  })

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
      const result = await createProcess(payload)
      console.log('Process created:', result)
      router.push('/workspace')
    } catch (error: any) {
      console.error('Failed to create process:', error)
      alert(error?.response?.data?.detail || error.message || 'Failed to start analysis')
    } finally {
      submitting.value = false
    }
  }

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
