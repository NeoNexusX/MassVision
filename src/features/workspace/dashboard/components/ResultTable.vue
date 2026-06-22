<template>
  <WorkspaceTable :rows="results || []" type="results" openRoute="WorkspaceResultDetail" :loading="loading" @delete="$emit('delete', $event)" />
</template>

<script setup lang="ts">
import WorkspaceTable from './WorkspaceTable.vue'

defineProps<{ results?: Array<any>; loading?: boolean }>()
defineEmits<{ (e: 'delete', id: string): void }>()
</script>
