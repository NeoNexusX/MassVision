<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import BaseSelect from '../BaseSelect.vue';
import {
  EXPERIMENT_TYPES,
  ORGANISMS,
  ORGANISM_PARTS,
  CONDITIONS,
  SAMPLE_STABILIZATIONS,
  TISSUE_MODIFICATIONS,
  MALDI_MATRICES,
  MALDI_MATRIX_APPLICATIONS,
  SOLVENTS
} from '@/constants/dataset-metadata';

interface SortOption {
  label: string;
  value: string;
}

const props = withDefaults(defineProps<{
  showUpload?: boolean;
  showVisibilityFilter?: boolean;
  showAddFilter?: boolean;
  searchPlaceholder?: string;
}>(), {
  showUpload: false,
  showVisibilityFilter: false,
  showAddFilter: false,
  searchPlaceholder: 'Search by name/sample/institution'
});

const emit = defineEmits<{
  (e: 'search', query: string): void;
  (e: 'filter-status', status: string[]): void;
  (e: 'filter-visibility', visibility: string): void;
  (e: 'apply-filters', payload: Record<string, any>): void;
  (e: 'sort', value: string): void;
  (e: 'upload'): void;
}>();

const searchQuery = ref('');
const selectedStatuses = ref<string[]>([]);
const selectedVisibility = ref('My Submissions');
const sortValue = ref('submission_time');

const statusOptions = ['Processing', 'Queued', 'Finished'];
const visibilityOptions = ['My Submissions', 'Shared with Me', 'Publicly Shared'];
const sortOptions: SortOption[] = [
  { label: 'Sort by submission time', value: 'submission_time' },
  { label: 'Sort by file size', value: 'size_bytes' }
];

// Add filter panel state and fields matching backend request
const showFilterPanel = ref(false);
const filterBtn = ref<HTMLElement | null>(null);
const filterPanelRef = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});
const filters = ref<Record<string, any>>({
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
  solvent: ''
});

const applyFilters = () => {
  emit('apply-filters', { ...filters.value });
  showFilterPanel.value = false;
};

const resetFilters = () => {
  Object.keys(filters.value).forEach(k => (filters.value[k] = ''));
  emit('apply-filters', { ...filters.value });
  showFilterPanel.value = false;
};

const computePanelPosition = () => {
  const btn = filterBtn.value;
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const panelWidth = Math.min(650, window.innerWidth - 32); 
  const left = Math.min(Math.max(16, rect.left), window.innerWidth - panelWidth - 16);
  const top = rect.bottom + window.scrollY + 8;
  panelStyle.value = {
    position: 'absolute',
    top: `${top}px`,
    left: `${left + window.scrollX}px`,
    width: `${panelWidth}px`,
    zIndex: '9999'
  };
};

const toggleFilterPanel = () => {
  showFilterPanel.value = !showFilterPanel.value;
  if (showFilterPanel.value) {
    // compute position after next tick to ensure DOM ready
    setTimeout(() => computePanelPosition(), 0);
  }
};

const handleClickOutside = (e: MouseEvent) => {
  if (showFilterPanel.value) {
    const isClickOnBtn = filterBtn.value?.contains(e.target as Node);
    const isClickOnPanel = filterPanelRef.value?.contains(e.target as Node);
    if (!isClickOnBtn && !isClickOnPanel) {
      showFilterPanel.value = false;
    }
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Watchers to emit changes; search now triggers on button click
const onSearchClick = () => emit('search', searchQuery.value);

watch(selectedStatuses, (val) => emit('filter-status', val));
watch(selectedVisibility, (val) => emit('filter-visibility', val));
watch(sortValue, (val) => emit('sort', val));

</script>

<template>
  <div class="flex flex-col gap-4 bg-base-100 dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-base-300 mb-6">
    <!-- Top Row: Main Filters & Actions -->
    <div class="flex flex-col md:flex-row gap-4 justify-between items-center">
      
      <!-- Left: Visibility or Add Filter -->
      <div class="flex items-center gap-2 w-full md:w-auto min-w-0">
        <!-- Visibility Filter (My Datasets) -->
        <div v-if="showVisibilityFilter" class="relative group">
           <select 
            v-model="selectedVisibility"
            class="appearance-none bg-base-200 border border-base-300 text-base-content py-2 pl-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer text-sm font-medium"
          >
            <option v-for="opt in visibilityOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-base-content/60">
            <SvgIcon type="chevron_down" class="fill-current h-4 w-4" />
          </div>
        </div>

        <!-- Add Filter (Public Datasets) -- moved after search -->

        <!-- Search Box -->
        <div class="relative flex-1 md:w-64 flex items-center gap-2 min-w-0">
           <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
             <SvgIcon type="search" class="h-4 w-4 text-slate-400" />
           </div>
           <input 
             v-model="searchQuery"
             @keydown.enter.prevent="() => {}"
             type="text" 
             class="flex-1 min-w-0 bg-base-200 border border-base-300 text-base-content text-sm rounded-lg focus:ring-primary focus:border-primary block pl-10 p-2 placeholder:text-base-content/40" 
             :placeholder="searchPlaceholder"
           />
           <button @click="onSearchClick" class="btn btn-sm btn-primary ml-2 whitespace-nowrap">Search</button>
        </div>

        <!-- Add Filter (Public Datasets) - now to the right of search -->
        <div v-if="showAddFilter" class="relative group">
          <button ref="filterBtn" @click="toggleFilterPanel" class="flex items-center gap-2 bg-base-100 dark:bg-slate-800 border border-base-300 text-base-content py-2 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
             <SvgIcon type="plus" class="w-4 h-4" />
             Add filter
           </button>
          <teleport to="body">
            <div v-if="showFilterPanel" ref="filterPanelRef" :style="panelStyle" class="bg-base-100 dark:bg-slate-800 border border-base-300 rounded-lg p-5 shadow-2xl">
             <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div class="text-xs text-base-content/60 flex flex-col">Filename
                 <input v-model="filters.filename" class="w-full mt-1 p-2 rounded border border-base-300 bg-base-200 text-sm" placeholder="Filename" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Experiment Type      
                 <BaseSelect v-model="filters.experiment_type" :options="EXPERIMENT_TYPES" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Username
                 <input v-model="filters.username" class="w-full mt-1 p-2 rounded border border-base-300 bg-base-200 text-sm" placeholder="Submitter username" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Organism
                 <BaseSelect v-model="filters.organism" :options="ORGANISMS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Organism Part
                 <BaseSelect v-model="filters.organism_part" :options="ORGANISM_PARTS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Condition
                 <BaseSelect v-model="filters.condition" :options="CONDITIONS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Sample Stabilization
                 <BaseSelect v-model="filters.sample_stabilization" :options="SAMPLE_STABILIZATIONS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Tissue Modification
                 <BaseSelect v-model="filters.tissue_modification" :options="TISSUE_MODIFICATIONS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">MALDI Matrix
                 <BaseSelect v-model="filters.maldi_matrix" :options="MALDI_MATRICES" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Matrix Application
                 <BaseSelect v-model="filters.maldi_matrix_application" :options="MALDI_MATRIX_APPLICATIONS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Solvent
                 <BaseSelect v-model="filters.solvent" :options="SOLVENTS" placeholder="Any" placement="dropdown-top dropdown-end" class="mt-1" />
               </div>
             </div>
             <div class="mt-3 flex justify-end gap-2">
               <button @click="resetFilters" class="btn btn-sm btn-outline border border-base-300 text-base-content/70 hover:bg-base-200">Reset</button>
               <button @click="applyFilters" class="btn btn-sm btn-primary text-primary-content">Apply</button>
             </div>
           </div>
          </teleport>
        </div>
      </div>

      <!-- Right: Sort, Export, Upload -->
      <div class="flex flex-row flex-nowrap items-center justify-start gap-2 w-full md:w-auto overflow-hidden">
         <!-- Upload Button -->
         <button 
           v-if="showUpload"
           @click="$emit('upload')"
           class="flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 border-none rounded-lg shadow-sm transition-all transform active:scale-95 text-sm font-medium py-2 px-4 min-w-0 overflow-hidden"
         >
            <SvgIcon type="upload" class="w-4 h-4 shrink-0" />
           <span class="truncate">Upload New Dataset</span>
         </button>

         <!-- Sort Dropdown -->
         <div class="relative w-full sm:w-auto">
            <select 
             v-model="sortValue"
             class="appearance-none w-full bg-base-100 dark:bg-slate-800 border border-base-300 text-base-content py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer text-sm truncate"
            >
              <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-base-content/60">
              <SvgIcon type="chevron_down" class="fill-current h-4 w-4" />
            </div>
         </div>

         <!-- Export Button removed as requested -->
      </div>
    </div>

    <!-- Bottom Row: Status Filter -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm border-t border-base-300 pt-3 mt-1">
      <span class="text-base-content font-medium whitespace-nowrap">Status:</span>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label v-for="status in statusOptions" :key="status" class="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
          <input 
            type="checkbox" 
            :value="status" 
            v-model="selectedStatuses"
            class="rounded text-primary focus:ring-primary border-base-300 dark:border-gray-600 dark:bg-gray-700"
          >
          <span class="text-base-content">{{ status }}</span>
        </label>
      </div>
    </div>
  </div>
</template>