<template>
  <div :class="['p-4 rounded-lg border shadow-sm', borderClass, bgClass]">
    <div class="text-base text-base-content/60">{{ title }}</div>
    <div :class="['mt-2 text-4xl font-bold', countClass]">{{ count }}</div>
    <div class="mt-1 text-base text-base-content/60">{{ subtitle }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  count: number | string
  subtitle?: string
  variant?: 'neutral' | 'info' | 'success' | 'error'
}>()

const borderClass = 'border-base-300'

const bgClass = computed(() => {
  switch (props.variant) {
    case 'info':    return 'bg-blue-50 dark:bg-blue-950'
    case 'success': return 'bg-green-50 dark:bg-green-950'
    case 'error':   return 'bg-red-50 dark:bg-red-950'
    default:        return 'bg-base-200 dark:bg-base-300'
  }
})

const countClass = computed(() => {
  switch (props.variant) {
    case 'info':    return 'text-blue-600 dark:text-blue-400'
    case 'success': return 'text-green-600 dark:text-green-400'
    case 'error':   return 'text-red-600 dark:text-red-400'
    default:        return 'text-base-content'
  }
})
</script>
