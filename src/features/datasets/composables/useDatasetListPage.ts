import { useRouter } from 'vue-router'
import { useDatasetList } from '@/features/datasets/composables/useDatasetList'
import { useDatasetListRouteState } from '@/features/datasets/composables/useDatasetListRouteState'
import { useAuthStore } from '@/shared/auth/authStore'

type Fetcher = (filters: Record<string, any>, page: number, size: number) => Promise<any>

/**
 * MyDatasets / PublicDatasets 两个列表页共用的装配逻辑：
 * useDatasetList（取数/排序/分页）+ useDatasetListRouteState（搜索/筛选/分页状态）
 * + 上传成功后的当前页刷新 + 跳转 Dataset Overview。
 * 页面间的差异（配额条、删除流程、登录门槛、?upload=1 等）仍由各页面自己处理。
 */
export function useDatasetListPage(
  fetcher: Fetcher,
  opts: {
    source: 'my' | 'public'
    defaultFilters?: Record<string, any>
    onMountedReady?: () => void
  },
) {
  const router = useRouter()
  const auth = useAuthStore()

  // Use composable for datasets (fetch/map/pagination/sort)
  const {
    datasets,
    loading,
    error,
    meta,
    page,
    size,
    fetchFiles,
    applyFilters,
    handleSort,
    goToPage: dsGoToPage,
    changeSize: dsChangeSize,
    pagination,
  } = useDatasetList(fetcher, {
    defaultFilters: opts.defaultFilters,
    initialSort: 'submission_time',
    initialDesc: true,
  })

  const { handleSearch, handleStatusFilter, handleApplyFilters, goToPage, changeSize } =
    useDatasetListRouteState({
      page,
      size,
      meta,
      auth,
      fetchFiles,
      applyFilters,
      goToPage: dsGoToPage,
      changeSize: dsChangeSize,
      onMountedReady: opts.onMountedReady,
    })

  /** 上传成功后刷新当前页；弹窗关闭、配额刷新等由页面各自处理 */
  const refreshCurrentPage = () => fetchFiles({ page: page.value, size: size.value })

  const viewOverview = (fileId: string) => {
    router.push({ name: 'DatasetOverview', state: { fileId, source: opts.source } })
  }

  return {
    datasets,
    loading,
    error,
    meta,
    page,
    size,
    pagination,
    fetchFiles,
    handleSort,
    handleSearch,
    handleStatusFilter,
    handleApplyFilters,
    goToPage,
    changeSize,
    refreshCurrentPage,
    viewOverview,
  }
}
