import { computed, reactive, ref } from 'vue'
import { mapItemToDataset } from '@/features/datasets/mappers/datasetMapper'
import { buildPageList } from '@/shared/utils/pagination'
import { getConfig } from '@/shared/config/runtimeConfig'
import type { File } from '@/features/datasets/types/dataset'

type Fetcher = (filters: Record<string, any>, page: number, size: number) => Promise<any>

export function useDatasetList(
  // Arguments
  fetcher: Fetcher,
  opts?: { defaultFilters?: Record<string, any>; initialSort?: string; initialDesc?: boolean },
) {
  const defaultFilters = opts?.defaultFilters || {}
  const initialSort = opts?.initialSort || 'submission_time'
  const initialDesc = opts?.initialDesc ?? true

  // State
  const datasets = ref<File[]>([])
  const loading = ref(false)
  const error = ref('')

  const meta = reactive({ current_page: 1, current_records: 0, total_pages: 1, total_records: 0 })
  const page = ref<number>(1)
  const size = ref<number>(getConfig().pagination.defaultPageSize)

  const filters = reactive({ ...defaultFilters })

  const currentSort = ref<string>(initialSort)
  const sortDesc = ref<boolean>(initialDesc)

  // Computed
  const pagination = computed<(number | string)[]>(() =>
    buildPageList(meta.current_page, meta.total_pages),
  )

  // Methods
  // 返回排序后的新数组，不原地 mutate（handleSort 直接传入响应式 datasets，原地排序是副作用）
  const applyClientSort = (arr: File[]) => {
    return [...arr].sort((a, b) => {
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
      // fetcher 现已返回解包后的响应体（{ data, meta }），不再是 axios response
      const data = (await fetcher(normalizeFilters(filters as Record<string, any>), p, s)) || {}

      if (data.meta) {
        meta.current_page = data.meta.current_page || p
        meta.current_records =
          data.meta.current_records || (Array.isArray(data.data) ? data.data.length : 0)
        meta.total_pages = data.meta.total_pages || 1
        meta.total_records = data.meta.total_records || meta.current_records
      }

      const items = Array.isArray(data.data)
        ? data.data.map((it: any, idx: number) => mapItemToDataset(it, idx))
        : []
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
    pagination,
  }
}
