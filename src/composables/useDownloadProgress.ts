import { ossDownloadAndSave } from '@/utils/download-helper';
import { useToast } from '@/composables/useToast';

export function useDownloadProgress() {
  const { showToast } = useToast();

  const handleDownload = async (id?: string) => {
    if (!id) return;
    try {
      showToast('Download started, please wait...', 'info');
      await ossDownloadAndSave(id);
    } catch (error) {
      showToast('Failed to download file', 'error');
      console.error('Download error:', error);
    }
  };

  return { handleDownload };
}
