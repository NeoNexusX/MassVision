<script setup lang="ts">
import type { ImzmlFilePair } from '@/features/upload/services/imzmlUploadService'

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
    emit('invalid-selection', 'Please select BOTH an .ibd and .imzml file simultaneously.')
    return
  }

  const baseName = imzml.name.substring(0, imzml.name.lastIndexOf('.'))
  emit('pair-selected', { ibd, imzml, baseName })
}
</script>

<template>
  <label class="form-control w-full shrink-0">
    <div class="label">
      <span class="label-text">Select an .imzML and .ibd file pair</span>
      <span class="label-text-alt text-error" v-if="error">{{ error }}</span>
    </div>
    <div
      class="relative flex items-center justify-between border border-base-content/20 rounded-lg px-3 py-2 bg-base-100 hover:bg-base-200/50 transition-colors overflow-hidden h-12"
    >
      <input
        type="file"
        multiple
        accept=".imzml,.ibd"
        @change="onFileChange"
        :disabled="pendingResume"
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        title="Select files"
      />
      <div class="flex items-center gap-3 w-full pointer-events-none">
        <template v-if="pendingResume">
          <div class="btn btn-sm btn-ghost no-animation shrink-0 opacity-50">Choose Files</div>
          <span class="text-sm text-warning truncate">
            Please resolve the pending upload above first
          </span>
        </template>
        <template v-else>
          <div class="btn btn-sm btn-neutral no-animation shrink-0">Choose Files</div>
          <span
            class="text-sm truncate w-full opacity-80"
            :class="{ 'opacity-50': !selectedPair }"
            >{{
              selectedPair
                ? `${selectedPair.imzml.name}, ${selectedPair.ibd.name}`
                : 'No file chosen'
            }}</span
          >
        </template>
      </div>
    </div>
    <div class="label mt-1 text-sm">
      <span v-if="selectedPair" class="text-success"
        >Ready: {{ selectedPair.baseName }} ({{ formattedSize }})</span
      >
      <span v-else class="text-base-content/60">No matched pair selected</span>
    </div>
  </label>
</template>
