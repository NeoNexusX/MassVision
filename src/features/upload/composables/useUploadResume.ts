import { ref } from 'vue'
import { deleteFile } from '@/features/datasets/api/datasetApi'
import {
  hasPendingUpload,
  loadUploadSession,
  cleanupResumable,
  type UploadSourceIdentity,
} from '@/features/upload/utils/uploadResume'

export function useUploadResume() {
  // State
  const pendingResume = ref(false)
  const pendingDatasetName = ref('')
  /**
   * 上次上传所用的源文件身份。流式上传不再缓存 ZIP，续传必须让用户重新选择
   * 同一对文件重新压缩，因此要把「该选哪两个」显示出来并做校验。
   */
  const pendingSource = ref<UploadSourceIdentity | null>(null)

  // Methods
  const checkResume = () => {
    if (hasPendingUpload()) {
      pendingResume.value = true
      const session = loadUploadSession()
      pendingDatasetName.value = session?.datasetName || ''
      pendingSource.value = session?.source || null
    } else {
      // 没有待续传会话 —— 顺便清掉旧版本遗留在 OPFS 里的压缩缓存
      pendingResume.value = false
      pendingDatasetName.value = ''
      pendingSource.value = null
      cleanupResumable()
    }
  }

  const discardResume = async () => {
    const session = loadUploadSession()
    const filePublicId = session?.filePublicId
    await cleanupResumable()
    if (filePublicId) {
      await deleteFile(filePublicId).catch(() => {})
    }
    pendingResume.value = false
    pendingSource.value = null
  }

  return {
    pendingResume,
    pendingDatasetName,
    pendingSource,
    checkResume,
    discardResume,
  }
}
