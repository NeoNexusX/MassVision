<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { listFiles } from '@/utils/file-api';
import { useDownloadProgress } from '@/composables/useDownloadProgress';
import { getDatasetPlaceholderSvg } from '@/utils/dataset-placeholder';

// Data strictly according to the structure provided
interface DatasetDetails {
  filename: string;
  file_type: string;
  experiment_type: string;
  size: number;
  storage_type: string;
  hash_sha256: string;
  organism: string;
  organism_part: string;
  condition: string;
  sample_growth_conditions: string;
  sample_stabilization: string;
  tissue_modification: string;
  maldi_matrix: string;
  maldi_matrix_application: string;
  solvent: string;
  status?: string; // Additional field for UI badge representation
  thumbnailUrl?: string;
}

const route = useRoute();
const router = useRouter();

const dataset = ref<DatasetDetails | null>(null);
const loading = ref(true);
const isCopied = ref(false);

// reuse shared download progress composable (overview uses explicit fallback filename)
const { downloadingMap, handleDownload } = useDownloadProgress();

const downloadProgress = computed(() => downloadingMap.value[String(route.params.id)]);

// Format bytes to MB/GB
const formatSize = (bytes?: number) => {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const copyHash = async (hash: string) => {
  if (!hash) return;
  try {
    await navigator.clipboard.writeText(hash);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
};

const goBack = () => {
  const from = route.query.from;
  if (from === 'public') {
    router.push({ name: 'PublicDatasets' });
  } else {
    router.push({ name: 'MyDatasets' });
  }
};

const placeholderSvg = computed(() => {
  const targetId = (route.params.id as string) || (dataset.value?.filename as string);
  return getDatasetPlaceholderSvg({
    id: targetId,
    showGuides: true
  });
});

const downloadCurrent = async () => {
  const targetId = route.params.id as string;
  if (!targetId) return;
  await handleDownload(targetId, {
    getFallbackFilename: () => {
      if (dataset.value?.filename) {
        return dataset.value.filename.toLowerCase().endsWith('.zip') ? dataset.value.filename : `${dataset.value.filename}.zip`;
      }
      return undefined;
    }
  });
};

const formatString = (val?: string) => {
  if (!val) return '—';
  // Capitalize first letter of the whole string, leave the rest alone
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
};

// API call to fetch Dataset Details from list_files
const fetchDatasetDetails = async () => {
  loading.value = true;
  try {
    const id = route.params.id as string;
    
    // As per user direction, querying POST /files/list_files
    // In theory, we can fetch items and find the exact file_id matching the route params.
    let found = null;
    
    // We fetch a larger batch and precisely match the ID locally
    // to prevent partial matches like "1.zip" when ID is "1".
    const res = await listFiles({}, 1, 100);
    const items = res.data?.data;
    
    if (Array.isArray(items)) {
      // Only match by backend-provided file_id. Do not fallback to id/filename.
      found = items.find((item: any) => String(item.file_id) === id);
    }

    if (found) {
      dataset.value = {
        filename: found.filename || '',
        file_type: found.file_type || (found.filename ? found.filename.split('.').pop() : ''),
        experiment_type: found.experiment_type || '',
        size: found.size ?? found.file_size ?? found.size_bytes ?? 0,
        storage_type: found.storage_type || 'Local',
        hash_sha256: found.hash_sha256 || found.hash || '',
        organism: found.organism || '',
        organism_part: found.organism_part || '',
        condition: found.condition || '',
        sample_growth_conditions: found.sample_growth_conditions || '',
        sample_stabilization: found.sample_stabilization || '',
        tissue_modification: found.tissue_modification || '',
        maldi_matrix: found.maldi_matrix || '',
        maldi_matrix_application: found.maldi_matrix_application || '',
        solvent: found.solvent || '',
        status: found.status || found.state || 'Finished',
        thumbnailUrl: found.thumbnail_url || found.thumbnailUrl || ''
      };
    } else {
      dataset.value = null;
    }
  } catch (error) {
    console.error('Error fetching dataset details', error);
    dataset.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchDatasetDetails();
});
</script>

<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8 font-sans">
    <div class="max-w-4xl mx-auto flex flex-col gap-6">
      
      <!-- 1. Top Navigation Area -->
      <div class="flex flex-col sm:flex-row sm:items-start gap-4 mb-2">
        <button @click="goBack" class="btn btn-sm btn-ghost text-base-content/70 hover:bg-base-300 rounded-lg shrink-0 mt-1">
          <svg-icon type="back" class="w-4 h-4 mr-1" />
          Back to {{ route.query.from === 'public' ? 'Public Datasets' : 'My Datasets' }}
        </button>
        <div class="ml-1 sm:ml-4">
          <h1 class="text-3xl font-bold text-base-content tracking-tight">Dataset Overview</h1>
          <p class="text-base-content/60 mt-1">View detailed dataset information</p>
        </div>
      </div>

      <!-- Skeleton Loading State -->
      <template v-if="loading">
        <div class="space-y-6">
          <!-- Primary Card Skeleton -->
          <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6 flex flex-col md:flex-row gap-6">
            <div class="skeleton w-24 h-24 rounded-xl shrink-0"></div>
            <div class="flex-1 space-y-4">
              <div class="skeleton h-8 w-3/4"></div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div class="skeleton h-10 w-full"></div>
                <div class="skeleton h-10 w-full"></div>
                <div class="skeleton h-10 w-full"></div>
                <div class="skeleton h-10 w-full"></div>
              </div>
            </div>
          </div>
          <!-- Metadata Cards Skeleton -->
          <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6 space-y-4" v-for="i in 3" :key="i">
            <div class="skeleton h-6 w-1/4 mb-4"></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div class="skeleton h-10 w-full md:w-32 lg:w-48"></div>
              <div class="skeleton h-10 w-full md:w-32 lg:w-48"></div>
              <div class="skeleton h-10 w-full md:w-32 lg:w-48"></div>
            </div>
          </div>
        </div>
      </template>

      <!-- Empty Data State -->
      <template v-else-if="!dataset">
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200 p-12 text-center">
            <svg-icon type="duplicate" class="h-12 w-12 mx-auto text-base-content/30 mb-4" />
          <h3 class="text-lg font-bold text-base-content">No data available</h3>
          <p class="text-base-content/60 mt-1">The dataset information could not be found or has been deleted.</p>
        </div>
      </template>

      <!-- Content State -->
      <template v-else>
        <!-- 2. Primary Info Card -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6 flex flex-col md:flex-row gap-6">
          <div class="w-20 h-20 md:w-24 md:h-24 bg-base-200/60 rounded-2xl flex items-center justify-center flex-shrink-0 text-base-content/50 border border-base-200 overflow-hidden">
            <img v-if="dataset.thumbnailUrl" :src="dataset.thumbnailUrl" :alt="dataset.filename" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full" v-html="placeholderSvg"></div>
          </div>
          
          <div class="flex-1 w-full min-w-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <h2 class="text-2xl md:text-3xl font-bold text-base-content truncate">{{ dataset.filename }}</h2>
              <div class="flex items-center gap-2 shrink-0">
                <button @click="downloadCurrent" class="btn btn-sm btn-primary" :disabled="downloadProgress !== undefined">
                  <span v-if="downloadProgress !== undefined" class="loading loading-spinner loading-xs"></span>
                    <svg-icon v-else type="download" class="w-4 h-4" />
                  {{ downloadProgress !== undefined ? `Downloading ${downloadProgress}%` : 'Download' }}
                </button>
                <div class="badge badge-soft shrink-0 border-0 font-medium px-3 py-3" :class="dataset.status === 'Finished' ? 'badge-success bg-success/10 text-success' : 'badge-neutral bg-base-200 text-base-content/70'">
                  {{ dataset.status || 'Finished' }}
                </div>
              </div>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6">
              <div class="flex flex-col">
                <span class="text-xs font-semibold tracking-wider text-base-content/40">File Type</span>
                <span class="font-medium mt-1 text-base-content">{{ dataset.file_type || '—' }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold tracking-wider text-base-content/40">Experiment</span>
                <span class="font-medium mt-1 text-base-content">{{ dataset.experiment_type || '—' }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold tracking-wider text-base-content/40">Size</span>
                <span class="font-medium mt-1 text-base-content">{{ formatSize(dataset.size) }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold tracking-wider text-base-content/40">Storage</span>
                <span class="font-medium mt-1 text-base-content">{{ dataset.storage_type || '—' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Biological Metadata -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            Biological Metadata
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">Organism</span>
              <span class="text-base-content break-words">{{ formatString(dataset.organism) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">Organism Part</span>
              <span class="text-base-content break-words">{{ formatString(dataset.organism_part) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">Condition</span>
              <span class="text-base-content break-words">{{ formatString(dataset.condition) }}</span>
            </div>
          </div>
        </div>

        <!-- 4. Sample Processing -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            Sample Processing
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">Growth Conditions</span>
              <span class="text-base-content break-words">{{ formatString(dataset.sample_growth_conditions) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">Stabilization</span>
              <span class="text-base-content break-words">{{ formatString(dataset.sample_stabilization) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">Tissue Modification</span>
              <span class="text-base-content break-words">{{ formatString(dataset.tissue_modification) }}</span>
            </div>
          </div>
        </div>

        <!-- 5. MALDI Related Info -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            MALDI Information
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">Matrix</span>
              <span class="text-base-content break-words">{{ formatString(dataset.maldi_matrix) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">Matrix Application</span>
              <span class="text-base-content break-words">{{ formatString(dataset.maldi_matrix_application) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">Solvent</span>
              <span class="text-base-content break-words">{{ formatString(dataset.solvent) }}</span>
            </div>
          </div>
        </div>

        <!-- 6. Technical Info -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            Technical Details
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col max-w-full">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">SHA-256 Hash</span>
              <div class="flex items-center gap-2 max-w-full">
                <span class="text-base-content bg-base-200/50 px-2 py-1 rounded font-mono text-sm truncate flex-1 md:max-w-md">{{ dataset.hash_sha256 || '—' }}</span>
                  <div class="tooltip tooltip-top" :data-tip="isCopied ? 'Copied!' : 'Copy Hash'" v-if="dataset.hash_sha256">
                  <button @click="copyHash(dataset.hash_sha256)" class="btn btn-sm btn-ghost btn-square rounded-md hover:bg-base-200 shrink-0">
                    <svg-icon v-if="!isCopied" type="duplicate" class="w-4 h-4" />
                    <svg-icon v-else type="check" class="w-4 h-4 text-success" />
                  </button>
                </div>
              </div>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">Storage Type</span>
              <span class="text-base-content break-words">{{ dataset.storage_type || '—' }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">Total Size</span>
              <span class="text-base-content break-words">{{ formatSize(dataset.size) }}</span>
            </div>
          </div>
        </div>

      </template>

    </div>

    <!-- Active Downloads Overlay Widgets -->
    <div v-if="Object.keys(downloadingMap).length > 0" class="fixed bottom-6 right-20 z-50 flex flex-col gap-3 pointer-events-none">
      <div 
        v-for="(progress, id) in downloadingMap" 
        :key="id"
        class="card bg-base-100 shadow-2xl border border-base-200 p-4 w-72 pointer-events-auto rounded-xl animate-fade-in-up"
      >
        <div class="flex items-center justify-between mb-3 text-sm">
          <span class="font-bold truncate pr-3 text-base-content" :title="(String(route.params.id) === String(id) && dataset) ? dataset.filename : String(id)">
            Downloading: {{ (String(route.params.id) === String(id) && dataset) ? dataset.filename : String(id) }}
          </span>
          <span class="font-black text-black whitespace-nowrap">{{ progress }}%</span>
        </div>
        <progress class="progress progress-primary w-full h-2" :value="progress" max="100"></progress>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Hidden inputs logic & drawer animations handled automatically by daisyUI */
</style>