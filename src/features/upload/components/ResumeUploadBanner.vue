<script setup lang="ts">
defineProps<{
  datasetName: string
}>()

defineEmits<{
  (e: 'resume'): void
  (e: 'discard'): void
}>()
</script>

<template>
  <div class="alert bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
    <div class="flex items-center gap-1.5 mb-1.5">
      <SvgIcon type="info" class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
      <span class="text-sm font-semibold text-blue-800 dark:text-blue-300">Incomplete upload detected</span>
    </div>
    <p class="text-base text-blue-700 dark:text-blue-300 mb-2 break-all">
      You have a pending upload of <strong>{{ datasetName }}</strong
      >. Resume from where it left off?
    </p>
    <div class="flex gap-2">
      <button
        class="btn btn-sm bg-blue-600 hover:bg-blue-700 border-none text-white"
        @click="$emit('resume')"
      >
        Resume
      </button>
      <button class="btn btn-sm btn-ghost text-blue-600 dark:text-blue-400" @click="$emit('discard')">Discard</button>
    </div>
  </div>
</template>
