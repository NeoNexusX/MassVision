import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listFiles, listUserFiles } from '@/features/datasets/api/datasetApi'
import { mapItemToDataset } from '@/features/datasets/mappers/datasetMapper'
import type { File } from '@/features/datasets/types/dataset'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'
import { formatBytes } from '@/shared/utils/format'

export function useDatasetDetail() {
  // External composables
  const route = useRoute()
  const router = useRouter()
  const { handleDownload } = useDownloadProgress()

  // State
  const dataset = ref<File | null>(null)
  const loading = ref(true)
  const isCopied = ref(false)

  // Computed
  const placeholderSvg = computed(() => {
    const targetId = (route.params.id as string) || (dataset.value?.filename as string)
    return getDatasetPlaceholderSvg({
      id: targetId,
      showGuides: true,
    })
  })

  // Methods
  const formatString = (val?: string) => {
    if (!val) return '—'
    return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
  }

  const copyHash = async (hash: string) => {
    if (!hash) return
    try {
      await navigator.clipboard.writeText(hash)
      isCopied.value = true
      setTimeout(() => {
        isCopied.value = false
      }, 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const goBack = () => {
    if (route.query.from === 'public') {
      router.push({ name: 'PublicDatasets' })
    } else {
      router.push({ name: 'MyDatasets' })
    }
  }

  const downloadCurrent = async () => {
    const targetId = dataset.value?.id ? String(dataset.value.id) : (route.params.id as string)
    if (!targetId) return
    await handleDownload(targetId, {
      getFallbackFilename: () => {
        const filename =
          dataset.value?.filename || dataset.value?.name || (route.params.id as string) || undefined
        if (!filename) return undefined
        return filename.toLowerCase().endsWith('.zip') ? filename : `${filename}.zip`
      },
    })
  }

  const findDatasetByRouteKey = async () => {
    const searchKey = String(route.params.id || '')
    if (!searchKey) return null

    const listApi = route.query.from === 'my' ? listUserFiles : listFiles
    try {
      const body = await listApi({ filename: searchKey }, 1, 20)
      const items = body?.data
      if (!Array.isArray(items) || items.length === 0) return null

      const tryWithZip = searchKey.endsWith('.zip') ? searchKey : `${searchKey}.zip`
      return (
        items.find((item: any) => {
          const filename = (item.filename || '').toString()
          const filenameBase = filename.replace(/\.[^/.]+$/, '')
          return filename === searchKey || filenameBase === searchKey || filename === tryWithZip
        }) || null
      )
    } catch (err) {
      console.warn('Filename filter search failed', err)
      return null
    }
  }

  const fetchDatasetDetails = async () => {
    loading.value = true
    try {
      const found = await findDatasetByRouteKey()
      dataset.value = found ? mapItemToDataset(found) : null
    } catch (error) {
      console.error('Error fetching dataset details', error)
      dataset.value = null
    } finally {
      loading.value = false
    }
  }

  // Lifecycle
  onMounted(fetchDatasetDetails)

  return {
    route,
    dataset,
    loading,
    isCopied,
    placeholderSvg,
    formatSize: formatBytes,
    formatString,
    copyHash,
    goBack,
    downloadCurrent,
    fetchDatasetDetails,
  }
}
