import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getFileMetadata, getFileImages, pickImageUrl, setFilePublic } from '@/features/datasets/api/datasetApi'
import { mapItemToDataset } from '@/features/datasets/mappers/datasetMapper'
import type { File } from '@/features/datasets/types/dataset'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'
import { formatBytes } from '@/shared/utils/format'
import { extractBackendError } from '@/shared/api/httpClient'
import { useToast } from '@/shared/composables/useToast'
import { useRequireAuth } from '@/shared/composables/useRequireAuth'

export function useDatasetDetail() {
  const router = useRouter()
  const { handleDownloadRaw, isPacking } = useDownloadProgress()
  const { showToast } = useToast()

  // 从 history.state 读取导航上下文（无路径参数，刷新后会丢失）
  const state = history.state as { fileId?: string; source?: 'my' | 'public' } | null

  // State
  const dataset = ref<File | null>(null)
  const loading = ref(true)
  const isCopied = ref(false)
  const ticImageUrl = ref<string>('')
  const ticImageError = ref(false)

  const source = computed(() => state?.source || 'my')
  const isPublic = computed(() => source.value === 'public')
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

  /** 下载需要登录：未登录则提示并跳转登录页，与公开数据集列表页行为一致 */
  const { requireAuth } = useRequireAuth(() =>
    source.value === 'public' ? '/datasets' : '/mydatasets',
  )

  const downloadCurrent = async () => {
    const targetId = dataset.value?.id ? String(dataset.value.id) : ''
    if (!targetId) return
    if (!requireAuth()) return
    await handleDownloadRaw(targetId, {
      getFallbackFilename: () => {
        const filename = dataset.value?.filename || dataset.value?.name || undefined
        if (!filename) return undefined
        return filename.toLowerCase().endsWith('.zip') ? filename : `${filename}.zip`
      },
    })
  }

  // Make Public
  const makingPublic = ref(false)
  const showPublicConfirm = ref(false)

  const openPublicConfirm = () => {
    showPublicConfirm.value = true
  }

  const cancelPublicConfirm = () => {
    showPublicConfirm.value = false
  }

  const confirmSetPublic = async () => {
    const targetId = dataset.value?.id ? String(dataset.value.id) : ''
    if (!targetId) return
    makingPublic.value = true
    try {
      await setFilePublic(targetId)
      // 直接更新本地状态，避免刷新页面
      if (dataset.value) {
        dataset.value.isPublic = true
      }
      showToast('Dataset is now public.', 'success')
    } catch (error) {
      const message = extractBackendError(error, 'Failed to make dataset public')
      showToast(message, 'error')
      console.error('Failed to set file public', error)
    } finally {
      makingPublic.value = false
      showPublicConfirm.value = false
    }
  }

  const fetchDatasetDetails = async () => {
    const fileId = state?.fileId
    if (!fileId) {
      loading.value = false
      return
    }

    loading.value = true
    try {
      const metadata = await getFileMetadata(fileId, isPublic.value)
      dataset.value = metadata ? mapItemToDataset(metadata) : null
      // Fetch TIC image after dataset is loaded
      if (dataset.value?.id) {
        try {
          ticImageError.value = false
          const images = await getFileImages(dataset.value.id, isPublic.value)
          ticImageUrl.value = pickImageUrl(images)
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
    makingPublic,
    showPublicConfirm,
    openPublicConfirm,
    cancelPublicConfirm,
    confirmSetPublic,
  }
}
