import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useToast } from '@/shared/composables/useToast'
import { formatBytes } from '@/shared/utils/format'
import {
  abortImzmlUpload,
  MIN_PUBLIC_IBD_SIZE,
  parseImzmlUploadMetadata,
  uploadImzmlDataset,
  type ImzmlFilePair,
  type UnifiedUploadProgress,
} from '@/features/upload/services/imzmlUploadService'
import { useUploadMetadataForm } from '@/features/upload/composables/useUploadMetadataForm'
import { useUploadResume } from '@/features/upload/composables/useUploadResume'

type UploadStage = 'select' | 'uploading' | 'success'

interface UseUploadFlowOptions {
  close: () => void
  uploadSuccess: (datasetName: string) => void
}

export function useUploadFlow(options: UseUploadFlowOptions) {
  // External composables
  const { showToast } = useToast()
  const metadataForm = useUploadMetadataForm()
  const resumeState = useUploadResume()

  // State
  const selectedPair = ref<ImzmlFilePair | null>(null)
  const uploading = ref(false)
  const progress = ref(0)
  const uploadMessage = ref('')
  const error = ref('')
  const stage = ref<UploadStage>('select')
  const parsingMetadata = ref(false)
  const speed = ref('')
  const eta = ref('')
  const pickerResetKey = ref(0)
  let abortController: AbortController | null = null
  const showPublicConfirm = ref(false)

  // Computed
  const formattedSize = computed(() => {
    if (!selectedPair.value) return ''
    return formatBytes(selectedPair.value.ibd.size + selectedPair.value.imzml.size)
  })

  // Methods
  const handleProgress = (progressInfo: UnifiedUploadProgress) => {
    progress.value = progressInfo.percent
    uploadMessage.value = progressInfo.message || `Stage: ${progressInfo.stage}`
    speed.value = progressInfo.speedStr || ''
    eta.value = progressInfo.etaStr || ''
    if (progressInfo.message?.includes('Fail') || progressInfo.message?.includes('Retrying')) {
      error.value = progressInfo.message
    }
  }

  const resetAll = () => {
    selectedPair.value = null
    uploading.value = false
    progress.value = 0
    speed.value = ''
    eta.value = ''
    uploadMessage.value = ''
    error.value = ''
    stage.value = 'select'
    abortController = null
    metadataForm.resetForm()
    pickerResetKey.value += 1
  }

  const closeModal = () => {
    if (uploading.value) return
    options.close()
    setTimeout(resetAll, 300)
  }

  const handlePairError = (message: string) => {
    showToast(message, 'error')
    selectedPair.value = null
    pickerResetKey.value += 1
  }

  const handlePairSelected = async (pair: ImzmlFilePair) => {
    error.value = ''
    selectedPair.value = pair
    metadataForm.resetParsedFields()
    parsingMetadata.value = true

    try {
      const settings = await parseImzmlUploadMetadata(pair.imzml)
      metadataForm.applyParsedSettings(settings)
    } catch (err: any) {
      showToast(err?.message || 'Failed to parse imzML metadata', 'error')
    } finally {
      parsingMetadata.value = false
    }
  }

  const startUploading = (message: string) => {
    uploading.value = true
    stage.value = 'uploading'
    progress.value = 0
    uploadMessage.value = message
    error.value = ''
    abortController = new AbortController()
  }

  const finishSuccessfully = (datasetName: string, reused = false) => {
    showToast(
      reused
        ? 'File already exists on server, reused without re-upload.'
        : 'Dataset pipeline successfully completed',
      'success',
    )
    uploading.value = false
    options.uploadSuccess(datasetName)
    closeModal()
  }

  const handleUploadError = (err: any, fallbackMessage: string) => {
    console.error(fallbackMessage, err)
    if (err.name === 'AbortError' || err.name === 'cancel') {
      showToast('Upload safely aborted', 'info')
      error.value = 'User aborted upload'
    } else {
      error.value = err.message || fallbackMessage
      showToast(error.value, 'error')
    }
    stage.value = 'select'
    resumeState.checkResume()
  }

  const resumeUpload = async () => {
    resumeState.pendingResume.value = false
    startUploading('Resuming upload...')

    try {
      const result = await uploadImzmlDataset({
        datasetName: resumeState.pendingDatasetName.value,
        signal: abortController!.signal,
        resume: true,
        onProgress: handleProgress,
      })
      finishSuccessfully(result?.datasetName || resumeState.pendingDatasetName.value)
    } catch (err: any) {
      handleUploadError(err, 'Resume upload failed')
    } finally {
      uploading.value = false
      abortController = null
    }
  }

  const abortUpload = () => {
    abortImzmlUpload()
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  const confirmAndUpload = async () => {
    if (!selectedPair.value) return

    const validationError = metadataForm.validateMetadata()
    if (validationError) {
      showToast(validationError, 'error')
      return
    }

    if (metadataForm.form.value.is_public && selectedPair.value.ibd.size < MIN_PUBLIC_IBD_SIZE) {
      const minSizeMB = MIN_PUBLIC_IBD_SIZE / (1024 * 1024)
      showToast(`IBD file must be at least ${minSizeMB} MB for public datasets.`, 'error')
      return
    }

    if (metadataForm.form.value.is_public) {
      showPublicConfirm.value = true
      return
    }

    await doUpload()
  }

  const proceedPublicUpload = async () => {
    showPublicConfirm.value = false
    await doUpload()
  }

  const cancelPublicUpload = () => {
    showPublicConfirm.value = false
  }

  const doUpload = async () => {
    if (!selectedPair.value) return
    const pair = selectedPair.value

    startUploading('Initializing Pipeline...')

    try {
      const payload = metadataForm.buildMetadataPayload()
      const result = await uploadImzmlDataset({
        files: pair,
        datasetName: pair.baseName,
        metadata: { ...payload, file_type: 'zip', is_public: metadataForm.form.value.is_public },
        signal: abortController!.signal,
        onProgress: handleProgress,
      })
      finishSuccessfully(result?.datasetName || pair.baseName, !!result?.reused)
    } catch (err: any) {
      handleUploadError(err, 'Pipeline sequence failed')
    } finally {
      uploading.value = false
      abortController = null
    }
  }

  // Lifecycle
  onMounted(resumeState.checkResume)

  // 组件卸载时中止上传，避免后台继续浪费带宽 + 回调已销毁组件
  onBeforeUnmount(() => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  })

  return {
    ...metadataForm,
    ...resumeState,
    selectedPair,
    uploading,
    progress,
    uploadMessage,
    error,
    stage,
    parsingMetadata,
    speed,
    eta,
    pickerResetKey,
    formattedSize,
    handlePairSelected,
    handlePairError,
    confirmAndUpload,
    proceedPublicUpload,
    cancelPublicUpload,
    showPublicConfirm,
    resumeUpload,
    abortUpload,
    closeModal,
  }
}
