<template>
  <WorkspaceTable :rows="localResults" type="results" openRoute="WorkspaceResultDetail" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import WorkspaceTable from './WorkspaceTable.vue'
import { formatMethods as formatMethodsUtil } from '@/utils/methods-normalize'

const props = defineProps<{ results?: Array<any> }>()

const demo = [
  { id: 'r1', name: 'Result A', dataset: 'DS1', methods: ['TIC','Gaussian'], status: 'OK', created: '2026-04-11' },
  { id: 'r2', name: 'Result B', dataset: 'DS2', methods: ['RMS','Median'], status: 'Error', created: '2026-04-09' }
]

const localResults = computed(() => props.results && props.results.length ? props.results : demo)
</script>
