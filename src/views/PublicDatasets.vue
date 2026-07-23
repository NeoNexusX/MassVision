<script setup lang="ts">
import { ref } from 'vue'
import DatasetList from '@/features/datasets/components/DatasetList.vue'
import DatasetFilterBar from '@/features/datasets/components/DatasetFilterBar.vue'
import UploadModal from '@/features/upload/components/UploadModal.vue'
import ExploreConfirmDialog from '@/features/datasets/components/ExploreConfirmDialog.vue'
import { listFiles } from '@/features/datasets/api/datasetApi'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { useDatasetListPage } from '@/features/datasets/composables/useDatasetListPage'
import { useExploreDataset } from '@/features/datasets/composables/useExploreDataset'
import { useRequireAuth } from '@/shared/composables/useRequireAuth'
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
  size,
  pagination,
  handleSort,
  handleSearch,
  handleStatusFilter,
  handleApplyFilters,
  goToPage,
  changeSize,
  refreshCurrentPage,
  viewOverview,
} = useDatasetListPage(fetcher, {
  source: 'public',
  defaultFilters: initialFilters,
})

// shared download progress composable
const { handleDownloadRaw, packingIds } = useDownloadProgress()

// Explore composable
const explore = useExploreDataset()
const { showExploreConfirm, isConverting } = explore

/** 需要登录的操作：未登录则跳转登录页 */
const { requireAuth } = useRequireAuth('/datasets')

// Upload modal state
const isUploadOpen = ref(false)

// Card actions
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
  refreshCurrentPage()
}
</script>

<template>
  <div class="min-h-screen bg-base-200">
    <div class="max-w-[1680px] mx-auto p-4 md:p-8 page-type">
      <h1 class="page-title font-bold text-base-content mb-6">Public Datasets</h1>

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
      <ExploreConfirmDialog
        :open="showExploreConfirm"
        :loading="isConverting"
        @confirm="explore.confirmExplore"
        @cancel="explore.cancelExplore"
      />
    </div>
  </div>
</template>
