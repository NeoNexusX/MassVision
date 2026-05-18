<template>
  <div class="flex flex-wrap items-center gap-3 px-1">
    <div class="flex items-center gap-2">
      <h1 class="text-lg font-bold truncate max-w-xs">{{ datasetName }}</h1>
      <span
        class="badge badge-sm"
        :class="statusClass"
      >{{ status }}</span>
    </div>

    <div class="divider divider-horizontal mx-0 hidden sm:flex" />

    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span v-for="item in chips" :key="item.label" class="inline-flex items-center gap-1.5 bg-base-200 rounded-full px-2.5 py-1">
        <span class="text-base-content/50">{{ item.label }}</span>
        <span class="font-medium text-base-content">{{ item.value }}</span>
      </span>
    </div>

    <div v-if="methods?.length" class="flex flex-wrap items-center gap-1.5 ml-auto">
      <span
        v-for="m in methods"
        :key="m"
        class="badge badge-outline badge-sm"
      >{{ m }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  datasetName: string
  analyzer?: string
  ionSource?: string
  pixelSize?: string
  status?: string
  methods?: string[]
}>()

const statusClass = computed(() => {
  switch (props.status) {
    case 'Completed': return 'badge-success'
    case 'Processing': return 'badge-warning'
    case 'Queued': return 'badge-info'
    case 'Error': return 'badge-error'
    default: return 'badge-ghost'
  }
})

const chips = computed(() => {
  const items: { label: string; value: string }[] = []
  if (props.analyzer) items.push({ label: 'Analyzer', value: props.analyzer })
  if (props.ionSource) items.push({ label: 'Source', value: props.ionSource })
  if (props.pixelSize) items.push({ label: 'Pixel Size', value: props.pixelSize })
  return items
})
</script>
