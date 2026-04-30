<template>
  <WorkspaceTable :rows="localTasks" type="running" openRoute="WorkspaceTaskDetail" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import WorkspaceTable from './WorkspaceTable.vue'
import { formatMethods as formatMethodsUtil } from '@/utils/methods-normalize'

const props = defineProps<{ tasks?: Array<any> }>()

const demo = [
  { id: 1, name: 'Preprocessing A', dataset: 'DS1', methods: ['TIC', 'Gaussian'], status: 'Running', progress: 42, created: '2026-04-10 11:22' },
  { id: 2, name: 'Peak picking B', dataset: 'DS2', methods: ['RMS', 'Median'], status: 'Completed', progress: 100, created: '2026-04-08 09:10' },
  { id: 3, name: 'Baseline correction C', dataset: 'DS3', methods: ['Baseline correction'], status: 'Failed', progress: 12, created: '2026-04-12 14:03' }
]

const localTasks = computed(() => props.tasks && props.tasks.length ? props.tasks : demo)
</script>
