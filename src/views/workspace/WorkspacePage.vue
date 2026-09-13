<template>
  <div
    class="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 box-border overflow-x-hidden kawaru-text-100"
  >
    <!-- Header: Title + actions -->
    <div class="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
      <div>
        <h1 class="kawaru-text-page-title leading-[1.15] font-semibold">Workspace</h1>
        <p class="kawaru-text-100 text-base-content/60 mt-1">
          Monitor preprocessing tasks and review recent MSI results.
        </p>
      </div>
      <div class="flex flex-col sm:flex-row items-center gap-3 flex-shrink-0 w-full sm:w-auto">
        <router-link to="/mydatasets" class="btn btn-ghost btn-md sm:btn-lg w-full sm:w-auto kawaru-text-87"
          >Go to MyDatasets</router-link
        >
        <router-link to="/workspace/new" class="btn btn-primary btn-md sm:btn-lg w-full sm:w-auto kawaru-text-87"
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
      <div
        class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 sm:mb-4"
      >
        <h2 class="kawaru-text-125 sm:kawaru-text-150 font-medium">Recent Results</h2>
        <!-- 搜索：只按源文件名模糊匹配（服务端 RunFilter.filename），与数据集页一致。
             回车或点 Search 提交；清空输入框立即取消筛选。 -->
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <SearchInput
            v-model="searchQuery"
            placeholder="Search dataset"
            class="flex-1 sm:w-72 sm:flex-none"
            @update:model-value="onQueryInput"
            @search="onSearch"
          />
          <button class="btn btn-primary shrink-0 kawaru-text-100" @click="onSearch">Search</button>
        </div>
      </div>
      <ResultTable
        :results="recentResults"
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
        <p class="mt-2 kawaru-text-87 text-base-content/70 whitespace-pre-wrap break-all">
          {{ errorModalMessage }}
        </p>
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
import PaginationFooter from '@/shared/components/PaginationFooter.vue'
import SearchInput from '@/shared/components/SearchInput.vue'
import { useWorkspaceDashboard } from '@/features/workspace/dashboard/composables/useWorkspaceDashboard'
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
  applySearch,
} = useWorkspaceDashboard()

// ---- 结果列表搜索（服务端按源文件名模糊匹配） ----
// 输入框内容先落在 searchQuery，回车或点 Search 才提交给 composable，
// 因此只在提交后触发请求；清空输入框（✕）立即取消筛选。
const searchQuery = ref('')

function onSearch() {
  applySearch(searchQuery.value)
}

function onQueryInput(v: string) {
  searchQuery.value = v
  if (!v) applySearch('')
}

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
