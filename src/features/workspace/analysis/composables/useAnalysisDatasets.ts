import { onMounted, ref, watch } from 'vue'
import { listUserFiles } from '@/features/datasets/api/datasetApi'
import { useDatasetList } from '@/features/datasets/composables/useDatasetList'

export function useAnalysisDatasets() {
  // External composables — fully leverage useDatasetList's pagination
  const {
    datasets,
    loading,
    error,
    fetchFiles,
    meta,
    page,
    size,
    pagination,
    goToPage,
    changeSize,
    applyFilters,
  } = useDatasetList((filters, page, size) => listUserFiles(filters, page, size))

  // State
  const activeTab = ref<'upload' | 'my'>('my')
  const datasetQuery = ref('')
  const selectedDataset = ref<any>(null)
  const uploadOpen = ref(false)

  // Methods
  const selectDataset = (dataset: any) => {
    selectedDataset.value = dataset
  }

  const onUploadSuccess = async () => {
    await fetchFiles()
    const newest = datasets.value[0]
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

  // Debounced server-side search — reset to page 1 on every query change
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  watch(datasetQuery, (query) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const trimmed = query.trim()
      applyFilters(trimmed ? { name: trimmed } : {})
      fetchFiles({ page: 1, size: size.value })
    }, 300)
  })

  // Lifecycle
  onMounted(() => {
    fetchFiles().catch(() => {})
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
    fetchFiles,
    selectDataset,
    onUploadSuccess,
    onUploadClose,
  }
}
