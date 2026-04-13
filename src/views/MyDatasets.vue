<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DatasetList from '@/components/dataset/DatasetList.vue';
import DatasetFilterBar from '@/components/dataset/DatasetFilterBar.vue';
import UploadModal from '@/components/UploadModal.vue';
import { listFiles, deleteFile } from '@/utils/file-api';
import { useDownloadProgress } from '@/composables/useDownloadProgress';
import { useDatasets } from '@/composables/useDatasets';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

// Use composable for datasets (fetch/map/pagination/sort)
const initialFilters = {
  filename: '',
  experiment_type: '',
  username: '',
  organism: '',
  organism_part: '',
  condition: '',
  sample_stabilization: '',
  tissue_modification: '',
  maldi_matrix: '',
  maldi_matrix_application: '',
  solvent: '',
  status: [] as string[]
}

const fetcher = async (f: Record<string, any>, p: number, s: number) => {
  // ensure username is set for MyDatasets
  const username = auth.user?.username || ''
  const body = { ...f, username }
  return await listFiles(body, p, s)
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
  pagination
} = useDatasets(fetcher, { defaultFilters: initialFilters, initialSort: 'submission_time', initialDesc: true })

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

onMounted(() => {
  const qp = Number(route.query.page || 1);
  const qs = Number(route.query.size || size.value);
  page.value = qp > 0 ? qp : 1;
  size.value = qs > 0 ? qs : size.value;
  // Try to fetch user first if not present
  if (!auth.user && auth.token) {
    auth.fetchUser().finally(() => fetchFiles({ page: page.value, size: size.value }));
  } else {
    fetchFiles({ page: page.value, size: size.value });
  }
});

// Handlers
const handleSearch = (query: string) => {
  applyFilters({ filename: query || '' });
  page.value = 1;
  router.replace({ query: { ...route.query, page: String(page.value) } });
  fetchFiles({ page: page.value, size: size.value });
};

const handleApplyFilters = (payload: Record<string, any>) => {
  applyFilters(payload);
  page.value = 1;
  router.replace({ query: { ...route.query, page: String(page.value) } });
  fetchFiles({ page: page.value, size: size.value });
};

const handleStatusFilter = (statuses: string[]) => {
  applyFilters({ status: statuses });
  page.value = 1;
  router.replace({ query: { ...route.query, page: String(page.value) } });
  fetchFiles({ page: page.value, size: size.value });
};

// `handleSort` is provided by the composable and used directly in the template.

// UI handlers used by the filter bar and cards
const handleVisibilityFilter = (tab: string) => { /* placeholder: could toggle between My/Public */ };
const isUploadOpen = ref(false);
const onUploadSuccess = () => {
  isUploadOpen.value = false;
  // refresh list after upload
  fetchFiles({ page: page.value, size: size.value });
};
const handleUpload = () => { isUploadOpen.value = true; };

// Download progress handler (shared via composable)
const { downloadingMap, handleDownload } = useDownloadProgress(datasets);

const deletingId = ref<string | null>(null);
const { showToast } = useToast();

const isDeleteModalOpen = ref(false);
const datasetToDelete = ref<string | null>(null);

const handleDelete = async (id?: string) => { 
  if (!id) return;
  datasetToDelete.value = id;
  isDeleteModalOpen.value = true;
};

const confirmDelete = async () => {
  if (!datasetToDelete.value) return;
  
  const id = datasetToDelete.value;
  isDeleteModalOpen.value = false;
  deletingId.value = id;
  
  try {
    await deleteFile(id);
    showToast('Dataset deleted successfully', 'success');
    // Refresh current page after deletion
    fetchFiles({ page: page.value, size: size.value });
  } catch (err: any) {
    showToast(err.message || 'Failed to delete dataset', 'error');
    console.error('Delete failed:', err);
  } finally {
    deletingId.value = null;
    datasetToDelete.value = null;
  }
};

const cancelDelete = () => {
  isDeleteModalOpen.value = false;
  datasetToDelete.value = null;
};

const viewMetadata = (id: string) => console.log('View Metadata', id);
const viewOverview = (id: string) => {
  router.push({ name: 'DatasetOverview', params: { id }, query: { from: 'my' } });
};

const goToPage = (np: number) => {
  if (np < 1) np = 1;
  if (np > (meta.total_pages || 1)) np = meta.total_pages || 1;
  page.value = np;
  meta.current_page = np;
  router.replace({ query: { ...route.query, page: String(np) } });
  dsGoToPage(np);
};

// pagination is provided by the `useDatasets` composable (already destructured above)

const changeSize = (newSize: number) => {
  size.value = newSize;
  page.value = 1;
  router.replace({ query: { ...route.query, page: String(1), size: String(newSize) } });
  dsChangeSize(newSize);
};
</script>

<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-3xl font-bold text-base-content mb-6">My Datasets</h1>
      
      <DatasetFilterBar 
        :show-add-filter="true"
        :show-upload="true"
        search-placeholder="Search my datasets"
        @filter-visibility="handleVisibilityFilter"
        @upload="handleUpload"
        @search="handleSearch"
        @filter-status="handleStatusFilter"
        @apply-filters="handleApplyFilters"
        @sort="handleSort"
      />

      <UploadModal :is-open="isUploadOpen" @close="isUploadOpen = false" @upload-success="onUploadSuccess" />

      <!-- Delete Confirmation Modal -->
      <dialog class="modal" :class="{ 'modal-open': isDeleteModalOpen }">
        <div class="modal-box">
          <h3 class="text-lg font-bold">Delete Dataset</h3>
          <p class="py-4">Are you sure you want to delete this dataset? This action cannot be undone.</p>
          <div class="modal-action">
            <button class="btn" @click="cancelDelete">Cancel</button>
            <button class="btn btn-error" @click="confirmDelete">Delete</button>
          </div>
        </div>
        <div class="modal-backdrop" @click="cancelDelete">
          <button>close</button>
        </div>
      </dialog>

      <div>
        <!-- Loading state -->
        <div v-if="loading" class="flex flex-col gap-3">
          <div class="animate-pulse flex flex-col gap-4">
            <div class="h-40 bg-base-100 dark:bg-slate-800 rounded-xl p-4"></div>
            <div class="h-40 bg-base-100 dark:bg-slate-800 rounded-xl p-4"></div>
          </div>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="p-4 bg-error/10 dark:bg-error/10/30 rounded mb-4 border border-error/20 text-error">
          {{ error }}
        </div>

        <DatasetList
          :datasets="datasets"
          :loading="loading"
          :error="error"
          :meta="meta"
          :size="size"
          :pagination="pagination"
          :downloadingMap="downloadingMap"
          :is-my-dataset="true"
          :deletingId="deletingId"
          @view-metadata="viewMetadata"
          @view-overview="viewOverview"
          @download="handleDownload"
          @delete="handleDelete"
          @change-size="changeSize"
          @go-to-page="goToPage"
        >
          <template #empty> You have no datasets yet matching your filters. </template>
        </DatasetList>
      </div>

      <!-- Active Downloads Overlay Widgets -->
      <div v-if="Object.keys(downloadingMap).length > 0" class="fixed bottom-6 right-20 z-50 flex flex-col gap-3 pointer-events-none">
        <div 
          v-for="(progress, id) in downloadingMap" 
          :key="id"
          class="card bg-base-100 shadow-2xl border border-base-200 p-4 w-72 pointer-events-auto rounded-xl animate-fade-in-up"
        >
          <div class="flex items-center justify-between mb-3 text-sm">
            <span class="font-bold truncate pr-3 text-base-content" :title="datasets.find(d => d.id === id)?.name || String(id)">
              Downloading: {{ datasets.find(d => d.id === id)?.name || 'Dataset' }}
            </span>
            <span class="font-black text-black whitespace-nowrap">{{ progress }}%</span>
          </div>
          <progress class="progress progress-primary w-full h-2" :value="progress" max="100"></progress>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Layout handled by Tailwind classes */
</style>
