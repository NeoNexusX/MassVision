<script setup lang="ts">
import { ref } from 'vue';
import DatasetCard from '@/components/dataset/DatasetCard.vue';
import DatasetFilterBar from '@/components/dataset/DatasetFilterBar.vue';
import type { Dataset } from '@/types/dataset';

// 1. Mock minimal data (3-4 items)
const generateMockDatasets = (count: number): Dataset[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `my-dataset-${i + 1}`,
    name: i === 0 
      ? `High-Res Spatial Lipidomics of Mouse Brain` 
      : i === 1 
      ? `Single-Cell Metabolomics of Kidney Tissue`
      : `Colorectal Cancer Tissue Microarray Analysis`,
    sampleDesc: i === 0 ? 'C57BL/6 mouse brain sections (sagittal)' : 'Human kidney biopsy cores', 
    instrument: i % 2 === 0 ? 'Bruker timsTOF flex' : 'Thermo Orbitrap Exploris 240',
    submitTime: new Date(Date.now() - i * 86400000 * 2).toISOString(),
    submitter: 'Dr. Li',
    institution: 'MassVision Lab',
    status: i === 0 ? 'Finished' : i === 1 ? 'Processing' : 'Queued',
    isPublic: i !== 1,
    thumbnailUrl: '',
    description: 'Investigation of lipid distribution changes in neurodegenerative disease models.',
    species: 'Mus musculus'
  }));
};

const datasets = ref<Dataset[]>(generateMockDatasets(3)); // Only 3 real items
const currentTab = ref('My Submissions');

// Empty handlers
const handleVisibilityFilter = (tab: string) => { currentTab.value = tab; };
const handleUpload = () => { console.log('Upload click'); };
const handleSort = () => {};
const handleExport = () => {};
const handleSearch = () => {};
const handleEdit = () => {};
const handleDelete = () => {};
const viewMetadata = () => {};
const viewOverview = () => {};
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">My Datasets</h1>
      
      <DatasetFilterBar 
        :show-visibility-filter="true"
        :show-upload="true"
        search-placeholder="Search my datasets"
        @filter-visibility="handleVisibilityFilter"
        @upload="handleUpload"
        @search="handleSearch"
        @sort="handleSort"
        @export="handleExport"
      />

      <div class="flex flex-wrap gap-6 justify-start">
        <!-- Real Dataset Cards -->
        <div 
          v-for="dataset in datasets" 
          :key="dataset.id"
          class="w-full md:w-[calc(50%-12px)] flex-shrink-0"
        >
          <DatasetCard 
            :dataset="dataset"
            :is-my-dataset="true"
            @view-metadata="viewMetadata"
            @view-overview="viewOverview"
            @edit="handleEdit"
            @delete="handleDelete"
          />
        </div>

        <!-- Skeleton / Placeholder Cards to fill space visually -->
         <div 
          v-for="n in 3" 
          :key="`placeholder-${n}`"
          class="w-full md:w-[calc(50%-12px)] flex-shrink-0 h-[154px] rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col items-center justify-center gap-3 group cursor-default transition-colors hover:border-slate-300 dark:hover:border-slate-600"
        >
           <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
           </div>
           <span class="text-sm font-medium text-slate-400 dark:text-slate-500">Reserved Slot</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Layout handled by Tailwind classes */
</style>
