<template>
  <WorkspaceTable :rows="tasks || []" type="running" openRoute="WorkspaceTaskDetail" :loading="loading" />
</template>

<script setup lang="ts">
import WorkspaceTable from './WorkspaceTable.vue'

defineProps<{ tasks?: Array<any>; loading?: boolean }>()
</script>
