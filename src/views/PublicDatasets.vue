<script setup lang="ts">
import { ref } from 'vue';
import DatasetCard from '@/components/dataset/DatasetCard.vue';
import DatasetFilterBar from '@/components/dataset/DatasetFilterBar.vue';
import type { Dataset } from '@/types/dataset';

// Mock data generation - Simplified to 4 items
const generateMockDatasets = (): Dataset[] => {
  const titles = [
    'Liver Cancer Metabolomics Study 2024',
    'Plant Stress Response Analysis',
    'Gut Microbiome Profiling',
    'Drug Metabolism in Rat Plasma'
  ];
  
  return titles.map((title, i) => ({
    id: `pub-${i + 1}`,
    name: title,
    sampleDesc: i === 0 ? 'Human liver tissue samples (n=120)' : i === 1 ? 'Arabidopsis thaliana leaves' : 'Fecal samples from healthy donors',
    instrument: i % 2 === 0 ? 'Orbitrap Exploris 480' : 'Bruker timsTOF Pro',
    submitTime: new Date(Date.now() - i * 86400000 * 5).toISOString(),
    submitter: i === 0 ? 'Dr. Smith' : 'Dr. Johnson',
    institution: i === 0 ? 'MassTech Institute' : 'BioChem Labs',
    status: 'Finished',
    isPublic: true,
    thumbnailUrl: '', 
    description: 'Detailed analysis of metabolic profiles.',
    species: i === 0 ? 'Homo sapiens' : i === 1 ? 'Arabidopsis thaliana' : 'Mus musculus'
  }));
};

const datasets = ref<Dataset[]>(generateMockDatasets());

const handleSearch = (query: string) => { console.log('Search:', query); };
const handleStatusFilter = (statuses: string[]) => { console.log('Status Filter:', statuses); };
const handleSort = (sortValue: string) => { console.log('Sort:', sortValue); };
const handleExport = () => { console.log('Export CSV'); };

// Handlers for card actions
const viewMetadata = (id: string) => console.log('View Metadata', id);
const viewOverview = (id: string) => console.log('View Overview', id);

</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Public Datasets</h1>
      
      <DatasetFilterBar 
        :show-add-filter="true"
        search-placeholder="Search by name/sample/institution"
        @search="handleSearch"
        @filter-status="handleStatusFilter"
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
            @view-metadata="viewMetadata"
            @view-overview="viewOverview"
          />
        </div>

        <!-- Placeholder Cards -->
         <div 
          v-for="n in 2" 
          :key="`placeholder-${n}`"
          class="w-full md:w-[calc(50%-12px)] flex-shrink-0 h-[154px] rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col items-center justify-center gap-3 group cursor-default transition-colors hover:border-slate-300 dark:hover:border-slate-600"
        >
           <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
           </div>
           <span class="text-sm font-medium text-slate-400 dark:text-slate-500">Coming Soon</span>
        </div>
      </div>
    </div>
  </div>
</template>


