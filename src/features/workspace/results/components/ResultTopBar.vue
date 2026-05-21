<script setup lang="ts">
defineProps<{
  meta: {
    datasetName: string
    status: string
  }
}>()
</script>

<template>
  <div class="shrink-0 flex items-center gap-3 px-6 py-2 border-b border-base-200 text-lg">
    <span class="font-semibold text-xl">{{ meta.datasetName }}</span>
    <span class="px-2 py-0.5 rounded text-base font-medium bg-green-100 text-green-700">
      {{ meta.status }}
    </span>
  </div>
</template>
