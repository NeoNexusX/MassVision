import { ossDownloadAndSave } from '@/features/datasets/utils/downloadHelper'
import { useToast } from '@/shared/composables/useToast'

export function useDownloadProgress() {
  // External composables
  const { showToast } = useToast()

  // Methods
  const handleDownload = async (
    id?: string,
    options?: { getFallbackFilename?: () => string | undefined },
  ) => {
    if (!id) return
    try {
      showToast('Download started, please wait...', 'info')
      await ossDownloadAndSave(id, options)
    } catch (error) {
      showToast('Failed to download file', 'error')
      console.error('Download error:', error)
    }
  }

  return { handleDownload }
}
