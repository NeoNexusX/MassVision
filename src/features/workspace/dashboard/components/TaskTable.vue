<template>
  <WorkspaceTable :rows="tasks || []" type="running" openRoute="WorkspaceTaskDetail" />
</template>

<script setup lang="ts">
import WorkspaceTable from './WorkspaceTable.vue'

defineProps<{ tasks?: Array<any> }>()
</script>
