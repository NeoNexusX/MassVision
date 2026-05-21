import { onMounted, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { useAuthStore } from '@/features/auth/stores/authStore'

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
  // External composables
  const route = useRoute()
  const router = useRouter()

  // Methods
  const fetchCurrentPage = () =>
    options.fetchFiles({ page: options.page.value, size: options.size.value })

  const replaceQuery = (query: Record<string, string>) => {
    router.replace({ query: { ...route.query, ...query } })
  }

  const initializeFromRoute = () => {
    const qp = Number(route.query.page || 1)
    const qs = Number(route.query.size || options.size.value)
    options.page.value = qp > 0 ? qp : 1
    options.size.value = qs > 0 ? qs : options.size.value

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
    replaceQuery({ page: '1' })
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
    replaceQuery({ page: String(normalizedPage) })
    options.goToPage(normalizedPage)
  }

  const changeSize = (newSize: number) => {
    options.size.value = newSize
    options.page.value = 1
    replaceQuery({ page: '1', size: String(newSize) })
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
