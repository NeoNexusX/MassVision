import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFileMetadata, setFilePublic } from '@/features/datasets/api/datasetApi'
import { getShareOverviewMetadata } from '@/features/datasets/api/overviewShareApi'
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
import { formatVocabOrText } from '@/features/datasets/constants/vocabLabels'
import { t } from '@/i18n'

export function useDatasetDetail() {
  const router = useRouter()
  const route = useRoute()
  const { handleDownloadRaw, isPacking } = useDownloadProgress()
  const { showToast } = useToast()

  // 从 history.state 读取导航上下文（无路径参数，刷新后会丢失）
  const state = history.state as { filePublicId?: string; source?: 'my' | 'public' } | null

  // State
  const dataset = ref<File | null>(null)
  const loading = ref(true)
  const isCopied = ref(false)
  const ticImageUrl = ref<string>('')
  const ticImageError = ref(false)

  const { isShareView, sharedToken, isShareCopied, shareCurrent } = useOverviewShare(dataset)
  const filePublicId = computed(() =>
    isShareView.value
      ? sharedToken.value?.kind === 'publicId'
        ? sharedToken.value.value
        : ''
      : (state?.filePublicId ?? ''),
  )
  // 分享页按 public 来源处理：goBack 回公开列表、需登录操作的登录回跳以 /datasets 为基准
  const source = computed<'my' | 'public'>(() =>
    isShareView.value ? 'public' : state?.source || 'my',
  )
  /** 分享 token 既非 16 位 publicId 也非旧 Base64 数字 id → 无效链接，不发任何请求 */
  const isInvalidShare = computed(() => isShareView.value && !sharedToken.value)
  /** Normal entry needs history state; shared entry needs a valid token. */
  const isStale = computed(() => (isShareView.value ? isInvalidShare.value : !filePublicId.value))
  /** 匿名访问分享链接被 401：渲染「登录 / 注册」引导而不是错误态 */
  const requiresAuth = ref(false)

  // Computed
  const placeholderSvg = computed(() => {
    const targetId = filePublicId.value || (dataset.value?.filename as string)
    return getDatasetPlaceholderSvg({
      id: targetId,
      showGuides: true,
    })
  })

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

  /** 匿名 401 的引导落地：登录/注册后带 redirect 回来。分享页直接回原链接；
   * 公开列表进入的 overview 无 URL 参数（state 登录往返即失），回 /s/{public_id}
   * 永久链接，登录后照常取数渲染 */
  const authRedirectTarget = () =>
    isShareView.value || !filePublicId.value ? route.fullPath : `/s/${filePublicId.value}`
  const goLogin = () => router.push({ path: '/login', query: { redirect: authRedirectTarget() } })
  const goRegister = () =>
    router.push({ path: '/register', query: { redirect: authRedirectTarget() } })

  /** 下载需要登录：未登录则提示并跳转登录页，与公开数据集列表页行为一致 */
  const { requireAuth } = useRequireAuth(() =>
    source.value === 'public' ? '/datasets' : '/mydatasets',
  )

  const downloadCurrent = async () => {
    const targetId = dataset.value?.publicId ?? ''
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
    const targetId = dataset.value?.publicId ?? ''
    if (!targetId) return
    makingPublic.value = true
    try {
      await setFilePublic(targetId)
      // 直接更新本地状态，避免刷新页面
      if (dataset.value) {
        dataset.value.isPublic = true
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

  // ---- 私有文件的分享：确认「设为公开」→ 重拉拿 publicId → 复制链接 ----
  const showShareConfirm = ref(false)
  const sharing = ref(false)

  const openShareConfirm = () => {
    showShareConfirm.value = true
  }

  const cancelShareConfirm = () => {
    showShareConfirm.value = false
  }

  const confirmSharePublic = async () => {
    const targetId = dataset.value?.publicId ?? ''
    if (!targetId) return
    sharing.value = true
    try {
      await setFilePublic(targetId)
      // set_public 响应是否回传 public_id 前后端契约有分歧：重拉一次元数据让
      // isPublic 与分享所需的 publicId 一起同步到位，然后复用 shareCurrent 复制链接
      const metadata = await getFileMetadata(targetId)
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
    const token = isShareView.value ? sharedToken.value : null
    if (!token && !filePublicId.value) {
      dataset.value = null
      ticImageUrl.value = ''
      loading.value = false
      return
    }

    loading.value = true
    requiresAuth.value = false
    try {
      // 分享页取数走 overviewShareApi（登录态感知，见其头注释）
      const share = token ? await getShareOverviewMetadata(token) : null
      const metadata = share ? share.metadata : await getFileMetadata(filePublicId.value)
      if (currentRequest !== requestId) return
      if (share?.exchangedPublicId) {
        // legacy 链接兑换成功：把地址栏从 Base64 旧串升级成新 publicId。
        // replace 不入历史栈，回退行为不变；watch 会以新 token 幂等地重取一次
        router.replace({
          name: 'SharedDatasetOverview',
          params: { shareToken: share.exchangedPublicId },
        })
      }
      dataset.value = metadata ? mapItemToDataset(metadata) : null
      ticImageError.value = false
      // image_path 为空 → null → 占位图；不发起注定 404 的图片请求
      ticImageUrl.value = buildPreviewImageUrl(dataset.value?.imagePath) ?? ''
    } catch (error) {
      if (currentRequest !== requestId) return
      console.error('Error fetching dataset details', error)
      // 匿名访问（分享链接 / 公开列表进入）→ 后端 401：转成登录/注册引导
      // （skipAuthRedirect 已挡掉全局跳转，这里能拿到错误自行处置）
      if ((error as { response?: { status?: number } })?.response?.status === 401) {
        requiresAuth.value = true
      }
      dataset.value = null
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  watch([filePublicId, sharedToken], fetchDatasetDetails, { immediate: true })

  return {
    source,
    isShareView,
    isStale,
    isInvalidShare,
    requiresAuth,
    goLogin,
    goRegister,
    dataset,
    loading,
    isCopied,
    isShareCopied,
    ticImageUrl,
    ticImageError,
    placeholderSvg,
    formatSize: formatBytes,
    formatString: formatVocabOrText,
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
    showShareConfirm,
    sharing,
    openShareConfirm,
    cancelShareConfirm,
    confirmSharePublic,
  }
}
