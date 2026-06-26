import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getFileMetadata, getFileImages } from '@/features/datasets/api/datasetApi'
import { mapItemToDataset } from '@/features/datasets/mappers/datasetMapper'
import type { File } from '@/features/datasets/types/dataset'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'
import { formatBytes } from '@/shared/utils/format'

export function useDatasetDetail() {
  const router = useRouter()
  const { handleDownloadRaw, isPacking } = useDownloadProgress()

  // 从 history.state 读取导航上下文（无路径参数，刷新后会丢失）
  const state = history.state as { fileId?: string; source?: 'my' | 'public' } | null

  // State
  const dataset = ref<File | null>(null)
  const loading = ref(true)
  const isCopied = ref(false)
  const ticImageUrl = ref<string>('')
  const ticImageError = ref(false)

  const source = computed(() => state?.source || 'my')
  /** 刷新后 history.state 丢失，此时应提示用户从列表页重新进入 */
  const isStale = computed(() => !state?.fileId)

  // Computed
  const placeholderSvg = computed(() => {
    const targetId = state?.fileId || (dataset.value?.filename as string)
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
    if (source.value === 'public') {
      router.push({ name: 'PublicDatasets' })
    } else {
      router.push({ name: 'MyDatasets' })
    }
  }

  const downloadCurrent = async () => {
    const targetId = dataset.value?.id ? String(dataset.value.id) : ''
    if (!targetId) return
    await handleDownloadRaw(targetId, {
      getFallbackFilename: () => {
        const filename = dataset.value?.filename || dataset.value?.name || undefined
        if (!filename) return undefined
        return filename.toLowerCase().endsWith('.zip') ? filename : `${filename}.zip`
      },
    })
  }

  const fetchDatasetDetails = async () => {
    const fileId = state?.fileId
    if (!fileId) {
      loading.value = false
      return
    }

    loading.value = true
    try {
      const metadata = await getFileMetadata(fileId)
      dataset.value = metadata ? mapItemToDataset(metadata) : null
      // Fetch TIC image after dataset is loaded
      if (dataset.value?.id) {
        try {
          ticImageError.value = false
          const images = await getFileImages(dataset.value.id)
          ticImageUrl.value = images?.urls?.['tic_image.png'] || ''
        } catch {
          ticImageUrl.value = ''
          ticImageError.value = true
        }
      }
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
    source,
    isStale,
    dataset,
    loading,
    isCopied,
    ticImageUrl,
    ticImageError,
    placeholderSvg,
    formatSize: formatBytes,
    formatString,
    copyHash,
    goBack,
    downloadCurrent,
    isPacking,
    fetchDatasetDetails,
  }
}
