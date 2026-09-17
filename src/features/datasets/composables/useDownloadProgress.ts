import { reactive } from 'vue'
import {
  ossDownloadAndSave,
  ossDownloadRaw,
  ossDownloadRawNoauth,
} from '@/features/datasets/utils/downloadHelper'
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
   * RAW 下载的公共装配：并发去重（packingIds）、客户端限流（一次/冷却窗，默认 60s）、
   * downloadStore 状态机与 toast 生命周期。auth / no-auth 两个入口只差实际取数
   * 的 runner 与错误信息映射（mapError）。
   */
  const runRawDownload = async (
    publicId: string | undefined,
    runner: (id: string) => Promise<void>,
    mapError?: (error: unknown) => string | undefined,
  ) => {
    if (!publicId) return
    if (packingIds.has(publicId)) return

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

    packingIds.add(publicId)
    downloadStore.startDownload(publicId)
    const toastId = showToast(t('datasets.download.downloading'), 'info', 0)
    try {
      await runner(publicId)
      downloadStore.completeDownload()
      removeToast(toastId)
      showToast(t('datasets.download.started'), 'success')
    } catch (error) {
      downloadStore.failDownload()
      removeToast(toastId)
      const message = mapError?.(error) ?? extractBackendError(error, t('datasets.download.failed'))
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
  const handleDownloadRaw = (
    publicId?: string,
    options?: { getFallbackFilename?: () => string | undefined; isPublic?: boolean },
  ) =>
    runRawDownload(
      publicId,
      (id) => ossDownloadRaw(id, { ...options, isPublic: options?.isPublic ?? false }),
      (error) =>
        (error as { response?: { status?: number } })?.response?.status === 403
          ? t('datasets.download.limitReached')
          : undefined,
    )

  /**
   * RAW no-auth download for the public collection page:
   * /files/{public_id}/download_raw_noauth (backend serves is_public files only).
   */
  const handleDownloadPublicRaw = (publicId?: string) =>
    runRawDownload(publicId, (id) => ossDownloadRawNoauth(id))

  return { handleDownload, handleDownloadRaw, handleDownloadPublicRaw, isPacking, packingIds }
}
