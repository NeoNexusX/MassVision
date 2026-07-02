import { ref } from 'vue'
import { deleteFile } from '@/features/datasets/api/datasetApi'
import {
  hasPendingUpload,
  loadUploadSession,
  cleanupResumable,
} from '@/features/upload/utils/uploadResume'

export function useUploadResume() {
  // State
  const pendingResume = ref(false)
  const pendingDatasetName = ref('')

  // Methods
  const checkResume = () => {
    if (hasPendingUpload()) {
      pendingResume.value = true
      const session = loadUploadSession()
      pendingDatasetName.value = session?.datasetName || ''
    } else {
      // No pending session — clean up any orphaned ZIP from a previous abort
      cleanupResumable()
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
