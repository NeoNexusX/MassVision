<script setup lang="ts">
import { ref, watch } from 'vue';

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
  (e: 'sort', value: string): void;
  (e: 'export'): void;
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

// Watchers to emit changes
watch(searchQuery, (val) => emit('search', val));
watch(selectedStatuses, (val) => emit('filter-status', val));
watch(selectedVisibility, (val) => emit('filter-visibility', val));
watch(sortValue, (val) => emit('sort', val));

</script>

<template>
  <div class="flex flex-col gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
    <!-- Top Row: Main Filters & Actions -->
    <div class="flex flex-col md:flex-row gap-4 justify-between items-center">
      
      <!-- Left: Visibility or Add Filter -->
      <div class="flex items-center gap-2 w-full md:w-auto">
        <!-- Visibility Filter (My Datasets) -->
        <div v-if="showVisibilityFilter" class="relative group">
           <select 
            v-model="selectedVisibility"
            class="appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-2 pl-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-sm font-medium"
          >
            <option v-for="opt in visibilityOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
            <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>

        <!-- Add Filter (Public Datasets) -->
        <div v-if="showAddFilter" class="relative group">
           <button class="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
               <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
             </svg>
             Add filter
           </button>
           <!-- Dropdown content would go here, simplified for now -->
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
             class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block pl-10 p-2 placeholder-slate-400 dark:placeholder-slate-500" 
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
           class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg shadow-sm transition-all transform active:scale-95 text-sm font-medium"
         >
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
           </svg>
           Upload new dataset
         </button>

         <!-- Sort Dropdown -->
         <div class="relative">
            <select 
             v-model="sortValue"
             class="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-sm"
            >
              <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
               <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
            </div>
         </div>

         <!-- Export Button -->
         <button 
           @click="$emit('export')"
           class="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
           title="Export to CSV"
         >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span class="hidden sm:inline">Export CSV</span>
         </button>
      </div>
    </div>

    <!-- Bottom Row: Status Filter -->
    <div class="flex flex-wrap items-center gap-4 text-sm border-t border-slate-100 dark:border-slate-700 pt-3 mt-1">
      <span class="text-slate-500 dark:text-slate-400 font-medium">Status:</span>
      <label v-for="status in statusOptions" :key="status" class="flex items-center gap-2 cursor-pointer select-none">
        <input 
          type="checkbox" 
          :value="status" 
          v-model="selectedStatuses"
          class="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
        >
        <span class="text-slate-700 dark:text-slate-300">{{ status }}</span>
      </label>
    </div>
  </div>
</template>
