<script setup lang="ts">
import { I18nT } from 'vue-i18n'
import type { ImzmlFilePair } from '@/features/upload/services/imzmlUploadService'
import { t } from '@/i18n'

defineProps<{
  selectedPair: ImzmlFilePair | null
  formattedSize: string
  error?: string
  pendingResume?: boolean
}>()

const emit = defineEmits<{
  (e: 'pair-selected', pair: ImzmlFilePair): void
  (e: 'invalid-selection', message: string): void
}>()

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  let ibd: File | undefined
  let imzml: File | undefined

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file) continue
    if (file.name.toLowerCase().endsWith('.ibd')) ibd = file
    if (file.name.toLowerCase().endsWith('.imzml')) imzml = file
  }

  if (!ibd || !imzml) {
    input.value = ''
    emit('invalid-selection', t('upload.picker.errBoth'))
    return
  }

  // Validate that imzML and ibd share the same base name
  const imzmlBase = imzml.name.substring(0, imzml.name.lastIndexOf('.'))
  const ibdBase = ibd.name.substring(0, ibd.name.lastIndexOf('.'))
  if (imzmlBase !== ibdBase) {
    input.value = ''
    emit('invalid-selection', t('upload.picker.errMismatch', { imzml: imzml.name, ibd: ibd.name }))
    return
  }

  const baseName = imzmlBase || imzml.name
  emit('pair-selected', { ibd, imzml, baseName })
}
</script>

<template>
  <label class="form-control w-full shrink-0">
    <div class="label">
      <span class="label-text">{{
        pendingResume ? $t('upload.picker.reselectPair') : $t('upload.picker.selectPair')
      }}</span>
    </div>
    <div
      class="relative flex items-center justify-between border border-base-content/20 rounded-lg px-3 py-2 bg-base-100 hover:bg-base-200/50 transition-colors overflow-hidden min-h-12"
    >
      <input
        type="file"
        multiple
        accept=".imzml,.ibd"
        @change="onFileChange"
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
:title="$t('upload.picker.chooseFiles')"
      />
      <div class="flex items-center gap-3 w-full pointer-events-none">
        <div class="btn btn-sm btn-neutral no-animation shrink-0 kawaru-text-75">{{ $t('upload.picker.chooseFiles') }}</div>
        <span
          class="kawaru-text-112 min-w-0 flex-1 opacity-80 pointer-events-auto"
          :class="{ 'opacity-50': !selectedPair }"
          :title="selectedPair ? `${selectedPair.imzml.name}, ${selectedPair.ibd.name}` : ''"
          >{{
            selectedPair
              ? `${selectedPair.imzml.name}, ${selectedPair.ibd.name}`
              : pendingResume
                ? $t('upload.picker.chooseSamePair')
                : $t('upload.picker.noFileChosen')
          }}</span
        >
      </div>
    </div>
    <div class="mt-1 kawaru-text-112">
      <!--
        续传时「是否就绪」由上方横幅判定（要和待续传的那对文件一致），
        这里只报「选到了一对合法的 imzML+ibd」，不能抢着说 Ready，
        否则会和横幅的「文件不匹配」提示自相矛盾。
      -->
      <I18nT
        v-if="selectedPair && pendingResume"
        keypath="upload.picker.selected"
        tag="span"
        scope="global"
        class="text-base-content/70"
      >
        <template #name><span class="break-all">{{ selectedPair.baseName }}</span></template>
        <template #size>{{ formattedSize }}</template>
      </I18nT>
      <I18nT
        v-else-if="selectedPair"
        keypath="upload.picker.ready"
        tag="span"
        scope="global"
        class="text-success"
      >
        <template #name><span class="break-all">{{ selectedPair.baseName }}</span></template>
        <template #size>{{ formattedSize }}</template>
      </I18nT>
      <span v-else class="text-base-content/60">{{ $t('upload.picker.noPair') }}</span>
    </div>
    <div
      v-if="error"
      class="border border-error/30 bg-error/5 text-error rounded-lg px-4 py-3 mt-3 kawaru-text-100 break-all"
    >
      <span>{{ error }}</span>
    </div>
  </label>
</template>
