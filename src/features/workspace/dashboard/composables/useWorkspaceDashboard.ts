import { computed, onMounted, reactive, ref } from 'vue'
import { listMyProcesses, deleteProcess, getProcessingStats } from '@/features/datasets/api/datasetApi'
import { parseAlgorithms } from '@/features/workspace/utils/methodsNormalize'
import { buildPageList } from '@/shared/utils/pagination'
import { getConfig } from '@/shared/config/runtimeConfig'

export interface ProcessItem {
  id: number
  status: string
  params_json: string
  source_file_id: number
  error_message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  filename?: string
}

export interface TaskRow {
  id: string
  name: string
  dataset: string
  methods: string[]
  status: string
  created: string
  errorMessage: string | null
}

export function useWorkspaceDashboard() {
  const processes = ref<ProcessItem[]>([])
  const loading = ref(false)
  const createOpen = ref(false)

  // Pagination (后端分页)
  const page = ref(1)
  const size = ref(getConfig().pagination.defaultPageSize)
  const meta = reactive({ current_page: 1, total_pages: 1, total_records: 0 })

  const pagination = computed<(number | string)[]>(() =>
    buildPageList(meta.current_page, meta.total_pages),
  )

  // ── Computed ────────────────────────────────────────────────────
  function toTaskRow(p: ProcessItem): TaskRow {
    return {
      id: String(p.id),
      name: `Process #${p.id}`,
      dataset: getFileName(p),
      methods: parseAlgorithms(p.params_json),
      status: p.status,
      created: parseUtcDate(p.finished_at || p.created_at)?.toLocaleString() ?? '',
      errorMessage: p.error_message || null,
    }
  }

  /** 后端已按最新在前返回，直接映射 */
  const recentResults = computed<TaskRow[]>(() =>
    (processes.value ?? []).map(toTaskRow),
  )

  const summary = reactive({ running: 0, completed: 0, failed: 0 })

  // ── Methods ─────────────────────────────────────────────────────
  function getFileName(p: ProcessItem): string {
    return (p.filename || 'Unknown').replace(/\.[^.]+$/, '')
  }

  // 后端返回的时间戳是 UTC，但没有 'Z'/时区后缀；JS 默认会按本地时区解析，
  // 在 UTC+8 下会出现 8 小时偏差。这里强制按 UTC 解析。
  function parseUtcDate(s: string | null | undefined): Date | null {
    if (!s) return null
    const hasTz = /Z|[+-]\d{2}:?\d{2}$/.test(s)
    return new Date(hasTz ? s : s.replace(' ', 'T') + 'Z')
  }

  async function fetchStats() {
    try {
      const stats = await getProcessingStats()
      summary.running = stats.processing ?? 0
      summary.completed = stats.completed ?? 0
      summary.failed = stats.failed ?? 0
    } catch (e) {
      console.error('Failed to fetch processing stats:', e)
    }
  }

  async function fetchProcesses(opts?: { page?: number; size?: number }) {
    loading.value = true
    const p = opts?.page ?? page.value
    const s = opts?.size ?? size.value
    try {
      const result = await listMyProcesses(p, s)
      processes.value = Array.isArray(result?.data) ? result.data : []

      if (result?.meta) {
        meta.current_page = result.meta.current_page ?? p
        meta.total_pages = result.meta.total_pages ?? 1
        meta.total_records = result.meta.total_records ?? processes.value.length
      }
      page.value = p
      size.value = s
    } catch (e) {
      console.error('Failed to fetch processes:', e)
      processes.value = []
    } finally {
      loading.value = false
    }
  }

  function goToPage(np: number) {
    const clamped = Math.max(1, Math.min(meta.total_pages || 1, np))
    if (clamped === page.value) return
    fetchProcesses({ page: clamped, size: size.value })
  }

  function changeSize(newSize: number) {
    size.value = newSize
    page.value = 1
    fetchProcesses({ page: 1, size: newSize })
  }

  function onCreated() {
    createOpen.value = false
    fetchStats()
    fetchProcesses()
  }

  // ── Delete ──────────────────────────────────────────────────────
  const deletingId = ref<string | null>(null)

  async function deleteResult(id: string) {
    deletingId.value = id
    try {
      await deleteProcess(id)
      // 从服务端刷新当前页，保持 meta 一致
      await fetchProcesses({ page: page.value, size: size.value })
      // 如果当前页已空且不是第一页，回退一页
      if (processes.value.length === 0 && page.value > 1) {
        fetchProcesses({ page: page.value - 1, size: size.value })
      }
      fetchStats()
    } catch (e) {
      console.error('Failed to delete process:', e)
      throw e
    } finally {
      deletingId.value = null
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────
  onMounted(() => {
    fetchStats()
    fetchProcesses()
  })

  return {
    loading,
    createOpen,
    recentResults,
    summary,
    deletingId,
    page,
    size,
    meta,
    pagination,
    onCreated,
    fetchProcesses,
    goToPage,
    changeSize,
    deleteResult,
  }
}
