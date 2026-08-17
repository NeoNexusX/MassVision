import { ref, watch, type Ref } from 'vue'
import { metadataAttrsRef, dataModeRef } from '@/features/workspace/results/composables/useZarrIonImage'
import { listMyProcesses, listUserFiles } from '@/features/datasets/api/datasetApi'
import { parseAlgorithms } from '@/features/workspace/utils/methodsNormalize'
import type { DataMode } from '@/services/zarr/types/zarr'

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

  function extractBasename(filename: string): string {
    return filename.replace(/\.[^.]+$/, '')
  }

  /** Adjust displayed mode based on applied processing methods */
  function applyProcessingAdjustments() {
    if (methods.value.includes('Peak Picking')) spectrumMode.value = 'centroid'
    if (methods.value.includes('Peak Alignment')) storageMode.value = 'continuous'
  }

  /**
   * API 兜底：history.state 只随 router.push 携带，直刷/书签进入时为空。
   * 此时回退到原接口查询 process（名称/状态/methods）与文件仪器参数，
   * 只填充当前仍为空缺的字段；zarr metadata 仍由 applyZarrMetadata 补充。
   */
  async function fetchProcessMetaFromApi(id: string) {
    const needProcess = !datasetName.value || !status.value || !methods.value.length
    const needInstrument = !analyzer.value && !ionSource.value && !polarity.value
    if (!needProcess && !needInstrument) return

    const result = await listMyProcesses(1, 100)
    const process = (result.data || []).find((p: any) => String(p.id) === id)
    if (!process) return

    if (needProcess) {
      if (!datasetName.value) datasetName.value = extractBasename(process.filename || '')
      if (!status.value) status.value = (process.status || '').toLowerCase()
      if (!methods.value.length && process.params_json) {
        methods.value = parseAlgorithms(process.params_json)
      }
    }

    // 仪器参数：zarr attrs 缺失时从文件元数据补齐
    if (process.filename) {
      try {
        const fileResult = await listUserFiles({ filename: process.filename }, 1, 1)
        const file = fileResult?.data?.[0] || fileResult?.[0]
        if (file) {
          if (!analyzer.value) analyzer.value = file.analyzer || ''
          if (!ionSource.value) ionSource.value = file.ionisation_source || ''
          if (!pixelSize.value) {
            pixelSize.value = formatPixelSize(file.pixel_size_horizontal, file.pixel_size_vertical)
          }
          if (!polarity.value) polarity.value = file.polarity || ''
          if (!spectrumMode.value) spectrumMode.value = file.spectrum_mode || ''
          if (!storageMode.value) storageMode.value = file.storage_mode || ''
        }
      } catch {
        // file lookup is optional
      }
    }

    applyProcessingAdjustments()
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

  let requestId = 0

  async function fetchMeta(id: string) {
    const currentRequest = ++requestId
    loading.value = true
    try {
      const state = history.state as ResultDetailState | null

      // 从 router state 读取 process 层面的信息
      datasetName.value = state?.datasetName || ''
      status.value = (state?.status || '').toLowerCase()
      methods.value = state?.methods || []

      // 从 zarr metadata 覆盖/补充元数据
      applyZarrMetadata()

      // history.state 缺失时（直刷/书签进入）回退到 API 查询
      await fetchProcessMetaFromApi(id)

      // 过期请求丢掉结果（快速切换 runId 时避免旧数据覆盖新数据）
      if (currentRequest !== requestId) return
    } catch (e) {
      if (currentRequest !== requestId) return
      console.error('[useResultMeta] fetch failed:', e)
    } finally {
      if (currentRequest === requestId) loading.value = false
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
