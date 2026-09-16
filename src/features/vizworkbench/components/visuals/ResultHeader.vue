<template>
  <div class="flex min-w-0 items-start gap-3 sm:items-center">
    <h1 class="min-w-0 break-words kawaru-text-112 font-bold">
      {{ datasetName }}
    </h1>
    <StatusBadge v-if="status" :status="status" class="shrink-0 kawaru-text-75" />
  </div>
</template>

<script setup lang="ts">
import StatusBadge from '@/shared/components/StatusBadge.vue'

defineProps<{
  datasetName: string
  status?: string
}>()
</script>
