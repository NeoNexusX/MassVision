<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 box-border overflow-x-hidden">
    <!-- Header: Title + actions -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-3xl font-semibold">Workspace</h1>
        <p class="text-base text-base-content/60 mt-1">Monitor preprocessing tasks and review recent MSI results.</p>
      </div>
      <div class="flex items-center gap-3">
        <router-link to="/my-datasets" class="btn btn-ghost">Go to MyDatasets</router-link>
        <router-link to="/workspace/new" class="btn btn-primary btn-lg">New Task</router-link>
      </div>
    </div>

    <!-- Summary: moved to top, horizontal cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <SummaryCard title="Running" :count="summary.running" subtitle="Active preprocessing tasks" variant="info" />
      <SummaryCard title="Completed" :count="summary.completed" subtitle="Successfully completed" variant="success" />
      <SummaryCard title="Failed" :count="summary.failed" subtitle="Requires review" variant="error" />
    </div>

    <!-- Main content: single column (Running Tasks then Recent Results) -->
    <div class="flex flex-col gap-8">
      <section class="bg-base-100 rounded-lg border border-base-200 shadow-sm p-6">
        <h2 class="text-xl font-medium mb-4">Running Tasks</h2>
        <TaskTable :tasks="runningTasks" />
      </section>

      <section class="bg-base-100 rounded-lg border border-base-200 shadow-sm p-6">
        <h2 class="text-xl font-medium mb-4">Recent Results</h2>
        <ResultTable :results="recentResults" />
      </section>

      <section>
        <ActivityList />
      </section>
    </div>

    <CreateTaskModal v-model:open="createOpen" @created="onCreated" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import TaskTable from '@/components/workspace/TaskTable.vue'
import ResultTable from '@/components/workspace/ResultTable.vue'
import CreateTaskModal from '@/components/workspace/CreateTaskModal.vue'
import SummaryCard from '@/components/workspace/SummaryCard.vue'
import ActivityList from '@/components/workspace/ActivityList.vue'

// demo data - replace with real composable/api
const tasks = ref([
  { id: 't1', name: 'Preprocessing A', dataset: 'DS1', methods: ['TIC Normalization','Gaussian Smoothing'], status: 'Running', progress: 42, created: '2026-04-10 11:22' },
  { id: 't2', name: 'Preprocessing B', dataset: 'DS2', methods: ['RMS Normalization'], status: 'Queued', progress: 0, created: '2026-04-12 09:10' }
])

const results = ref([
  { id: 'r1', name: 'Result A', dataset: 'DS1', methods: ['TIC Normalization','Gaussian Smoothing'], status: 'OK', created: '2026-04-11' },
  { id: 'r2', name: 'Result B', dataset: 'DS2', methods: ['RMS Normalization','Median Normalization'], status: 'Error', created: '2026-04-09' }
])

const createOpen = ref(false)

const openCreate = () => createOpen.value = true
const onCreated = (payload: any) => {
  // push new task and close
  tasks.value.unshift(payload)
  createOpen.value = false
}

const runningTasks = computed(() => tasks.value.filter((t: any) => ['Running','Queued'].includes(t.status)))
const recentResults = computed(() => results.value.slice(0, 10))

const summary = computed(() => ({ running: runningTasks.value.length, completed: results.value.filter((r: any) => r.status === 'OK').length, failed: results.value.filter((r: any) => r.status !== 'OK').length }))
</script>
