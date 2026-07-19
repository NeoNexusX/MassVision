<template>
  <div class="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 box-border overflow-x-hidden page-type">
    <!-- Header: Title + actions -->
    <div class="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
      <div>
        <h1 class="page-title font-semibold">Workspace</h1>
        <p class="page-subtitle text-base-content/60 mt-1">
          Monitor preprocessing tasks and review recent MSI results.
        </p>
      </div>
      <div class="flex flex-col sm:flex-row items-center gap-3 flex-shrink-0 w-full sm:w-auto">
        <router-link to="/mydatasets" class="btn btn-ghost btn-md sm:btn-lg w-full sm:w-auto">Go to MyDatasets</router-link>
        <router-link to="/workspace/new" class="btn btn-primary btn-md sm:btn-lg w-full sm:w-auto">New Task</router-link>
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
      <section class="bg-base-100 rounded-lg border border-base-200 shadow-sm p-3 sm:p-4 lg:p-6">
        <h2 class="text-xl sm:text-2xl font-medium mb-3 sm:mb-4">Recent Results</h2>
        <ResultTable :results="recentResults" :loading="loading" @delete="onDeleteClick" @view-error="showErrorModal" />
      </section>
    </div>

    <!-- Pagination -->
    <div class="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="text-[1.1em] text-base-content text-center sm:text-left ml-2">
        Page <span class="font-medium">{{ meta.current_page }}</span> of
        <span class="font-medium">{{ meta.total_pages }}</span> —
        <span class="font-medium">{{ meta.total_records }}</span> records
      </div>

      <div class="flex flex-wrap items-center gap-4 mr-2">
        <div class="flex items-center gap-2">
          <label class="whitespace-nowrap text-[1.1em] text-base-content/60">Per page</label>
          <select
            :value="size"
            @change="(e) => changeSize(Number((e.target as HTMLSelectElement).value))"
            class="select select-sm select-bordered text-[1.1em] pl-3 pr-8"
          >
            <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>

        <PaginationBar
          :current-page="meta.current_page"
          :total-pages="meta.total_pages"
          :total-items="meta.total_records"
          :from="(meta.current_page - 1) * size + 1"
          :to="Math.min(meta.current_page * size, meta.total_records)"
          :page-range="pagination"
          class="!justify-center"
          @prev-page="() => goToPage(meta.current_page - 1)"
          @next-page="() => goToPage(meta.current_page + 1)"
          @go-to-page="goToPage"
        />
      </div>
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

    <!-- Error Modal for failed processes -->
    <ConfirmDialog
      :open="isErrorModalOpen"
      title="Process Failed"
      hide-confirm
      @cancel="isErrorModalOpen = false"
    >
      <div>
        <p class="font-medium">Error details:</p>
        <p class="mt-2 text-sm text-base-content/70 whitespace-pre-wrap break-all">{{ errorModalMessage }}</p>
      </div>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ResultTable from '@/features/workspace/dashboard/components/ResultTable.vue'
import CreateTaskModal from '@/features/workspace/dashboard/components/CreateTaskModal.vue'
import SummaryCard from '@/features/workspace/dashboard/components/SummaryCard.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import { useWorkspaceDashboard } from '@/features/workspace/dashboard/composables/useWorkspaceDashboard'
import { useToast } from '@/shared/composables/useToast'
import { getConfig } from '@/shared/config/runtimeConfig'

const { createOpen, recentResults, summary, loading, deletingId, size, meta, pagination, onCreated, goToPage, changeSize, deleteResult } = useWorkspaceDashboard()

const pageSizeOptions = getConfig().pagination.pageSizeOptions

// Delete
const { showToast } = useToast()
const isDeleteModalOpen = ref(false)
const resultToDelete = ref<string | null>(null)

// Error modal for failed processes
const isErrorModalOpen = ref(false)
const errorModalMessage = ref('')

function showErrorModal(message: string) {
  errorModalMessage.value = message
  isErrorModalOpen.value = true
}

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
