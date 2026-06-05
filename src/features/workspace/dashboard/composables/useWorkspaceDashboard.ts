import { computed, onMounted, ref } from 'vue'
import { listMyProcesses } from '@/features/datasets/api/datasetApi'
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
  filename: string
}

export function useWorkspaceDashboard() {
  // State
  const processes = ref<ProcessItem[]>([])
  const loading = ref(false)
  const createOpen = ref(false)

  // Computed
  const tasks = computed(() =>
    processes.value
      .filter((p) => ['processing'].includes(p.status))
      .map((p) => ({
        id: String(p.id),
        name: `Process #${p.id}`,
        dataset: getFileName(p),
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
        dataset: getFileName(p),
        methods: parseAlgorithms(p.params_json),
        status: p.status,
        created: new Date(p.finished_at || p.created_at).toLocaleDateString(),
      })),
  )

  const runningTasks = computed(() => tasks.value)
  const recentResults = computed(() => results.value.slice(0, 10))

  const recentActivities = computed(() => {
    const list: Array<{ id: string; type: string; text: string; time: string }> = []
    for (const p of processes.value) {
      if (list.length >= 10) break
      const name = getFileName(p)
      const type = p.status === 'completed' ? 'success' : p.status === 'failed' ? 'error' : 'info'
      const action = p.status === 'processing'
        ? `Task "${name}" is running`
        : p.status === 'completed'
          ? `Result "${name}" completed`
          : `Task "${name}" failed${p.error_message ? ': ' + p.error_message.slice(0, 60) : ''}`
      const time = timeAgo(p.finished_at || p.started_at || p.created_at)
      list.push({ id: String(p.id), type, text: action, time })
    }
    return list
  })

  const summary = computed(() => ({
    running: tasks.value.length,
    completed: results.value.filter((r) => r.status === 'completed').length,
    failed: results.value.filter((r) => r.status === 'failed').length,
  }))

  // Methods
  function getFileName(p: ProcessItem): string {
    return p.filename.replace(/\.[^.]+$/, '')
  }

  function timeAgo(dateStr: string): string {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} minutes ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} hours ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
    return new Date(dateStr).toLocaleDateString()
  }

  async function fetchProcesses() {
    loading.value = true
    try {
      processes.value = await listMyProcesses()
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
    recentActivities,
    summary,
    onCreated,
    fetchProcesses,
  }
}
