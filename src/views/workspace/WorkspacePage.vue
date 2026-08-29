<template>
  <div
    class="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 box-border overflow-x-hidden page-type"
  >
    <!-- Header: Title + actions -->
    <div class="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
      <div>
        <h1 class="page-title font-semibold">Workspace</h1>
        <p class="page-subtitle text-base-content/60 mt-1">
          Monitor preprocessing tasks and review recent MSI results.
        </p>
      </div>
      <div class="flex flex-col sm:flex-row items-center gap-3 flex-shrink-0 w-full sm:w-auto">
        <router-link to="/mydatasets" class="btn btn-ghost btn-md sm:btn-lg w-full sm:w-auto"
          >Go to MyDatasets</router-link
        >
        <router-link to="/workspace/new" class="btn btn-primary btn-md sm:btn-lg w-full sm:w-auto"
          >New Task</router-link
        >
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
    <section class="bg-base-100 rounded-lg border border-base-200 shadow-sm p-3 sm:p-4 lg:p-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 sm:mb-4">
        <h2 class="text-xl sm:text-2xl font-medium">Recent Results</h2>
        <!-- 可见搜索框：按名称/数据集/方法过滤当前页结果 -->
        <div class="relative w-full sm:w-72">
          <svg-icon
            type="search"
            class="w-4 h-4 text-base-content/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search name / dataset / method"
            class="input input-bordered input-md w-full pl-8"
          />
        </div>
      </div>
      <ResultTable
        :results="filteredResults"
        :loading="loading"
        @delete="onDeleteClick"
        @view-error="showErrorModal"
      />
    </section>

    <!-- Pagination -->
    <PaginationFooter
      :current-page="meta.current_page"
      :total-pages="meta.total_pages"
      :total-items="meta.total_records"
      :size="size"
      :page-range="pagination"
      @go-to-page="goToPage"
      @change-size="changeSize"
    />

    <CreateTaskModal v-model:open="createOpen" @created="onCreated" />

    <!-- Delete Confirmation Modal -->
    <ConfirmDialog
      :open="deleteConfirm.isOpen"
      title="Delete Result"
      :message="`Are you sure you want to delete this result? This action cannot be undone.`"
      confirm-label="Delete"
      :danger="true"
      :loading="deleteConfirm.deleting"
      @confirm="deleteConfirm.confirm"
      @cancel="deleteConfirm.cancel"
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
        <p class="mt-2 text-sm text-base-content/70 whitespace-pre-wrap break-all">
          {{ errorModalMessage }}
        </p>
      </div>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ResultTable from '@/features/workspace/dashboard/components/ResultTable.vue'
import CreateTaskModal from '@/features/workspace/dashboard/components/CreateTaskModal.vue'
import SummaryCard from '@/features/workspace/dashboard/components/SummaryCard.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import PaginationFooter from '@/shared/components/PaginationFooter.vue'
import { useWorkspaceDashboard, type TaskRow } from '@/features/workspace/dashboard/composables/useWorkspaceDashboard'
import { useConfirmDelete } from '@/shared/composables/useConfirmDelete'

const {
  createOpen,
  recentResults,
  summary,
  loading,
  size,
  meta,
  pagination,
  onCreated,
  goToPage,
  changeSize,
  deleteResult,
} = useWorkspaceDashboard()

// ---- 结果列表搜索（可见输入框，按任务名 / 数据集 / 方法过滤） ----
const searchQuery = ref('')
const filteredResults = computed<TaskRow[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return recentResults.value
  return recentResults.value.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.dataset.toLowerCase().includes(q) ||
      r.methods.some((m) => m.toLowerCase().includes(q)),
  )
})

// Delete — shared composable
const deleteConfirm = useConfirmDelete({
  onDelete: async (id) => {
    await deleteResult(id)
  },
  successMessage: 'Result deleted successfully',
})

// Error modal for failed processes
const isErrorModalOpen = ref(false)
const errorModalMessage = ref('')

function showErrorModal(message: string) {
  errorModalMessage.value = message
  isErrorModalOpen.value = true
}

function onDeleteClick(id: string) {
  deleteConfirm.open(id)
}
</script>
