import { reactive } from 'vue'
import { ossDownloadAndSave, ossDownloadRaw } from '@/features/datasets/utils/downloadHelper'
import { useDownloadStore } from '@/features/datasets/stores/downloadStore'
import { useToast } from '@/shared/composables/useToast'
import axios from 'axios'

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
    const toastId = showToast('Preparing download, please wait...', 'info', 0)
    try {
      await ossDownloadAndSave(id, options)
      removeToast(toastId)
    } catch (error) {
      removeToast(toastId)
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.message || error.message)
        : 'Failed to download file'
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
    options?: { getFallbackFilename?: () => string | undefined },
  ) => {
    if (!id) return
    if (packingIds.has(id)) return

    // Rate-limit check
    if (!downloadStore.canDownload()) {
      const remain = Math.ceil(downloadStore.cooldownRemaining())
      showToast(
        `Download is limited. Please wait ${remain}s.`,
        'warning',
      )
      return
    }

    packingIds.add(id)
    downloadStore.startDownload(id)
    const toastId = showToast('Downloading...', 'info', 0)
    try {
      await ossDownloadRaw(id, options)
      downloadStore.completeDownload()
      removeToast(toastId)
      showToast('Download started', 'success')
    } catch (error) {
      downloadStore.failDownload()
      removeToast(toastId)
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.message || error.message)
        : 'Failed to download file'
      showToast(message, 'error')
      console.error('Download error:', error)
    } finally {
      packingIds.delete(id)
    }
  }

  return { handleDownload, handleDownloadRaw, isPacking, packingIds }
}
