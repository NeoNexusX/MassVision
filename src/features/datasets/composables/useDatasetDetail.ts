import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import { isVocabValue, vocabLabel } from '@/features/datasets/constants/vocabLabels'
import { t } from '@/i18n'

export function useDatasetDetail() {
  const route = useRoute()
  const router = useRouter()
  const { handleDownloadRaw, isPacking } = useDownloadProgress()
  const { showToast } = useToast()

  // State
  const dataset = ref<File | null>(null)
  const loading = ref(true)
  const ticImageUrl = ref<string>('')
  const ticImageError = ref(false)

  const { isShareView, sharedFileId, isShareCopied, shareCurrent } =
    useOverviewShare(dataset)
  const fileId = computed(() => {
    if (isShareView.value) return sharedFileId.value ?? ''
    return String(route.params.fileId ?? '')
  })
  // A shared link always uses the anonymous public client, even if the viewer
  // happens to be signed in. The backend remains responsible for is_public.
  const source = computed<'my' | 'public'>(() =>
    isShareView.value || route.meta.datasetSource !== 'my' ? 'public' : 'my',
  )
  const isPublic = computed(() => source.value === 'public')
  /** Route params identify normal entries; shared entries decode their public URL id. */
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
    // 词表值是规范写法（如 CHCA (α-Cyano-4-hydroxycinnamic acid)），原样或按词表译文显示，
    // 不能再做大小写变换；只有自填值沿用首字母大写的旧显示
    if (isVocabValue(val)) return vocabLabel(val)
    return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
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
      // set_public 响应不含 public_id（后端契约）：重拉一次元数据把
      // is_public 与分享所需的 public_id 一起同步到位；失败则退回本地翻转标志
      try {
        const metadata = await getFileMetadata(targetId, isPublic.value)
        if (metadata) dataset.value = mapItemToDataset(metadata)
      } catch {
        if (dataset.value) dataset.value.isPublic = true
      }
      showToast(t('datasets.overview.madePublic'), 'success')
    } catch (error) {
      const message = extractBackendError(error, t('common.feedback.updateFailed'))
      showToast(message, 'error')
      console.error('Failed to set file public', error)
    } finally {
      makingPublic.value = false
      showPublicConfirm.value = false
    }
  }

  // ---- 私有文件的分享：确认「设为公开」→ 重拉拿 public_id → 复制链接 ----
  const showShareConfirm = ref(false)
  const sharing = ref(false)

  const openShareConfirm = () => {
    showShareConfirm.value = true
  }

  const cancelShareConfirm = () => {
    showShareConfirm.value = false
  }

  const confirmSharePublic = async () => {
    const targetId = dataset.value?.id ? String(dataset.value.id) : ''
    if (!targetId) return
    sharing.value = true
    try {
      await setFilePublic(targetId)
      // set_public 响应不含 public_id（后端契约）：重拉元数据让 isPublic/publicId
      // 同步到位，然后直接复用 shareCurrent（此刻 isPublic 已翻真，走 public_id 新链接）
      const metadata = await getFileMetadata(targetId, isPublic.value)
      if (metadata) dataset.value = mapItemToDataset(metadata)
      showToast(t('datasets.overview.madePublic'), 'success')
      await shareCurrent()
    } catch (error) {
      showToast(extractBackendError(error, t('common.feedback.updateFailed')), 'error')
      console.error('Failed to share dataset', error)
    } finally {
      sharing.value = false
      showShareConfirm.value = false
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
    isShareCopied,
    ticImageUrl,
    ticImageError,
    placeholderSvg,
    formatSize: formatBytes,
    formatString,
    shareCurrent,
    goBack,
    downloadCurrent,
    isPacking,
    makingPublic,
    showPublicConfirm,
    openPublicConfirm,
    cancelPublicConfirm,
    confirmSetPublic,
    showShareConfirm,
    sharing,
    openShareConfirm,
    cancelShareConfirm,
    confirmSharePublic,
  }
}
