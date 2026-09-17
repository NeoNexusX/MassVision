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

  const isPacking = (id: string) => packingIds.has(id)

  const handleDownload = async (
    id?: string,
    options?: { getFallbackFilename?: () => string | undefined },
  ) => {
    if (!id) return
    if (packingIds.has(id)) return
    packingIds.add(id)
    const toastId = showToast(t('datasets.download.preparing'), 'info', 0)
    try {
      await ossDownloadAndSave(id, options)
      removeToast(toastId)
    } catch (error) {
      removeToast(toastId)
      const message = extractBackendError(error, t('datasets.download.failed'))
      showToast(message, 'error')
      console.error('Download error:', error)
    } finally {
      packingIds.delete(id)
    }
  }

  /**
   * RAW pre-signed download: imzML + ibd from /files/{file_id}/download_raw.
   * Zero polling — pre-signed URLs are returned immediately.
   * Rate-limited: one download per cooldown window (60s default).
   */
  const handleDownloadRaw = async (
    id?: string,
    options?: { getFallbackFilename?: () => string | undefined, isPublic?: boolean },
  ) => {
    if (!id) return
    if (packingIds.has(id)) return

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

    packingIds.add(id)
    downloadStore.startDownload(id)
    const toastId = showToast(t('datasets.download.downloading'), 'info', 0)
    try {
      await ossDownloadRaw(id, { ...options, isPublic: options?.isPublic ?? false })
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
      packingIds.delete(id)
    }
  }

  /**
   * RAW no-auth download for the public collection page:
   * /files/{file_id}/download_raw_noauth (backend serves is_public files only).
   */
  const handleDownloadPublicRaw = async (id?: string) => {
    if (!id) return
    if (packingIds.has(id)) return

    if (!downloadStore.canDownload()) {
      if (downloadStore.downloading) {
        showToast(t('datasets.download.inProgress'), 'warning')
      } else {
        const remain = Math.ceil(downloadStore.cooldownRemaining())
        showToast(t('datasets.download.limited', { seconds: remain }), 'warning')
      }
      return
    }

    packingIds.add(id)
    downloadStore.startDownload(id)
    const toastId = showToast(t('datasets.download.downloading'), 'info', 0)
    try {
      await ossDownloadRawNoauth(id)
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
      packingIds.delete(id)
    }
  }

  return { handleDownload, handleDownloadRaw, handleDownloadPublicRaw, isPacking, packingIds }
}
