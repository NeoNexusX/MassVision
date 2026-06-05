<script setup lang="ts">
import ResumeUploadBanner from '@/features/upload/components/ResumeUploadBanner.vue'
import UploadFilePicker from '@/features/upload/components/UploadFilePicker.vue'
import UploadMetadataForm from '@/features/upload/components/UploadMetadataForm.vue'
import UploadProgressPanel from '@/features/upload/components/UploadProgressPanel.vue'
import { useUploadFlow } from '@/features/upload/composables/useUploadFlow'

defineProps<{ isOpen: boolean }>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'upload-success', datasetName: string): void
}>()

const upload = useUploadFlow({
  close: () => emit('close'),
  uploadSuccess: (datasetName) => emit('upload-success', datasetName),
})
</script>

<template>
  <dialog class="modal" :class="{ 'modal-open': isOpen }">
    <div
      class="modal-box rounded-2xl w-11/12 max-w-2xl max-h-[90vh] flex flex-col text-base-content"
    >
      <h3 class="font-bold text-2xl mb-4 shrink-0">Upload New Dataset (imzML + ibd)</h3>

      <div v-if="upload.stage.value === 'select'" class="flex flex-col flex-1 min-h-0">
        <div class="flex-1 overflow-y-auto overflow-x-hidden -mx-6 px-6 pt-4 pb-4 flex flex-col gap-4">
          <ResumeUploadBanner
            v-if="upload.pendingResume.value"
            :dataset-name="upload.pendingDatasetName.value"
            @resume="upload.resumeUpload"
            @discard="upload.discardResume"
          />

          <UploadFilePicker
            :key="upload.pickerResetKey.value"
            :selected-pair="upload.selectedPair.value"
            :formatted-size="upload.formattedSize.value"
            :error="upload.error.value"
            :pending-resume="upload.pendingResume.value"
            @pair-selected="upload.handlePairSelected"
            @invalid-selection="upload.handlePairError"
          />

          <UploadMetadataForm
            :form="upload.form.value"
            :parsing-metadata="upload.parsingMetadata.value"
          />
        </div>

        <div
          class="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-base-200 shrink-0"
        >
          <button
            class="btn bg-blue-600 text-white hover:bg-blue-700 border-none"
            @click="upload.confirmAndUpload"
            :disabled="
              !upload.selectedPair.value || upload.uploading.value || upload.pendingResume.value
            "
          >
            Confirm & Upload
          </button>
          <button
            class="btn btn-ghost"
            @click="upload.closeModal"
            :disabled="upload.uploading.value"
          >
            Cancel
          </button>
        </div>
      </div>

      <UploadProgressPanel
        v-if="upload.stage.value === 'uploading'"
        :message="upload.uploadMessage.value"
        :progress="upload.progress.value"
        :speed="upload.speed.value"
        :eta="upload.eta.value"
        @abort="upload.abortUpload"
      />
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="upload.closeModal" :disabled="upload.stage.value === 'uploading'">
        close
      </button>
    </form>
  </dialog>
</template>
