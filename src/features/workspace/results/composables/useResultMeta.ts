import { ref, watch, type Ref } from 'vue'
import { getFileMetadata } from '@/features/datasets/api/datasetApi'

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

  function formatPixelSize(x?: number, y?: number): string {
    if (x != null && y != null) return `${x} × ${y} µm`
    return ''
  }

  /** Adjust displayed mode based on applied processing methods */
  function applyProcessingAdjustments() {
    const hasPeakPicking = methods.value.includes('Peak Picking')
    const hasPeakAlignment = methods.value.includes('Peak Alignment')

    if (hasPeakPicking) spectrumMode.value = 'centroid'
    if (hasPeakAlignment) storageMode.value = 'continuous'
  }

  async function fetchMeta(_id: string) {
    loading.value = true
    try {
      const state = history.state as ResultDetailState | null

      // Read process info directly from router state (passed by WorkspaceTable)
      datasetName.value = state?.datasetName || ''
      status.value = (state?.status || '').toLowerCase()
      methods.value = state?.methods || []

      // Fetch file metadata for instrument params
      const fileId = state?.fileId
      if (fileId != null) {
        try {
          const file = await getFileMetadata(fileId)
          if (file) {
            analyzer.value = file.analyzer || ''
            ionSource.value = file.ionisation_source || ''
            pixelSize.value = formatPixelSize(file.pixel_size_horizontal, file.pixel_size_vertical)
            polarity.value = file.polarity || ''
            spectrumMode.value = file.spectrum_mode || ''
            storageMode.value = file.storage_mode || ''
          }
        } catch {
          // file lookup is optional
        }
      }

      applyProcessingAdjustments()
    } catch (e) {
      console.error('[useResultMeta] fetch failed:', e)
    } finally {
      loading.value = false
    }
  }

  watch(runId, (id) => {
    if (id) fetchMeta(id)
  }, { immediate: true })

  return { datasetName, analyzer, ionSource, pixelSize, polarity, spectrumMode, storageMode, status, methods, loading }
}
