<template>
  <WorkspaceTable :rows="results || []" type="results" openRoute="WorkspaceResultDetail" />
</template>

<script setup lang="ts">
import WorkspaceTable from './WorkspaceTable.vue'

defineProps<{ results?: Array<any> }>()
</script>
