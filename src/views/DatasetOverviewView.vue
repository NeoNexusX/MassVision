<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { listFiles, downloadFile } from '@/utils/file-api';
import { useToast } from '@/utils/toast';
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
const { showToast } = useToast();

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

const downloadProgress = ref<number | undefined>(undefined);

const placeholderSvg = computed(() => {
  const isMyDataset = route.query.from !== 'public';
  return getDatasetPlaceholderSvg({
    lineColor: isMyDataset ? '#7C3AED' : '#3F51B5',
    primaryColor: isMyDataset ? '#7C3AED' : '#3F51B5',
    secondaryColor: isMyDataset ? '#F0ABFC' : '#90CAF9',
    tertiaryColor: isMyDataset ? '#DDD6FE' : '#C5CAE9',
    showGuides: true
  });
});

const handleDownload = async () => {
  const targetId = route.params.id as string;
  if (!targetId) return;
  if (downloadProgress.value !== undefined) return; // Prevent concurrent requests
  
  try {
    downloadProgress.value = 0; // Initialize loading state
    showToast('Download started, please wait...', 'info');
    
    const response = await downloadFile(targetId, (progressEvent) => {
      // Calculate and update progress percentage
      if (progressEvent.total) {
        downloadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      }
    });
    
    // Default fallback
    let filename = `${targetId}.zip`;
    
    // 前端因为跨域限制暂时拿不到后端返回的 Content-Disposition 文件名
    // 先使用前端数据兜底获取文件名
    if (dataset.value?.filename) {
      filename = dataset.value.filename.toLowerCase().endsWith('.zip') ? dataset.value.filename : `${dataset.value.filename}.zip`;
    }

    // Parse filename from content-disposition header if available (预留给未来后端放开跨域 header 时使用)
    const cd = response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'];
    if (cd) {
      // 1. Try standard filename="name.zip" or filename=name.zip
      const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '').trim();
      }
      // 2. Try RFC5987 utf-8 encoded format: filename*=UTF-8''name.zip
      const utf8Match = cd.match(/filename\*=utf-8''([^;\n]*)/i);
      if (utf8Match && utf8Match[1]) {
        filename = decodeURIComponent(utf8Match[1]);
      }
    }

    // Create blob and trigger download via a temporary link
    const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    showToast('Download completed successfully!', 'success');
  } catch (error) {
    showToast('Failed to download file', 'error');
    console.error('Download error:', error);
  } finally {
    // Clear downloading state
    downloadProgress.value = undefined;
  }
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
      found = items.find((item: any) => String(item.file_id || item.id || item.filename) === id);
    }
    
    // Fallback if not found in first 100
    if (!found) {
      const resName = await listFiles({ filename: id }, 1, 50);
      const nameItems = resName.data?.data;
      if (Array.isArray(nameItems)) {
        found = nameItems.find((item: any) => String(item.file_id || item.id || item.filename) === id);
        // If still not an exact match by ID, maybe the ID was actually the filename
        if (!found && nameItems.length > 0) {
           found = nameItems.find((item: any) => item.filename === id) || nameItems[0];
        }
      }
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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 mr-1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
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
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
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
                <button @click="handleDownload" class="btn btn-sm btn-primary" :disabled="downloadProgress !== undefined">
                  <span v-if="downloadProgress !== undefined" class="loading loading-spinner loading-xs"></span>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
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
                    <svg v-if="!isCopied" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 text-success">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
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
  </div>
</template>

<style scoped>
/* Hidden inputs logic & drawer animations handled automatically by daisyUI */
</style>