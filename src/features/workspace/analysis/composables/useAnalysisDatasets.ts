import { computed, onMounted, ref, watch } from 'vue'
import { listUserFiles } from '@/features/datasets/api/datasetApi'
import { useDatasetList } from '@/features/datasets/composables/useDatasetList'

export function useAnalysisDatasets() {
  // External composables
  const { datasets, loading, error, fetchFiles } = useDatasetList((filters, page, size) =>
    listUserFiles(filters, page, size),
  )

  // State
  const activeTab = ref<'upload' | 'my'>('my')
  const datasetQuery = ref('')
  const selectedDataset = ref<any>(null)
  const uploadOpen = ref(false)

  // Computed
  const filteredDatasets = computed(() => {
    const query = datasetQuery.value.trim().toLowerCase()
    if (!query) return datasets.value
    return datasets.value.filter((dataset) => (dataset.name || '').toLowerCase().includes(query))
  })

  // Methods
  const selectDataset = (dataset: any) => {
    selectedDataset.value = dataset
  }

  const onUploadSuccess = async () => {
    await fetchFiles({ page: 1, size: 50 })
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

  // Lifecycle
  onMounted(() => {
    fetchFiles({ page: 1, size: 100 }).catch(() => {})
  })

  return {
    activeTab,
    datasetQuery,
    selectedDataset,
    uploadOpen,
    datasets,
    loading,
    error,
    filteredDatasets,
    fetchFiles,
    selectDataset,
    onUploadSuccess,
    onUploadClose,
  }
}
