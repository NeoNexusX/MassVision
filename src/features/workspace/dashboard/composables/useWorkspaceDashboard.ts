import { computed, onMounted, ref } from 'vue'
import { listMyProcesses, listUserFiles } from '@/features/datasets/api/datasetApi'
import { parseAlgorithms } from '@/features/workspace/utils/methodsNormalize'

export interface ProcessItem {
  id: number
  status: string
  params_json: string
  source_file_id: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  error_message: string | null
}

export function useWorkspaceDashboard() {
  // State
  const processes = ref<ProcessItem[]>([])
  const fileNames = ref<Record<number, string>>({})
  const loading = ref(false)
  const createOpen = ref(false)

  // Computed
  const tasks = computed(() =>
    processes.value
      .filter((p) => ['processing', 'queued'].includes(p.status))
      .map((p) => ({
        id: String(p.id),
        name: `Process #${p.id}`,
        dataset: getFileName(p.source_file_id),
        methods: parseAlgorithms(p.params_json),
        status: p.status,
        progress: p.status === 'processing' ? 50 : 0,
        created: new Date(p.created_at).toLocaleString(),
      })),
  )

  const results = computed(() =>
    processes.value
      .filter((p) => ['completed', 'failed'].includes(p.status))
      .map((p) => ({
        id: String(p.id),
        name: `Process #${p.id}`,
        dataset: getFileName(p.source_file_id),
        methods: parseAlgorithms(p.params_json),
        status: p.status,
        created: new Date(p.finished_at || p.created_at).toLocaleDateString(),
      })),
  )

  const runningTasks = computed(() => tasks.value)
  const recentResults = computed(() => results.value.slice(0, 10))

  const summary = computed(() => ({
    running: tasks.value.length,
    completed: results.value.filter((r) => r.status === 'completed').length,
    failed: results.value.filter((r) => r.status === 'failed').length,
  }))

  // Methods
  function getFileName(fileId: number): string {
    return fileNames.value[fileId] || `File ${fileId}`
  }

  async function fetchProcesses() {
    loading.value = true
    try {
      const [procData, filesRes] = await Promise.all([listMyProcesses(), listUserFiles({}, 1, 100)])
      processes.value = procData
      const nameMap: Record<number, string> = {}
      for (const f of filesRes.data || filesRes) {
        nameMap[f.file_id || f.id] = (f.filename || f.name || '').replace(/\.[^.]+$/, '')
      }
      fileNames.value = nameMap
    } catch (e) {
      console.error('Failed to fetch processes:', e)
    } finally {
      loading.value = false
    }
  }

  function onCreated() {
    createOpen.value = false
    fetchProcesses()
  }

  // Lifecycle
  onMounted(() => fetchProcesses())

  return {
    loading,
    createOpen,
    runningTasks,
    recentResults,
    summary,
    onCreated,
    fetchProcesses,
  }
}
