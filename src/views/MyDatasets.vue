<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <div class="max-w-[1680px] mx-auto">
      <h1 class="text-[3em] font-bold text-base-content mb-6 px-3">
        My Datasets
      </h1>

      <div v-if="quota" class="flex flex-col md:flex-row md:flex-wrap items-start md:items-center gap-6 mb-4 text-xl text-base-content/80">
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DatasetList from '@/features/datasets/components/DatasetList.vue'
import DatasetFilterBar from '@/features/datasets/components/DatasetFilterBar.vue'
import UploadModal from '@/features/upload/components/UploadModal.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { listUserFiles, deleteFile } from '@/features/datasets/api/datasetApi'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { useDatasetList } from '@/features/datasets/composables/useDatasetList'
import { useDatasetListRouteState } from '@/features/datasets/composables/useDatasetListRouteState'
import { useExploreDataset } from '@/features/datasets/composables/useExploreDataset'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { useToast } from '@/shared/composables/useToast'
import { useUserQuota } from '@/shared/composables/useUserQuota'
import { createDefaultDatasetFilters } from '@/features/datasets/constants/datasetMetadata'

// Use composable for datasets (fetch/map/pagination/sort)
const initialFilters = createDefaultDatasetFilters()

const fetcher = async (f: Record<string, any>, p: number, s: number) => {
  // ensure username is set for MyDatasets
  const username = auth.user?.username || ''
  const body = { ...f, username }
  return await listUserFiles(body, p, s)
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

// `handleSort` is provided by the composable and used directly in the template.

// UI handlers used by the filter bar and cards
const isUploadOpen = ref(false)
const handleUpload = () => {
  isUploadOpen.value = true
}

// Quota
const { quota, fetchQuota } = useUserQuota()

// Download progress handler (shared via composable)
const { handleDownloadRaw, packingIds } = useDownloadProgress()

// Upload success: refresh list to get backend status
const handleUploadSuccess = (_datasetName: string) => {
  isUploadOpen.value = false
  fetchFiles({ page: page.value, size: size.value })
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

const viewOverview = (fileId: string) => {
  router.push({ name: 'DatasetOverview', state: { fileId, source: 'my' } })
}

// pagination is provided by the `useDatasetList` composable (already destructured above)
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
    onMountedReady: fetchQuota,
  })
</script>

<style scoped>
/* Layout handled by Tailwind classes */
</style>



