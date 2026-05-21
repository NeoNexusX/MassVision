<script setup lang="ts">
import { onMounted} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DatasetList from '@/components/dataset/DatasetList.vue';
import DatasetFilterBar from '@/components/dataset/DatasetFilterBar.vue';
import { listFiles} from '@/utils/file-api';
import { useDownloadProgress } from '@/composables/useDownloadProgress';
import { useDatasets } from '@/composables/useDatasets';
import { useAuthStore } from '@/stores/auth';


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
  return await listFiles(f, p, s);
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

// shared download progress composable
const { handleDownload } = useDownloadProgress();

// React to route page query param
onMounted(() => {
  const qp = Number(route.query.page || 1);
  const qs = Number(route.query.size || size.value);
  page.value = qp > 0 ? qp : 1;
  size.value = qs > 0 ? qs : size.value;
  // If auth not loaded, try to fetch user first (keeps parity with other lists)
  if (!auth.user && auth.token) {
    auth.fetchUser().finally(() => fetchFiles({ page: page.value, size: size.value }));
  } else {
    fetchFiles({ page: page.value, size: size.value });
  }
});

// Handlers wiring to composable
const handleSearch = (query: string) => {
  applyFilters({ filename: query || '' });
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

const handleApplyFilters = (payload: Record<string, any>) => {
  applyFilters(payload);
  page.value = 1;
  router.replace({ query: { ...route.query, page: String(page.value) } });
  fetchFiles({ page: page.value, size: size.value });
};

// Card actions
const viewOverview = (id: string) => {
  router.push({ name: 'DatasetOverview', params: { id }, query: { from: 'public' } });
};

// (download logic handled by composable above)

const goToPage = (np: number) => {
  if (np < 1) np = 1;
  if (np > (meta.total_pages || 1)) np = meta.total_pages || 1;
  page.value = np;
  meta.current_page = np;
  router.replace({ query: { ...route.query, page: String(np) } });
  dsGoToPage(np);
};

const changeSize = (newSize: number) => {
  size.value = newSize;
  page.value = 1;
  router.replace({ query: { ...route.query, page: String(1), size: String(newSize) } });
  dsChangeSize(newSize);
};

</script>

<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <div class="max-w-[1680px] mx-auto">
      <h1 class="text-4xl font-bold text-base-content mb-6">Public Datasets</h1>
      
      <DatasetFilterBar 
        :show-add-filter="true"
        search-placeholder="Search by name/sample/institution"
        @search="handleSearch"
        @filter-status="handleStatusFilter"
        @apply-filters="handleApplyFilters"
        @sort="handleSort"
        
      />
      <div>
        <!-- Loading state -->
        <div v-if="loading" class="flex flex-col gap-3">
          <div class="animate-pulse flex flex-col gap-4">
            <div class="h-40 bg-base-100 dark:bg-slate-800 rounded-xl p-4"></div>
            <div class="h-40 bg-base-100 dark:bg-slate-800 rounded-xl p-4"></div>
          </div>
        </div>

        <DatasetList
          :datasets="datasets"
          :loading="loading"
          :error="error"
          :meta="meta"
          :size="size"
          :pagination="pagination"
          @view-overview="viewOverview"
          @download="handleDownload"
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


