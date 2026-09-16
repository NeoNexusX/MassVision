<script setup lang="ts">
import ResumeUploadBanner from '@/features/upload/components/ResumeUploadBanner.vue'
import UploadFilePicker from '@/features/upload/components/UploadFilePicker.vue'
import UploadMetadataForm from '@/features/upload/components/UploadMetadataForm.vue'
import UploadProgressPanel from '@/features/upload/components/UploadProgressPanel.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { I18nT } from 'vue-i18n'
import { useUploadFlow } from '@/features/upload/composables/useUploadFlow'

defineProps<{ isOpen: boolean }>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'upload-success', datasetName: string): void
}>()

/**
 * 在 `<script setup>` 顶层解构。
 *
 * 这不是风格偏好：ref 嵌在普通对象里时模板**不会**自动解包，写成
 * `const upload = useUploadFlow()` 就得在模板里到处 `.value`，而漏写一个
 * （`!upload.selectedPair`）在类型上完全合法却恒为真值，vue-tsc 拦不住。
 * 顶层绑定才有自动解包，漏写的那类 bug 从根上消失。
 *
 * 解构拿到的是 ref 实例本身而非 `.value` 快照，响应式不丢。
 */
const {
  // 流程状态
  stage,
  uploading,
  progress,
  uploadMessage,
  speed,
  eta,
  compressSpeed,
  uploadSpeed,
  bottleneck,
  imzmlMilestone,
  doneSourceBytes,
  totalSourceBytes,
  aborting,
  // 三种出错语义各自独立
  pickerError,
  uploadError,
  retryInfo,
  // 文件与元数据
  selectedPair,
  formattedSize,
  parsingMetadata,
  pickerResetKey,
  form,
  detectedSpectrumMode,
  detectedStorageMode,
  // 续传
  pendingResume,
  pendingDatasetName,
  expectedResumeFiles,
  resumeReady,
  resumeHint,
  // 公开数据集二次确认
  showPublicConfirm,
  // 方法
  handlePairSelected,
  handlePairError,
  confirmAndUpload,
  proceedPublicUpload,
  cancelPublicUpload,
  resumeUpload,
  discardResume,
  abortUpload,
  closeModal,
} = useUploadFlow({
  close: () => emit('close'),
  uploadSuccess: (datasetName) => emit('upload-success', datasetName),
})
</script>

<template>
  <dialog class="modal" :class="{ 'modal-open': isOpen }">
    <div
      class="modal-box rounded-2xl w-11/12 max-w-2xl max-h-[90vh] flex flex-col text-base-content"
    >
      <h3 class="font-bold kawaru-text-150 mb-4 shrink-0">{{ $t('upload.modal.title') }}</h3>

      <div v-if="stage === 'select'" class="flex flex-col flex-1 min-h-0">
        <div
          class="flex-1 overflow-y-auto overflow-x-hidden -mx-6 px-6 pt-4 pb-4 flex flex-col gap-4"
        >
          <!--
            上传失败的致命错误。和文件选择器里的 pickerError 分开显示 ——
            合用一个 ref 的时候，一次网络失败会把红框挂到文件选择器上，
            读起来像是「你选的文件有问题」。
          -->
          <div
            v-if="uploadError"
            class="rounded-lg border border-error/30 bg-error/5 px-4 py-3 kawaru-text-100 text-error break-words"
          >
            {{ uploadError }}
          </div>

          <ResumeUploadBanner
            v-if="pendingResume"
            :dataset-name="pendingDatasetName"
            :expected-files="expectedResumeFiles"
            :can-resume="resumeReady"
            :hint="resumeHint"
            @resume="resumeUpload"
            @discard="discardResume"
          />

          <UploadFilePicker
            :key="pickerResetKey"
            :selected-pair="selectedPair"
            :formatted-size="formattedSize"
            :error="pickerError"
            :pending-resume="pendingResume"
            @pair-selected="handlePairSelected"
            @invalid-selection="handlePairError"
          />

          <UploadMetadataForm
            :form="form"
            :parsing-metadata="parsingMetadata"
            :detected-spectrum-mode="detectedSpectrumMode"
            :detected-storage-mode="detectedStorageMode"
          />
        </div>

        <div
          class="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-base-200 shrink-0"
        >
          <button
            class="btn bg-blue-600 text-white hover:bg-blue-700 border-none kawaru-text-87"
            @click="confirmAndUpload"
            :disabled="!selectedPair || uploading || pendingResume"
          >
            {{ $t('upload.modal.confirmUpload') }}
          </button>
          <button class="btn btn-ghost kawaru-text-87" @click="closeModal" :disabled="uploading">{{ $t('common.action.cancel') }}</button>
        </div>
      </div>

      <UploadProgressPanel
        v-if="stage === 'uploading'"
        :message="uploadMessage"
        :progress="progress"
        :speed="speed"
        :eta="eta"
        :compress-speed="compressSpeed"
        :upload-speed="uploadSpeed"
        :bottleneck="bottleneck"
        :imzml-milestone="imzmlMilestone"
        :done-source-bytes="doneSourceBytes"
        :total-source-bytes="totalSourceBytes"
        :retry="retryInfo"
        :aborting="aborting"
        @abort="abortUpload"
      />
    </div>

    <form method="dialog" class="modal-backdrop">
      <button @click="closeModal" :disabled="stage === 'uploading'">{{ $t('common.action.close') }}</button>
    </form>
  </dialog>

  <ConfirmDialog
    :open="showPublicConfirm"
:title="$t('upload.publicConfirm.title')"
    :confirm-label="$t('upload.publicConfirm.confirm')"
    danger
    @confirm="proceedPublicUpload"
    @cancel="cancelPublicUpload"
  >
    <I18nT keypath="upload.publicConfirm.body" tag="span" scope="global">
      <template #publicWord>
        <strong>{{ $t('upload.publicConfirm.publicWord') }}</strong>
      </template>
    </I18nT>
  </ConfirmDialog>
</template>
