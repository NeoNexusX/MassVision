<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 box-border overflow-x-hidden">
    <!-- Header: Title + actions -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-3xl font-semibold">Workspace</h1>
        <p class="text-base text-base-content/60 mt-1">
          Monitor preprocessing tasks and review recent MSI results.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <router-link to="/my-datasets" class="btn btn-ghost">Go to MyDatasets</router-link>
        <router-link to="/workspace/new" class="btn btn-primary btn-lg">New Task</router-link>
      </div>
    </div>

    <!-- Summary: moved to top, horizontal cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <SummaryCard
        title="Running"
        :count="summary.running"
        subtitle="Active preprocessing tasks"
        variant="info"
      />
      <SummaryCard
        title="Completed"
        :count="summary.completed"
        subtitle="Successfully completed"
        variant="success"
      />
      <SummaryCard
        title="Failed"
        :count="summary.failed"
        subtitle="Requires review"
        variant="error"
      />
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
import TaskTable from '@/features/workspace/dashboard/components/TaskTable.vue'
import ResultTable from '@/features/workspace/dashboard/components/ResultTable.vue'
import CreateTaskModal from '@/features/workspace/dashboard/components/CreateTaskModal.vue'
import SummaryCard from '@/features/workspace/dashboard/components/SummaryCard.vue'
import ActivityList from '@/features/workspace/dashboard/components/ActivityList.vue'
import { useWorkspaceDashboard } from '@/features/workspace/dashboard/composables/useWorkspaceDashboard'

const { createOpen, runningTasks, recentResults, summary, onCreated } = useWorkspaceDashboard()
</script>
