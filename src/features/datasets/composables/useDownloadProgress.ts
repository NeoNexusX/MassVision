import { reactive } from 'vue'
import { ossDownloadAndSave } from '@/features/datasets/utils/downloadHelper'
import { useToast } from '@/shared/composables/useToast'

const packingIds = reactive(new Set<string>())

export function useDownloadProgress() {
  const { showToast, removeToast } = useToast()

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
      showToast('Failed to download file', 'error')
      console.error('Download error:', error)
    } finally {
      packingIds.delete(id)
    }
  }

  return { handleDownload, isPacking, packingIds }
}
