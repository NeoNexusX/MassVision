<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DatasetList from '@/features/datasets/components/DatasetList.vue'
import DatasetFilterBar from '@/features/datasets/components/DatasetFilterBar.vue'
import UploadModal from '@/features/upload/components/UploadModal.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { listFiles } from '@/features/datasets/api/datasetApi'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { useDatasetList } from '@/features/datasets/composables/useDatasetList'
import { useDatasetListRouteState } from '@/features/datasets/composables/useDatasetListRouteState'
import { useExploreDataset } from '@/features/datasets/composables/useExploreDataset'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { useToast } from '@/shared/composables/useToast'
import { createDefaultDatasetFilters } from '@/features/datasets/constants/datasetMetadata'

// Use composable for datasets (fetch/map/pagination/sort)
const initialFilters = createDefaultDatasetFilters()

const fetcher = async (f: Record<string, any>, p: number, s: number) => {
  return await listFiles(f, p, s, true)  // 列表加载不需要登录
}

const {
  datasets,
  loading,
  error,
  meta,
  page,
  size,
  fetchFiles,
  applyFilters,
  handleSort,
  goToPage: dsGoToPage,
  changeSize: dsChangeSize,
  pagination,
} = useDatasetList(fetcher, {
  defaultFilters: initialFilters,
  initialSort: 'submission_time',
  initialDesc: true,
})

const router = useRouter()
const auth = useAuthStore()
const { showToast } = useToast()

// shared download progress composable
const { handleDownloadRaw, packingIds } = useDownloadProgress()

// Explore composable
const explore = useExploreDataset()
const { showExploreConfirm, isConverting } = explore

// Upload modal state
const isUploadOpen = ref(false)

/** 需要登录的操作：未登录则跳转登录页 */
const requireAuth = (): boolean => {
  if (!auth.token) {
    showToast('Please log in to continue.', 'warning')
    router.push({ path: '/login', query: { redirect: '/datasets' } })
    return false
  }
  return true
}

// Card actions
const viewOverview = (fileId: string) => {
  // Overview 不需要登录
  router.push({ name: 'DatasetOverview', state: { fileId, source: 'public' } })
}

const handleDownload = (id?: string) => {
  if (!id) return
  if (!requireAuth()) return
  handleDownloadRaw(id)
}

const handleExplore = (id?: string) => {
  if (!id) return
  if (!requireAuth()) return
  explore.handleExplore(id, datasets.value)
}

const handleUpload = () => {
  if (!requireAuth()) return
  isUploadOpen.value = true
}

const handleUploadSuccess = (_datasetName: string) => {
  isUploadOpen.value = false
  fetchFiles({ page: page.value, size: size.value })
}

const { handleSearch, handleStatusFilter, handleApplyFilters, goToPage, changeSize } =
  useDatasetListRouteState({
    page,
    size,
    meta,
    auth,
    fetchFiles,
    applyFilters,
    goToPage: dsGoToPage,
    changeSize: dsChangeSize,
  })
</script>

<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <div class="max-w-[1680px] mx-auto">
      <h1 class="text-4xl font-bold text-base-content mb-6">Public Datasets</h1>

      <DatasetFilterBar
        :show-add-filter="true"
        :show-upload="true"
        search-placeholder="Search Datasets"
        @upload="handleUpload"
        @search="handleSearch"
        @filter-status="handleStatusFilter"
        @apply-filters="handleApplyFilters"
        @sort="handleSort"
      />

      <UploadModal
        :is-open="isUploadOpen"
        @close="isUploadOpen = false"
        @upload-success="handleUploadSuccess"
      />

      <div>
        <DatasetList
          :datasets="datasets"
          :loading="loading"
          :error="error"
          :meta="meta"
          :size="size"
          :pagination="pagination"
          :packingIds="packingIds"
          @view-overview="viewOverview"
          @download="handleDownload"
          @explore="handleExplore"
          @change-size="changeSize"
          @go-to-page="goToPage"
        >
          <template #empty> No public datasets found matching your filters. </template>
        </DatasetList>
      </div>

      <!-- Explore / Raw-Convert Confirmation -->
      <ConfirmDialog
        :open="showExploreConfirm"
        title="Prepare Visualization"
        confirm-label="Generate"
        :loading="isConverting"
        @confirm="explore.confirmExplore"
        @cancel="explore.cancelExplore"
      >
        <p class="mb-3">This dataset hasn't been prepared for visualization. We'll generate an optimized view for fast interactive browsing.</p>
        <ul class="text-sm text-base-content/70 space-y-1.5">
          <li>
            <span class="font-semibold text-base-content">Task creator:</span>
            the task will appear in your Workspace and you'll be redirected there.
          </li>
          <li>
            <span class="font-semibold text-base-content">No redirect:</span>
            the task already exists — just wait and you can visualize it shortly.
          </li>
        </ul>
      </ConfirmDialog>
    </div>
  </div>
</template>
