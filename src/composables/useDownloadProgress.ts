import { ref } from 'vue';
import type { Ref } from 'vue';
import { ossDownloadAndSave } from '@/utils/download-helper';
import type { GetFallbackFilename } from '@/utils/download-helper';
import type { File } from '@/types/file';
import { useToast } from '@/composables/useToast';

export type HandleDownload = (id?: string, options?: { getFallbackFilename?: GetFallbackFilename }) => Promise<void>;

export function useDownloadProgress(datasets?: Ref<File[] | undefined>) {
  const downloadingMap = ref<Record<string, number>>({});
  const { showToast } = useToast();

  const handleDownload: HandleDownload = async (id, options) => {
    if (!id) return;
    if (downloadingMap.value[id] !== undefined) return; // Prevent concurrent requests

    try {
      downloadingMap.value[id] = 0;
      showToast('Download started, please wait...', 'info');

      await ossDownloadAndSave(id, {
        getFallbackFilename: options?.getFallbackFilename ?? (() => {
          const ds = datasets?.value?.find(d => d.id === id);
          return ds && ds.name ? (ds.name.toLowerCase().endsWith('.zip') ? ds.name : `${ds.name}.zip`) : undefined;
        }),
        onProgress: (p: number) => {
          downloadingMap.value[id] = p;
        }
      });

      showToast('Download completed successfully!', 'success');
    } catch (error) {
      showToast('Failed to download file', 'error');
      console.error('Download error:', error);
    } finally {
      delete downloadingMap.value[id as string];
    }
  };

  return { downloadingMap, handleDownload } as { downloadingMap: Ref<Record<string, number>>; handleDownload: HandleDownload };
}
