import { reactive } from 'vue'
import { ossDownloadAndSave, ossDownloadRaw, ossDownloadRawNoauth } from '@/features/datasets/utils/downloadHelper'
import { useDownloadStore } from '@/features/datasets/stores/downloadStore'
import { useToast } from '@/shared/composables/useToast'
import { extractBackendError } from '@/shared/api/httpClient'
import { t } from '@/i18n'

const packingIds = reactive(new Set<string>())

export function useDownloadProgress() {
  const { showToast, removeToast } = useToast()
  const downloadStore = useDownloadStore()

  const isPacking = (publicId: string) => packingIds.has(publicId)

  const handleDownload = async (
    publicId?: string,
    options?: { getFallbackFilename?: () => string | undefined },
  ) => {
    if (!publicId) return
    if (packingIds.has(publicId)) return
    packingIds.add(publicId)
    const toastId = showToast(t('datasets.download.preparing'), 'info', 0)
    try {
      await ossDownloadAndSave(publicId, options)
      removeToast(toastId)
    } catch (error) {
      removeToast(toastId)
      const message = extractBackendError(error, t('datasets.download.failed'))
      showToast(message, 'error')
      console.error('Download error:', error)
    } finally {
      packingIds.delete(publicId)
    }
  }

  /**
   * RAW pre-signed download: imzML + ibd from /files/{public_id}/download_raw.
   * Zero polling — pre-signed URLs are returned immediately.
   * Rate-limited: one download per cooldown window (60s default).
   */
  const handleDownloadRaw = async (
    publicId?: string,
    options?: { getFallbackFilename?: () => string | undefined, isPublic?: boolean },
  ) => {
    if (!publicId) return
    if (packingIds.has(publicId)) return

    // Rate-limit check（登录和未登录都限制，防止刷带宽）
    if (!downloadStore.canDownload()) {
      // 区分"正在下载"和"冷却中"
      if (downloadStore.downloading) {
        showToast(t('datasets.download.inProgress'), 'warning')
      } else {
        const remain = Math.ceil(downloadStore.cooldownRemaining())
        showToast(t('datasets.download.limited', { seconds: remain }), 'warning')
      }
      return
    }

    packingIds.add(publicId)
    downloadStore.startDownload(publicId)
    const toastId = showToast(t('datasets.download.downloading'), 'info', 0)
    try {
      await ossDownloadRaw(publicId, { ...options, isPublic: options?.isPublic ?? false })
      downloadStore.completeDownload()
      removeToast(toastId)
      showToast(t('datasets.download.started'), 'success')
    } catch (error) {
      downloadStore.failDownload()
      removeToast(toastId)
      const message = extractBackendError(error, t('datasets.download.failed'))
      showToast(message, 'error')
      console.error('Download error:', error)
    } finally {
      packingIds.delete(publicId)
    }
  }

  /**
   * RAW no-auth download for the public collection page:
   * /files/{public_id}/download_raw_noauth (backend serves is_public files only).
   */
  const handleDownloadPublicRaw = async (publicId?: string) => {
    if (!publicId) return
    if (packingIds.has(publicId)) return

    if (!downloadStore.canDownload()) {
      if (downloadStore.downloading) {
        showToast(t('datasets.download.inProgress'), 'warning')
      } else {
        const remain = Math.ceil(downloadStore.cooldownRemaining())
        showToast(t('datasets.download.limited', { seconds: remain }), 'warning')
      }
      return
    }

    packingIds.add(publicId)
    downloadStore.startDownload(publicId)
    const toastId = showToast(t('datasets.download.downloading'), 'info', 0)
    try {
      await ossDownloadRawNoauth(publicId)
      downloadStore.completeDownload()
      removeToast(toastId)
      showToast(t('datasets.download.started'), 'success')
    } catch (error) {
      downloadStore.failDownload()
      removeToast(toastId)
      const message = extractBackendError(error, t('datasets.download.failed'))
      showToast(message, 'error')
      console.error('Download error:', error)
    } finally {
      packingIds.delete(publicId)
    }
  }

  return { handleDownload, handleDownloadRaw, handleDownloadPublicRaw, isPacking, packingIds }
}
