<script setup lang="ts">
import { useRouter } from 'vue-router'
import DatasetList from '@/features/datasets/components/DatasetList.vue'
import DatasetFilterBar from '@/features/datasets/components/DatasetFilterBar.vue'
import { listFiles } from '@/features/datasets/api/datasetApi'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { useDatasetList } from '@/features/datasets/composables/useDatasetList'
import { useDatasetListRouteState } from '@/features/datasets/composables/useDatasetListRouteState'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { createDefaultDatasetFilters } from '@/features/datasets/constants/datasetMetadata'

// Use composable for datasets (fetch/map/pagination/sort)
const initialFilters = createDefaultDatasetFilters()

const fetcher = async (f: Record<string, any>, p: number, s: number) => {
  return await listFiles(f, p, s, true)  // isPublic = true，不需要登录
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

// shared download progress composable
const { handleDownloadRaw, packingIds } = useDownloadProgress()

// Card actions
const viewOverview = (fileId: string) => {
  router.push({ name: 'DatasetOverview', state: { fileId, source: 'public' } })
}

// (download logic handled by composable above)

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
  <div class="min-h-screen bg-base-200">
    <div class="max-w-[1680px] mx-auto p-4 md:p-8">
      <h1 class="text-4xl font-bold text-base-content mb-6">Public Datasets</h1>

      <DatasetFilterBar
        :show-add-filter="true"
        search-placeholder="Search Datasets"
        @search="handleSearch"
        @filter-status="handleStatusFilter"
        @apply-filters="handleApplyFilters"
        @sort="handleSort"
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
          @download="handleDownloadRaw"
          @change-size="changeSize"
          @go-to-page="goToPage"
        >
          <template #empty> No public datasets found matching your filters. </template>
        </DatasetList>
      </div>

      <!-- Active downloads overlay is rendered inside DatasetList; removed duplicate here -->
    </div>
  </div>
</template>
