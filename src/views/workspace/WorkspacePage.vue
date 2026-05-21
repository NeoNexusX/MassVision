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
import { ref, computed, onMounted } from 'vue'
import TaskTable from '@/components/workspace/TaskTable.vue'
import ResultTable from '@/components/workspace/ResultTable.vue'
import CreateTaskModal from '@/components/workspace/CreateTaskModal.vue'
import SummaryCard from '@/components/workspace/SummaryCard.vue'
import ActivityList from '@/components/workspace/ActivityList.vue'
import { listMyProcesses } from '@/utils/file-api'
import { parseAlgorithms } from '@/utils/methods-normalize'
import { listUserFiles } from '@/utils/file-api'

interface ProcessItem {
  id: number
  status: string
  params_json: string
  source_file_id: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  error_message: string | null
}

const processes = ref<ProcessItem[]>([])
const fileNames = ref<Record<number, string>>({})
const loading = ref(false)

async function fetchProcesses() {
  loading.value = true
  try {
    const [procData, filesRes] = await Promise.all([
      listMyProcesses(),
      listUserFiles({}, 1, 100),
    ])
    processes.value = procData
    const nameMap: Record<number, string> = {}
    for (const f of filesRes.data || filesRes) {
      nameMap[f.file_id || f.id] = (f.filename || f.name || '').replace(/\.[^.]+$/, '')
    }
    fileNames.value = nameMap
  } catch (e) {
    console.error('Failed to fetch processes:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchProcesses())

function getFileName(fileId: number): string {
  return fileNames.value[fileId] || `File ${fileId}`
}

function mapStatus(s: string): string {
  if (s === 'processing') return 'Running'
  if (s === 'completed') return 'Completed'
  if (s === 'failed') return 'Failed'
  if (s === 'queued') return 'Queued'
  return s
}

const tasks = computed(() =>
  processes.value
    .filter(p => ['processing', 'queued'].includes(p.status))
    .map(p => ({
      id: String(p.id),
      name: `Process #${p.id}`,
      dataset: getFileName(p.source_file_id),
      methods: parseAlgorithms(p.params_json),
      status: mapStatus(p.status),
      progress: p.status === 'processing' ? 50 : 0,
      created: new Date(p.created_at).toLocaleString(),
    }))
)

const results = computed(() =>
  processes.value
    .filter(p => ['completed', 'failed'].includes(p.status))
    .map(p => ({
      id: String(p.id),
      name: `Process #${p.id}`,
      dataset: getFileName(p.source_file_id),
      methods: parseAlgorithms(p.params_json),
      status: p.status === 'completed' ? 'OK' : 'Error',
      created: new Date(p.finished_at || p.created_at).toLocaleDateString(),
    }))
)

const createOpen = ref(false)

const onCreated = () => {
  createOpen.value = false
  fetchProcesses()
}

const runningTasks = computed(() => tasks.value)
const recentResults = computed(() => results.value.slice(0, 10))

const summary = computed(() => ({
  running: tasks.value.length,
  completed: results.value.filter((r: any) => r.status === 'OK').length,
  failed: results.value.filter((r: any) => r.status !== 'OK').length,
}))
</script>
