import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getFileMetadata, setFilePublic } from '@/features/datasets/api/datasetApi'
import { getSharedOverviewMetadata } from '@/features/datasets/api/overviewShareApi'
import { buildPreviewImageUrl } from '@/features/datasets/utils/imageUtils'
import { mapItemToDataset } from '@/features/datasets/mappers/datasetMapper'
import type { File } from '@/features/datasets/types/dataset'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'
import { formatBytes } from '@/shared/utils/format'
import { extractBackendError } from '@/shared/api/httpClient'
import { useToast } from '@/shared/composables/useToast'
import { useRequireAuth } from '@/shared/composables/useRequireAuth'
import { useOverviewShare } from '@/features/datasets/composables/useOverviewShare'

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

  const { isShareView, sharedFileId, isShareCopied, shareCurrent } =
    useOverviewShare(dataset)
  const fileId = computed(() => {
    if (isShareView.value) return sharedFileId.value ?? ''
    return state?.fileId != null ? String(state.fileId) : ''
  })
  // A shared link always uses the anonymous public client, even if the viewer
  // happens to be signed in. The backend remains responsible for is_public.
  const source = computed<'my' | 'public'>(() =>
    isShareView.value ? 'public' : state?.source || 'my',
  )
  const isPublic = computed(() => source.value === 'public')
  /** Normal entry needs history state; shared entry needs a valid encoded id. */
  const isStale = computed(() => !fileId.value)

  // Computed
  const placeholderSvg = computed(() => {
    const targetId = fileId.value || (dataset.value?.filename as string)
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

  let requestId = 0

  const fetchDatasetDetails = async () => {
    const currentRequest = ++requestId
    const targetFileId = fileId.value
    if (!targetFileId) {
      dataset.value = null
      ticImageUrl.value = ''
      loading.value = false
      return
    }

    loading.value = true
    try {
      const metadata = isShareView.value
        ? await getSharedOverviewMetadata(targetFileId)
        : await getFileMetadata(targetFileId, isPublic.value)
      if (currentRequest !== requestId) return
      dataset.value = metadata ? mapItemToDataset(metadata) : null
      if (dataset.value?.id) {
        ticImageError.value = false
        ticImageUrl.value = buildPreviewImageUrl(dataset.value.id)
      }
    } catch (error) {
      if (currentRequest !== requestId) return
      console.error('Error fetching dataset details', error)
      dataset.value = null
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  watch([fileId, isPublic], fetchDatasetDetails, { immediate: true })

  return {
    source,
    isShareView,
    isStale,
    dataset,
    loading,
    isCopied,
    isShareCopied,
    ticImageUrl,
    ticImageError,
    placeholderSvg,
    formatSize: formatBytes,
    formatString,
    copyHash,
    shareCurrent,
    goBack,
    downloadCurrent,
    isPacking,
    makingPublic,
    showPublicConfirm,
    openPublicConfirm,
    cancelPublicConfirm,
    confirmSetPublic,
  }
}
