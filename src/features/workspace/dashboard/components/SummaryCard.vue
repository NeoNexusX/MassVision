<template>
  <div :class="['p-4 rounded-lg border', 'border-base-200', 'shadow-sm', colorClass]">
    <div class="text-sm text-base-content/60">{{ title }}</div>
    <div class="mt-2 text-3xl font-bold">{{ count }}</div>
    <div class="mt-1 text-sm text-base-content/60">{{ subtitle }}</div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  count: number | string
  subtitle?: string
  variant?: 'neutral' | 'info' | 'success' | 'error'
}>()

const colorClass = (() => {
  switch (props.variant) {
    case 'info':
      return 'bg-white'
    case 'success':
      return 'bg-white'
    case 'error':
      return 'bg-white'
    default:
      return 'bg-white'
  }
})()
</script>
