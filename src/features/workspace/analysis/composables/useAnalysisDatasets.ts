import { computed, onMounted, ref, watch } from 'vue'
import { listUserFiles, listFiles } from '@/features/datasets/api/datasetApi'
import { useDatasetList } from '@/features/datasets/composables/useDatasetList'

export function useAnalysisDatasets() {
  // My Datasets
  const {
    datasets: myDatasets,
    loading: myLoading,
    error: myError,
    fetchFiles: fetchMyFiles,
    meta: myMeta,
    page: myPage,
    size: mySize,
    pagination: myPagination,
    goToPage: myGoToPage,
    changeSize: myChangeSize,
    applyFilters: myApplyFilters,
  } = useDatasetList((filters, page, size) => listUserFiles(filters, page, size))

  // Public Datasets
  const {
    datasets: publicDatasets,
    loading: publicLoading,
    error: publicError,
    fetchFiles: fetchPublicFiles,
    meta: publicMeta,
    page: publicPage,
    size: publicSize,
    pagination: publicPagination,
    goToPage: publicGoToPage,
    changeSize: publicChangeSize,
    applyFilters: publicApplyFilters,
  } = useDatasetList((filters, page, size) => listFiles(filters, page, size, true))

  // State
  const activeTab = ref<'upload' | 'my' | 'public'>('my')
  const datasetQuery = ref('')
  const selectedDataset = ref<any>(null)
  const uploadOpen = ref(false)

  // Derive current tab's data
  const datasets = computed(() => (activeTab.value === 'public' ? publicDatasets.value : myDatasets.value))
  const loading = computed(() => (activeTab.value === 'public' ? publicLoading.value : myLoading.value))
  const error = computed(() => (activeTab.value === 'public' ? publicError.value : myError.value))
  const meta = computed(() => (activeTab.value === 'public' ? publicMeta : myMeta))
  const page = computed(() => (activeTab.value === 'public' ? publicPage.value : myPage.value))
  const size = computed(() => (activeTab.value === 'public' ? publicSize.value : mySize.value))
  const pagination = computed(() => (activeTab.value === 'public' ? publicPagination.value : myPagination.value))

  const goToPage = (np: number) => {
    if (activeTab.value === 'public') publicGoToPage(np)
    else myGoToPage(np)
  }
  const changeSize = (ns: number) => {
    if (activeTab.value === 'public') publicChangeSize(ns)
    else myChangeSize(ns)
  }

  // Methods
  const selectDataset = (dataset: any) => {
    selectedDataset.value = dataset
  }

  const onUploadSuccess = async () => {
    await fetchMyFiles()
    const newest = myDatasets.value[0]
    if (newest) selectedDataset.value = newest
    uploadOpen.value = false
  }

  const onUploadClose = () => {
    uploadOpen.value = false
  }

  // Watchers
  watch(activeTab, (value) => {
    if (value === 'upload') uploadOpen.value = true
  })

  // Debounced server-side search
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  watch(datasetQuery, (query) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const trimmed = query.trim()
      const filters = trimmed ? { name: trimmed } : {}
      if (activeTab.value === 'public') {
        publicApplyFilters(filters)
        fetchPublicFiles({ page: 1, size: publicSize.value })
      } else {
        myApplyFilters(filters)
        fetchMyFiles({ page: 1, size: mySize.value })
      }
    }, 300)
  })

  // Lifecycle
  onMounted(() => {
    fetchMyFiles().catch(() => {})
    fetchPublicFiles().catch(() => {})
  })

  return {
    activeTab,
    datasetQuery,
    selectedDataset,
    uploadOpen,
    datasets,
    loading,
    error,
    meta,
    page,
    size,
    pagination,
    goToPage,
    changeSize,
    selectDataset,
    onUploadSuccess,
    onUploadClose,
  }
}
