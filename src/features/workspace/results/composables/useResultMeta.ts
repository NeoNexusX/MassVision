import { ref, watch, type Ref } from 'vue'
import { listMyProcesses, listUserFiles } from '@/features/datasets/api/datasetApi'
import { parseAlgorithms } from '@/features/workspace/utils/methodsNormalize'

export function useResultMeta(runId: Ref<string>) {
  const datasetName = ref('')
  const analyzer = ref('')
  const ionSource = ref('')
  const pixelSize = ref('')
  const polarity = ref('')
  const status = ref('')
  const methods = ref<string[]>([])
  const loading = ref(false)

  function extractBasename(filename: string): string {
    return filename.replace(/\.[^.]+$/, '')
  }

  function formatPixelSize(x?: number, y?: number): string {
    if (x != null && y != null) return `${x} × ${y} µm`
    return ''
  }

  async function fetchMeta(id: string) {
    loading.value = true
    try {
      const processes = await listMyProcesses()
      const process = processes.find((p: any) => String(p.id) === id)

      if (process) {
        datasetName.value = extractBasename(process.filename || '')
        status.value = process.status === 'OK' ? 'completed' : (process.status || '')

        if (process.params_json) {
          methods.value = parseAlgorithms(process.params_json)
        }

        // Fetch file metadata for instrument params
        if (process.filename) {
          try {
            const result = await listUserFiles({ filename: process.filename }, 1, 1)
            const file = result?.data?.[0] || result?.[0]
            if (file) {
              analyzer.value = file.analyzer || ''
              ionSource.value = file.ionisation_source || ''
              pixelSize.value = formatPixelSize(file.pixel_size_horizontal, file.pixel_size_vertical)
              polarity.value = file.polarity || ''
            }
          } catch {
            // file lookup is optional
          }
        }
      }
    } catch (e) {
      console.error('[useResultMeta] fetch failed:', e)
    } finally {
      loading.value = false
    }
  }

  watch(runId, (id) => {
    if (id) fetchMeta(id)
  }, { immediate: true })

  return { datasetName, analyzer, ionSource, pixelSize, polarity, status, methods, loading }
}
