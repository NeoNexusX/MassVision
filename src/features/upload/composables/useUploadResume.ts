import { ref } from 'vue'
import { deleteFile } from '@/features/datasets/api/datasetApi'
import {
  hasPendingUpload,
  loadUploadSession,
  cleanupResumable,
} from '@/features/upload/utils/uploadResume'

export function useUploadResume() {
  const pendingResume = ref(false)
  const pendingDatasetName = ref('')

  const checkResume = () => {
    if (hasPendingUpload()) {
      pendingResume.value = true
      const session = loadUploadSession()
      pendingDatasetName.value = session?.datasetName || ''
    }
  }

  const discardResume = async () => {
    const session = loadUploadSession()
    const fileId = session?.fileId
    cleanupResumable()
    if (fileId) {
      await deleteFile(fileId).catch(() => {})
    }
    pendingResume.value = false
  }

  return {
    pendingResume,
    pendingDatasetName,
    checkResume,
    discardResume,
  }
}
