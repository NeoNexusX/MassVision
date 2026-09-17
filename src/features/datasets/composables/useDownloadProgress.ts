import { reactive } from 'vue'
import { ossDownloadRaw } from '@/features/datasets/utils/downloadHelper'
import { useDownloadStore } from '@/features/datasets/stores/downloadStore'
import { useToast } from '@/shared/composables/useToast'
import { extractBackendError } from '@/shared/api/httpClient'
import { t } from '@/i18n'

const packingIds = reactive(new Set<string>())

export function useDownloadProgress() {
  const { showToast, removeToast } = useToast()
  const downloadStore = useDownloadStore()

  const isPacking = (id: string) => packingIds.has(id)

  /**
   * RAW pre-signed download: imzML + ibd from /files/{file_id}/download_raw.
   * Zero polling — pre-signed URLs are returned immediately.
   * Rate-limited: one download per cooldown window (60s default).
   */
  const handleDownloadRaw = async (
    id?: string,
    options?: { getFallbackFilename?: () => string | undefined },
  ) => {
    if (!id) return
    if (packingIds.has(id)) return

    // Client-side cooldown check to prevent repeated download requests.
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
      await ossDownloadRaw(id, options)
      downloadStore.completeDownload()
      removeToast(toastId)
      showToast(t('datasets.download.started'), 'success')
    } catch (error) {
      downloadStore.failDownload()
      removeToast(toastId)
      const status = (error as { response?: { status?: number } })?.response?.status
      const message =
        status === 403
          ? t('datasets.download.limitReached')
          : extractBackendError(error, t('datasets.download.failed'))
      showToast(message, 'error')
      console.error('Download error:', error)
    } finally {
      packingIds.delete(id)
    }
  }

  return { handleDownloadRaw, isPacking, packingIds }
}
