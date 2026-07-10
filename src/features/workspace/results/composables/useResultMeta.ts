import { ref, watch, type Ref } from 'vue'
import { metadataAttrsRef, dataModeRef } from '@/features/workspace/results/composables/useZarrIonImage'
import type { DataMode } from '@/services/zarrOssStore'

interface ResultDetailState {
  runId?: string
  processName?: string
  datasetName?: string
  filename?: string
  fileId?: number
  methods?: string[]
  status?: string
}

export function useResultMeta(runId: Ref<string>) {
  const datasetName = ref('')
  const analyzer = ref('')
  const ionSource = ref('')
  const pixelSize = ref('')
  const polarity = ref('')
  const spectrumMode = ref('')
  const storageMode = ref('')
  const status = ref('')
  const methods = ref<string[]>([])
  const loading = ref(false)

  /** 当前数据模式（continuous / processed），从 zarr store 获取 */
  const dataMode = ref<DataMode | null>(null)

  function formatPixelSize(x?: number, y?: number): string {
    if (x != null && y != null) return `${x} × ${y} µm`
    return ''
  }

  /** 从 zarr metadata/zarr.json 读取所有元数据 */
  function applyZarrMetadata() {
    const attrs = metadataAttrsRef.value
    if (!attrs) return

    // 谱图模式
    if (attrs.centroid_spectrum) spectrumMode.value = 'centroid'
    else if (attrs.profile_spectrum) spectrumMode.value = 'profile'

    // 数据模式
    dataMode.value = dataModeRef.value

    // 仪器型号
    if (attrs.analyzer) analyzer.value = attrs.analyzer

    // 离子源
    if (attrs.ionisation_source) ionSource.value = attrs.ionisation_source

    // 极性
    if (attrs.polarity) polarity.value = attrs.polarity

    // 存储模式
    if (attrs.continuous) storageMode.value = 'continuous'
    else if (attrs.processed) storageMode.value = 'processed'

    // 像素大小
    if (attrs.pixel_size_horizontal != null && attrs.pixel_size_vertical != null) {
      pixelSize.value = formatPixelSize(attrs.pixel_size_horizontal, attrs.pixel_size_vertical)
    }

    // 数据集名称（zarr 有则用，否则沿用 router state）
    if (attrs.name && !datasetName.value) {
      datasetName.value = attrs.name
    }
  }

  function fetchMeta(_id: string) {
    loading.value = true
    try {
      const state = history.state as ResultDetailState | null

      // 从 router state 读取 process 层面的信息
      datasetName.value = state?.datasetName || ''
      status.value = (state?.status || '').toLowerCase()
      methods.value = state?.methods || []

      // 从 zarr metadata 覆盖/补充元数据
      applyZarrMetadata()
    } catch (e) {
      console.error('[useResultMeta] fetch failed:', e)
    } finally {
      loading.value = false
    }
  }

  // 当 runId 变化时重新获取
  watch(runId, (id) => {
    if (id) fetchMeta(id)
  }, { immediate: true })

  // 当 zarr metadata 加载完成后更新（store.init() 会设置 metadataAttrsRef）
  watch(metadataAttrsRef, () => {
    applyZarrMetadata()
  })

  // 当 dataMode 变化时同步
  watch(dataModeRef, (mode) => {
    dataMode.value = mode
  })

  return {
    datasetName,
    analyzer,
    ionSource,
    pixelSize,
    polarity,
    spectrumMode,
    storageMode,
    status,
    methods,
    loading,
    dataMode,
  }
}
