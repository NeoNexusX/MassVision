import { ref, reactive, computed } from 'vue'
import { mapItemToDataset } from '@/utils/dataset-transform'
import type { File } from '@/types/file'

type Fetcher = (filters: Record<string, any>, page: number, size: number) => Promise<any>

export function useDatasets(fetcher: Fetcher, opts?: { defaultFilters?: Record<string, any>, initialSort?: string, initialDesc?: boolean }) {
  const defaultFilters = opts?.defaultFilters || {}
  const initialSort = opts?.initialSort || 'submission_time'
  const initialDesc = opts?.initialDesc ?? true

  const datasets = ref<File[]>([])
  const loading = ref(false)
  const error = ref('')

  const meta = reactive({ current_page: 1, current_records: 0, total_pages: 1, total_records: 0 })
  const page = ref<number>(1)
  const size = ref<number>(10)

  const filters = reactive({ ...defaultFilters })

  const currentSort = ref<string>(initialSort)
  const sortDesc = ref<boolean>(initialDesc)

  const applyClientSort = (arr: File[]) => {
    return arr.sort((a, b) => {
      if (currentSort.value === 'size_bytes') {
        const sa = a.sizeBytes || 0
        const sb = b.sizeBytes || 0
        return sortDesc.value ? sb - sa : sa - sb
      }
      const ta = new Date(a.submitTime).getTime()
      const tb = new Date(b.submitTime).getTime()
      return sortDesc.value ? tb - ta : ta - tb
    })
  }

  const normalizeFilters = (f: Record<string, any>) => {
    const out: Record<string, any> = {}
    for (const k in f) {
      const v = (f as any)[k]
      if (v === null || v === undefined) {
        out[k] = ''
      } else if (Array.isArray(v)) {
        out[k] = v.length === 0 ? '' : v
      } else {
        out[k] = v
      }
    }
    return out
  }

  const fetchFiles = async (opts?: { page?: number; size?: number }) => {
    loading.value = true
    error.value = ''
    const p = opts?.page ?? page.value
    const s = opts?.size ?? size.value
    try {
      const resp = await fetcher(normalizeFilters(filters as Record<string, any>), p, s)
      const data = resp.data || {}

      if (data.meta) {
        meta.current_page = data.meta.current_page || p
        meta.current_records = data.meta.current_records || (Array.isArray(data.data) ? data.data.length : 0)
        meta.total_pages = data.meta.total_pages || 1
        meta.total_records = data.meta.total_records || meta.current_records
      }

      const items = Array.isArray(data.data) ? data.data.map((it: any, idx: number) => mapItemToDataset(it, idx)) : []
      datasets.value = applyClientSort(items)
      page.value = p
      size.value = s
    } catch (err: any) {
      error.value = err?.message || String(err) || 'Failed to load files'
      datasets.value = []
    } finally {
      loading.value = false
    }
  }

  const applyFilters = (payload: Record<string, any>) => {
    Object.assign(filters, payload)
    page.value = 1
  }

  const handleSort = (sortValue: string) => {
    if (currentSort.value === sortValue) {
      sortDesc.value = !sortDesc.value
    } else {
      currentSort.value = sortValue
      sortDesc.value = true
    }
    datasets.value = applyClientSort(datasets.value)
  }

  const goToPage = (np: number) => {
    if (np < 1) np = 1
    if (np > (meta.total_pages || 1)) np = meta.total_pages || 1
    page.value = np
    fetchFiles({ page: np, size: size.value })
  }

  const changeSize = (newSize: number) => {
    size.value = newSize
    page.value = 1
    fetchFiles({ page: 1, size: newSize })
  }

  const pagination = computed<(number | string)[]>(() => {
    const total = Number(meta.total_pages || 1)
    const current = Number(meta.current_page || 1)
    const pages: (number | string)[] = []
    const maxButtons = 7

    if (total <= maxButtons) {
      for (let i = 1; i <= total; i++) pages.push(i)
      return pages
    }

    pages.push(1)

    let left = Math.max(current - 1, 2)
    let right = Math.min(current + 1, total - 1)

    if (current <= 3) {
      left = 2
      right = 4
    }
    if (current >= total - 2) {
      left = total - 3
      right = total - 1
    }

    if (left > 2) pages.push('...')
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < total - 1) pages.push('...')

    pages.push(total)
    return pages
  })

  return {
    datasets,
    loading,
    error,
    meta,
    page,
    size,
    filters,
    fetchFiles,
    applyFilters,
    handleSort,
    currentSort,
    sortDesc,
    goToPage,
    changeSize,
    pagination
  }
}
