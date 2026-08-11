import { onMounted, type Ref } from 'vue'
import type { useAuthStore } from '@/shared/auth/authStore'

type FetchFiles = (opts?: { page?: number; size?: number }) => Promise<void>
type ApplyFilters = (payload: Record<string, any>) => void

interface DatasetRouteStateOptions {
  page: Ref<number>
  size: Ref<number>
  meta: { total_pages?: number; current_page?: number }
  auth: ReturnType<typeof useAuthStore>
  fetchFiles: FetchFiles
  applyFilters: ApplyFilters
  goToPage: (page: number) => void
  changeSize: (size: number) => void
  onMountedReady?: () => void
}

export function useDatasetListRouteState(options: DatasetRouteStateOptions) {
  // Methods
  const fetchCurrentPage = () =>
    options.fetchFiles({ page: options.page.value, size: options.size.value })

  const initializeFromRoute = () => {
    // 不再从 URL 读取分页参数，始终从第一页开始
    const load = () => options.fetchFiles({ page: options.page.value, size: options.size.value })
    if (!options.auth.user && options.auth.token) {
      options.auth.fetchUser().finally(load)
    } else {
      load()
    }
    options.onMountedReady?.()
  }

  const applyAndRefresh = (payload: Record<string, any>) => {
    options.applyFilters(payload)
    options.page.value = 1
    fetchCurrentPage()
  }

  const handleSearch = (query: string) => {
    applyAndRefresh({ filename: query || '' })
  }

  const handleStatusFilter = (statuses: string[]) => {
    applyAndRefresh({ status: statuses })
  }

  const handleApplyFilters = (payload: Record<string, any>) => {
    applyAndRefresh(payload)
  }

  const goToPage = (nextPage: number) => {
    const totalPages = options.meta.total_pages || 1
    const normalizedPage = Math.min(Math.max(nextPage, 1), totalPages)
    options.page.value = normalizedPage
    options.meta.current_page = normalizedPage
    options.goToPage(normalizedPage)
  }

  const changeSize = (newSize: number) => {
    options.size.value = newSize
    options.page.value = 1
    options.changeSize(newSize)
  }

  // Lifecycle
  onMounted(initializeFromRoute)

  return {
    handleSearch,
    handleStatusFilter,
    handleApplyFilters,
    goToPage,
    changeSize,
  }
}
