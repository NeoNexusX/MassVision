<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 box-border overflow-x-hidden">
    <!-- Header: Title + actions -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-4xl font-semibold">Workspace</h1>
        <p class="text-lg text-base-content/60 mt-1">
          Monitor preprocessing tasks and review recent MSI results.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <router-link to="/my-datasets" class="btn btn-ghost btn-lg">Go to MyDatasets</router-link>
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

    <!-- Main content -->
    <div class="flex flex-col gap-8">
      <section class="bg-base-100 rounded-lg border border-base-200 shadow-sm p-6">
        <h2 class="text-2xl font-medium mb-4">Running Tasks</h2>
        <TaskTable :tasks="runningTasks" />
      </section>

      <section class="bg-base-100 rounded-lg border border-base-200 shadow-sm p-6">
        <h2 class="text-2xl font-medium mb-4">Recent Results</h2>
        <ResultTable :results="recentResults" @delete="onDeleteClick" />
      </section>

      <section class="bg-base-100 rounded-lg border border-base-200 shadow-sm p-6">
        <ActivityList :activities="recentActivities" />
      </section>
    </div>

    <CreateTaskModal v-model:open="createOpen" @created="onCreated" />

    <!-- Delete Confirmation Modal -->
    <ConfirmDialog
      :open="isDeleteModalOpen"
      title="Delete Result"
      :message="`Are you sure you want to delete this result? This action cannot be undone.`"
      confirm-label="Delete"
      :danger="true"
      :loading="!!deletingId"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import TaskTable from '@/features/workspace/dashboard/components/TaskTable.vue'
import ResultTable from '@/features/workspace/dashboard/components/ResultTable.vue'
import CreateTaskModal from '@/features/workspace/dashboard/components/CreateTaskModal.vue'
import SummaryCard from '@/features/workspace/dashboard/components/SummaryCard.vue'
import ActivityList from '@/features/workspace/dashboard/components/ActivityList.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { useWorkspaceDashboard } from '@/features/workspace/dashboard/composables/useWorkspaceDashboard'
import { useToast } from '@/shared/composables/useToast'

const { createOpen, runningTasks, recentResults, recentActivities, summary, onCreated, deletingId, deleteResult } = useWorkspaceDashboard()

// Delete
const { showToast } = useToast()
const isDeleteModalOpen = ref(false)
const resultToDelete = ref<string | null>(null)

function onDeleteClick(id: string) {
  resultToDelete.value = id
  isDeleteModalOpen.value = true
}

async function confirmDelete() {
  if (!resultToDelete.value) return
  isDeleteModalOpen.value = false
  try {
    await deleteResult(resultToDelete.value)
    showToast('Result deleted successfully', 'success')
  } catch (e: any) {
    showToast(e?.message || 'Failed to delete result', 'error')
  } finally {
    resultToDelete.value = null
  }
}

function cancelDelete() {
  isDeleteModalOpen.value = false
  resultToDelete.value = null
}
</script>
