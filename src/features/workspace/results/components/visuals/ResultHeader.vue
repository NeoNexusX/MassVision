<template>
  <div class="flex items-center gap-3">
    <h1 class="text-xl font-bold">{{ datasetName }}</h1>
    <span
      v-if="status"
      class="px-3 py-1 rounded-full text-base font-semibold"
      :class="statusClass"
    >{{ status }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  datasetName: string
  status?: string
}>()

const statusClass = computed(() => {
  switch (props.status) {
    case 'completed':
      return 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200'
    case 'processing':
      return 'bg-yellow-200 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
    case 'failed':
      return 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200'
    default:
      return 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
  }
})
</script>
