<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DatasetCard from '@/components/dataset/DatasetCard.vue';
import DatasetFilterBar from '@/components/dataset/DatasetFilterBar.vue';
import type { Dataset } from '@/types/dataset';
import { listFiles } from '@/utils/file-api';

// State
const datasets = ref<Dataset[]>([]);
const loading = ref(false);
const error = ref('');

// Pagination & meta
const meta = reactive({ current_page: 1, current_records: 0, total_pages: 1, total_records: 0 });
const page = ref<number>(1);
const size = ref<number>(10);
// removed numeric jump input in favour of paged buttons

// Filters match backend request body (defaults empty)
const filters = reactive({
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
  // include status field to support status filtering if backend accepts it
  status: [] as string[]
});

// Sorting: control client-side sort by uploaded_at
const sortDesc = ref(true); // default: desc by uploaded_at

const route = useRoute();
const router = useRouter();

// Helpers
const stripFileSuffix = (name = '') => name.replace(/\.[^.]+$/, '');

const mapItemToDataset = (item: any): Dataset => {
  return {
    id: item.file_id ? String(item.file_id) : String(item.filename || Math.random()),
    name: stripFileSuffix(item.filename || ''),
    sampleDesc: [
      item.organism_part && item.organism ? `${item.organism_part} (${item.organism})` : (item.organism_part || item.organism)
    ].filter(Boolean).join(', '),
    instrument: item.experiment_type || '',
    submitTime: item.uploaded_at || item.created_at || new Date().toISOString(),
    submitter: item.username || item.uploaded_by || '',
    institution: item.institution || '',
    status: (item.status as any) || (item.state as any) || 'Finished',
    isPublic: true,
    thumbnailUrl: item.thumbnail || '',
    description: item.description || '',
    // map possible size fields from backend
    sizeBytes: item.size || item.file_size || item.size_bytes || item.sizeInBytes || 0
  } as any;
};

const applyClientSort = (arr: Dataset[]) => {
  return arr.sort((a, b) => {
    const ta = new Date(a.submitTime).getTime();
    const tb = new Date(b.submitTime).getTime();
    return sortDesc.value ? tb - ta : ta - tb;
  });
};

// Fetch function
const fetchFiles = async (opts: { page?: number; size?: number } = {}) => {
  loading.value = true;
  error.value = '';
  const p = opts.page ?? page.value;
  const s = opts.size ?? size.value;
  try {
    // Build request body from filters (exclude status if empty)
    const body: Record<string, any> = {
      filename: filters.filename || '',
      experiment_type: filters.experiment_type || '',
      username: filters.username || '',
      organism: filters.organism || '',
      organism_part: filters.organism_part || '',
      condition: filters.condition || '',
      sample_stabilization: filters.sample_stabilization || '',
      tissue_modification: filters.tissue_modification || '',
      maldi_matrix: filters.maldi_matrix || '',
      maldi_matrix_application: filters.maldi_matrix_application || '',
      solvent: filters.solvent || ''
    };
    // include status if present
    if (filters.status && (filters.status as any).length) body.status = filters.status;

    const resp = await listFiles(body, p, s);
    const data = resp.data || {};
    // map meta
    if (data.meta) {
      meta.current_page = data.meta.current_page || p;
      meta.current_records = data.meta.current_records || (Array.isArray(data.data) ? data.data.length : 0);
      meta.total_pages = data.meta.total_pages || 1;
      meta.total_records = data.meta.total_records || meta.current_records;
    }

    const items = Array.isArray(data.data) ? data.data.map(mapItemToDataset) : [];
    datasets.value = applyClientSort(items);
  } catch (err: any) {
    error.value = err?.message || String(err) || 'Failed to load files';
    datasets.value = [];
  } finally {
    loading.value = false;
  }
};

// React to route page query param
onMounted(() => {
  const qp = Number(route.query.page || 1);
  const qs = Number(route.query.size || size.value);
  page.value = qp > 0 ? qp : 1;
  size.value = qs > 0 ? qs : size.value;
  fetchFiles({ page: page.value, size: size.value });
});

// Handlers
const handleSearch = (query: string) => {
  filters.filename = query || '';
  page.value = 1;
  router.replace({ query: { ...route.query, page: String(page.value) } });
  fetchFiles({ page: page.value, size: size.value });
};

const handleStatusFilter = (statuses: string[]) => {
  filters.status = statuses as any;
  page.value = 1;
  router.replace({ query: { ...route.query, page: String(page.value) } });
  fetchFiles({ page: page.value, size: size.value });
};

const handleApplyFilters = (payload: Record<string, any>) => {
  Object.assign(filters, payload);
  page.value = 1;
  router.replace({ query: { ...route.query, page: String(page.value) } });
  fetchFiles({ page: page.value, size: size.value });
};

const handleSort = (sortValue: string) => {
  // only uploaded_at sort supported per requirements; toggle asc/desc
  sortDesc.value = !sortDesc.value;
  datasets.value = applyClientSort(datasets.value);
};

const handleExport = () => {
  // keep existing UI behaviour (placeholder). Could implement CSV export later.
  console.log('Export CSV');
};

// Card actions
const viewMetadata = (id: string) => console.log('View Metadata', id);
const viewOverview = (id: string) => console.log('View Overview', id);

// Pagination helpers
const goToPage = (np: number) => {
  if (np < 1) np = 1;
  if (np > (meta.total_pages || 1)) np = meta.total_pages || 1;
  page.value = np;
  // reflect immediately in meta for snappier UI
  meta.current_page = np;
  router.replace({ query: { ...route.query, page: String(np) } });
  fetchFiles({ page: np, size: size.value });
};

// Build pagination items with ellipsis when needed
const pagination = computed<(number | string)[]>(() => {
  const total = Number(meta.total_pages || 1);
  const current = Number(meta.current_page || 1);
  const pages: (number | string)[] = [];
  const maxButtons = 7; // total buttons including first/last and ellipses

  if (total <= maxButtons) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }

  // always show first
  pages.push(1);

  let left = Math.max(current - 1, 2);
  let right = Math.min(current + 1, total - 1);

  // expand window when near edges
  if (current <= 3) {
    left = 2;
    right = 4;
  }
  if (current >= total - 2) {
    left = total - 3;
    right = total - 1;
  }

  if (left > 2) pages.push('...');

  for (let i = left; i <= right; i++) pages.push(i);

  if (right < total - 1) pages.push('...');

  // always show last
  pages.push(total);

  return pages;
});

const changeSize = (newSize: number) => {
  size.value = newSize;
  page.value = 1;
  router.replace({ query: { ...route.query, page: String(1), size: String(newSize) } });
  fetchFiles({ page: 1, size: newSize });
};

</script>

<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-3xl font-bold text-base-content mb-6">Public Datasets</h1>
      
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

        <!-- Error state -->
        <div v-else-if="error" class="p-4 bg-error/10 dark:bg-error/10/30 rounded mb-4 border border-error/20 text-error">
          {{ error }}
        </div>

        <!-- Empty state -->
        <div v-else-if="!datasets.length" class="p-6 bg-base-100 dark:bg-slate-800 rounded-xl text-base-content mb-4">
          No public datasets found matching your filters.
        </div>

        <!-- Data grid -->
        <div v-else class="flex flex-wrap gap-6 justify-start">
          <div 
            v-for="dataset in datasets" 
            :key="dataset.id"
            class="w-full md:w-[calc(50%-12px)] flex-shrink-0"
          >
            <DatasetCard 
              :dataset="dataset"
              @view-metadata="viewMetadata"
              @view-overview="viewOverview"
            />
          </div>

          <!-- No placeholder cards: only render actual datasets -->
        </div>

        <!-- Pagination (daisyUI join-style) -->
        <div class="mt-6 flex items-center justify-between">
          <div class="text-sm text-base-content">
            Page <span class="font-medium">{{ meta.current_page }}</span> of <span class="font-medium">{{ meta.total_pages }}</span> — <span class="font-medium">{{ meta.total_records }}</span> records
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-2">
              <label class="whitespace-nowrap text-sm text-base-content/60">Per page</label>
              <select v-model.number="size" @change="() => changeSize(size)" class="select select-sm select-bordered">
                <option :value="10">10</option>
                <option :value="20">20</option>
              </select>
            </div>

            <nav aria-label="Pagination" class="">
              <ul class="join">
                <!-- Prev -->
                <li class="join-item">
                  <button
                    :disabled="meta.current_page <= 1"
                    @click="() => goToPage(meta.current_page - 1)"
                    class="btn btn-sm"
                  >Prev</button>
                </li>

                <!-- Page buttons -->
                <li v-for="(p, idx) in pagination" :key="`pg-${idx}-${p}`" class="join-item">
                  <button
                    v-if="p !== '...'"
                    @click="() => goToPage(Number(p))"
                    :aria-current="p === meta.current_page ? 'page' : undefined"
                    :class="['btn btn-sm', p === meta.current_page ? 'btn-primary' : 'btn-ghost']"
                  >{{ p }}</button>

                  <button v-else class="btn btn-sm btn-ghost cursor-default" disabled>...</button>
                </li>

                <!-- Next -->
                <li class="join-item">
                  <button
                    :disabled="meta.current_page >= meta.total_pages"
                    @click="() => goToPage(meta.current_page + 1)"
                    class="btn btn-sm"
                  >Next</button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


