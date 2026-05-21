<script setup lang="ts">
defineProps<{
  message: string
  progress: number
  speed?: string
  eta?: string
}>()

defineEmits<{
  (e: 'abort'): void
}>()
</script>

<template>
  <div class="flex flex-col items-center gap-4 py-8">
    <div class="w-full">
      <div class="flex justify-between text-sm mb-2 font-medium">
        <span class="text-base-content/80">{{ message }}</span>
        <span class="text-primary">{{ progress }}%</span>
      </div>
      <progress class="progress progress-primary w-full h-3" :value="progress" max="100"></progress>
      <div
        v-if="speed || eta"
        class="flex justify-between items-center w-full mt-2 text-xs text-base-content/60 bg-base-200/50 py-1.5 px-3 rounded"
      >
        <div v-if="speed" class="flex items-center">⚡ {{ speed }}</div>
        <div v-if="eta" class="flex items-center">⏱️ ETA: {{ eta }}</div>
      </div>
    </div>
    <div class="w-full flex justify-end mt-4">
      <button class="btn btn-outline btn-error btn-sm" @click="$emit('abort')">Abort Upload</button>
    </div>
  </div>
</template>
