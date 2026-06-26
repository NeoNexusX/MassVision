<template>
  <WorkspaceTable :rows="results || []" type="results" :loading="loading" @delete="$emit('delete', $event)" @view-error="$emit('view-error', $event)" />
</template>

<script setup lang="ts">
import WorkspaceTable from './WorkspaceTable.vue'

defineProps<{ results?: Array<any>; loading?: boolean }>()
defineEmits<{ (e: 'delete', id: string): void; (e: 'view-error', errorMessage: string): void }>()
</script>
