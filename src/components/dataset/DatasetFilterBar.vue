<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import DropdownSelect from '../DropdownSelect.vue';
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
  (e: 'add-filter', type: string): void;
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
  { label: 'Sort by annotation count', value: 'annotation_count' }
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

// Watchers to emit changes
watch(searchQuery, (val) => emit('search', val));
watch(selectedStatuses, (val) => emit('filter-status', val));
watch(selectedVisibility, (val) => emit('filter-visibility', val));
watch(sortValue, (val) => emit('sort', val));

</script>

<template>
  <div class="flex flex-col gap-4 bg-base-100 dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-base-300 mb-6">
    <!-- Top Row: Main Filters & Actions -->
    <div class="flex flex-col md:flex-row gap-4 justify-between items-center">
      
      <!-- Left: Visibility or Add Filter -->
      <div class="flex items-center gap-2 w-full md:w-auto">
        <!-- Visibility Filter (My Datasets) -->
        <div v-if="showVisibilityFilter" class="relative group">
           <select 
            v-model="selectedVisibility"
            class="appearance-none bg-base-200 border border-base-300 text-base-content py-2 pl-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer text-sm font-medium"
          >
            <option v-for="opt in visibilityOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-base-content/60">
            <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>

        <!-- Add Filter (Public Datasets) -->
        <div v-if="showAddFilter" class="relative group">
          <button ref="filterBtn" @click="toggleFilterPanel" class="flex items-center gap-2 bg-base-100 dark:bg-slate-800 border border-base-300 text-base-content py-2 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
               <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
             </svg>
             Add filter
           </button>
          <teleport to="body">
            <div v-if="showFilterPanel" ref="filterPanelRef" :style="panelStyle" class="bg-base-100 dark:bg-slate-800 border border-base-300 rounded-lg p-5 shadow-2xl">
             <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div class="text-xs text-base-content/60 flex flex-col">Filename
                 <input v-model="filters.filename" class="w-full mt-1 p-2 rounded border border-base-300 bg-base-200 text-sm" placeholder="Filename" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Experiment Type      
                 <DropdownSelect v-model="filters.experiment_type" :options="EXPERIMENT_TYPES" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Username
                 <input v-model="filters.username" class="w-full mt-1 p-2 rounded border border-base-300 bg-base-200 text-sm" placeholder="Submitter username" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Organism
                 <DropdownSelect v-model="filters.organism" :options="ORGANISMS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Organism Part
                 <DropdownSelect v-model="filters.organism_part" :options="ORGANISM_PARTS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Condition
                 <DropdownSelect v-model="filters.condition" :options="CONDITIONS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Sample Stabilization
                 <DropdownSelect v-model="filters.sample_stabilization" :options="SAMPLE_STABILIZATIONS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Tissue Modification
                 <DropdownSelect v-model="filters.tissue_modification" :options="TISSUE_MODIFICATIONS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">MALDI Matrix
                 <DropdownSelect v-model="filters.maldi_matrix" :options="MALDI_MATRICES" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Matrix Application
                 <DropdownSelect v-model="filters.maldi_matrix_application" :options="MALDI_MATRIX_APPLICATIONS" placeholder="Any" class="mt-1" />
               </div>
               <div class="text-xs text-base-content/60 flex flex-col">Solvent
                 <DropdownSelect v-model="filters.solvent" :options="SOLVENTS" placeholder="Any" placement="dropdown-top dropdown-end" class="mt-1" />
               </div>
             </div>
             <div class="mt-3 flex justify-end gap-2">
               <button @click="resetFilters" class="btn btn-sm btn-ghost border border-base-300">Reset</button>
               <button @click="applyFilters" class="btn btn-sm btn-primary text-primary-content">Apply</button>
             </div>
           </div>
          </teleport>
        </div>

        <!-- Search Box -->
        <div class="relative flex-1 md:w-64">
           <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
               <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
           </div>
           <input 
             v-model="searchQuery"
             type="text" 
             class="w-full bg-base-200 border border-base-300 text-base-content text-sm rounded-lg focus:ring-primary focus:border-primary block pl-10 p-2 placeholder:text-base-content/40" 
             :placeholder="searchPlaceholder"
           >
        </div>
      </div>

      <!-- Right: Sort, Export, Upload -->
      <div class="flex items-center gap-2 w-full md:w-auto justify-end">
         <!-- Upload Button -->
         <button 
           v-if="showUpload"
           @click="$emit('upload')"
           class="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 border-none rounded-lg shadow-sm transition-all transform active:scale-95 text-sm font-medium py-2 px-4"
         >
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
           </svg>
           Upload New Dataset (imzML + ibd)
         </button>

         <!-- Sort Dropdown -->
         <div class="relative">
            <select 
             v-model="sortValue"
             class="appearance-none bg-base-100 dark:bg-slate-800 border border-base-300 text-base-content py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer text-sm"
            >
              <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-base-content/60">
               <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
            </div>
         </div>

         <!-- Export Button removed as requested -->
      </div>
    </div>

    <!-- Bottom Row: Status Filter -->
    <div class="flex flex-wrap items-center gap-4 text-sm border-t border-base-300 pt-3 mt-1">
      <span class="text-base-content font-medium">Status:</span>
      <label v-for="status in statusOptions" :key="status" class="flex items-center gap-2 cursor-pointer select-none">
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
</template>
