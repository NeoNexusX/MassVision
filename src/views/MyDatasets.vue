<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8 page-type">
    <div class="max-w-[1680px] mx-auto">
      <h1 class="page-title font-bold text-base-content mb-6 px-3">
        My Datasets
      </h1>

      <div v-if="quota" class="flex flex-col md:flex-row md:flex-wrap items-start md:items-center gap-3 md:gap-6 mb-4 text-[1em] text-base-content/80">
        <span class="px-3 whitespace-nowrap"
          >Storage
          <strong class="text-base-content"
            >{{ quota.uploadUsed }} / {{ quota.uploadMax }}</strong
          ></span
        >
        <span class="px-3 whitespace-nowrap"
          >Files
          <strong class="text-base-content"
            >{{ quota.fileCount }} / {{ quota.maxFiles }}</strong
          ></span
        >
        <span class="px-3 whitespace-nowrap"
          >Processing
          <strong class="text-base-content"
            >{{ quota.procUsed }} / {{ quota.procMax }}</strong
          ></span
        >
        <span class="px-3 whitespace-nowrap"
          >Downloads
          <strong class="text-base-content"
            >{{ quota.downloadUsed }} / {{ quota.downloadMax }}</strong
          ></span
        >
        <button
          class="btn btn-ghost text-[1em] md:ml-auto"
          :class="{ loading: checkingFiles }"
          :disabled="checkingFiles"
          @click="refreshFileStatus"
          title="Check file processing status"
        >
          <SvgIcon v-if="!checkingFiles" type="refresh" class="w-[1.2em] h-[1.2em]" />
          Refresh Status
        </button>
      </div>

      <DatasetFilterBar
        :show-add-filter="true"
        :show-upload="true"
        search-placeholder="Search my datasets"
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

      <!-- Delete Confirmation Modal -->
      <ConfirmDialog
        :open="isDeleteModalOpen"
        title="Delete Dataset"
        message="Are you sure you want to delete this dataset? This action cannot be undone."
        confirm-label="Delete"
        :danger="true"
        @confirm="confirmDelete"
        @cancel="cancelDelete"
      />

      <!-- Explore / Raw-Convert Confirmation -->
      <ExploreConfirmDialog
        :open="showExploreConfirm"
        :loading="isConverting"
        @confirm="explore.confirmExplore"
        @cancel="explore.cancelExplore"
      />

      <div>
        <DatasetList
          :datasets="datasets"
          :loading="loading"
          :error="error"
          :meta="meta"
          :size="size"
          :pagination="pagination"
          :is-my-dataset="true"
          :deletingId="deletingId"
          :packingIds="packingIds"
          @view-overview="viewOverview"
          @download="handleDownloadRaw"
          @delete="handleDelete"
          @explore="handleExplore"
          @change-size="changeSize"
          @go-to-page="goToPage"
        >
          <template #empty> You have no datasets yet matching your filters. </template>
        </DatasetList>
      </div>

    </div>
  </div>
</template>


<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import DatasetList from '@/features/datasets/components/DatasetList.vue'
import DatasetFilterBar from '@/features/datasets/components/DatasetFilterBar.vue'
import UploadModal from '@/features/upload/components/UploadModal.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import ExploreConfirmDialog from '@/features/datasets/components/ExploreConfirmDialog.vue'
import { listUserFiles, deleteFile } from '@/features/datasets/api/datasetApi'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { useDatasetListPage } from '@/features/datasets/composables/useDatasetListPage'
import { useExploreDataset } from '@/features/datasets/composables/useExploreDataset'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { useToast } from '@/shared/composables/useToast'
import { useUserQuota } from '@/shared/composables/useUserQuota'
import { createDefaultDatasetFilters } from '@/features/datasets/constants/datasetMetadata'

// Use composable for datasets (fetch/map/pagination/sort)
const initialFilters = createDefaultDatasetFilters()

const auth = useAuthStore()

const fetcher = async (f: Record<string, any>, p: number, s: number) => {
  // ensure username is set for MyDatasets
  const username = auth.user?.username || ''
  const body = { ...f, username }
  return await listUserFiles(body, p, s)
}

// Quota
const { quota, fetchQuota } = useUserQuota()

// 列表装配（取数/筛选/分页/Overview 跳转）；`handleSort` 由模板直接使用
const {
  datasets,
  loading,
  error,
  meta,
  page,
  size,
  pagination,
  fetchFiles,
  handleSort,
  handleSearch,
  handleStatusFilter,
  handleApplyFilters,
  goToPage,
  changeSize,
  refreshCurrentPage,
  viewOverview,
} = useDatasetListPage(fetcher, {
  source: 'my',
  defaultFilters: initialFilters,
  onMountedReady: fetchQuota,
})

const router = useRouter()
const route = useRoute()

// UI handlers used by the filter bar and cards
const isUploadOpen = ref(false)
const handleUpload = () => {
  isUploadOpen.value = true
}

// Auto-open the upload modal when arriving from the New Analysis page (?upload=1)
onMounted(() => {
  if (route.query.upload === '1') {
    isUploadOpen.value = true
    // Strip the query param so a refresh doesn't reopen the modal
    router.replace({ name: 'MyDatasets' })
  }
})

// Download progress handler (shared via composable)
const { handleDownloadRaw, packingIds } = useDownloadProgress()

// Upload success: refresh list to get backend status
const handleUploadSuccess = (_datasetName: string) => {
  isUploadOpen.value = false
  refreshCurrentPage()
  fetchQuota()
}

// Refresh file status: re-fetch current page from backend
const checkingFiles = ref(false)

async function refreshFileStatus() {
  if (checkingFiles.value) return
  checkingFiles.value = true
  await fetchFiles({ page: page.value, size: size.value })
  fetchQuota()
  checkingFiles.value = false
}

const deletingId = ref<string | null>(null)
const { showToast } = useToast()

const isDeleteModalOpen = ref(false)
const datasetToDelete = ref<string | null>(null)

const explore = useExploreDataset()
const { showExploreConfirm, isConverting } = explore

const handleExplore = (id?: string) => {
  if (!id) return
  explore.handleExplore(id, datasets.value)
}

const handleDelete = async (id?: string) => {
  if (!id) return
  datasetToDelete.value = id
  isDeleteModalOpen.value = true
}

const confirmDelete = async () => {
  if (!datasetToDelete.value) return

  const id = datasetToDelete.value
  isDeleteModalOpen.value = false
  deletingId.value = id

  try {
    await deleteFile(id)
    showToast('Dataset deleted successfully', 'success')
    // Refresh current page after deletion
    fetchFiles({ page: page.value, size: size.value })
    fetchQuota()
  } catch (err: any) {
    showToast(err.message || 'Failed to delete dataset', 'error')
    console.error('Delete failed:', err)
  } finally {
    deletingId.value = null
    datasetToDelete.value = null
  }
}

const cancelDelete = () => {
  isDeleteModalOpen.value = false
  datasetToDelete.value = null
}
</script>

<style scoped>
/* Layout handled by Tailwind classes */
</style>



