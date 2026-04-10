<script setup lang="ts">
import { computed } from 'vue';
import type { Dataset } from '@/types/dataset';
import { getDatasetPlaceholderSvg } from '@/utils/dataset-placeholder';

function formatBytes(bytes?: number): string {
  if (bytes == null || isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB','MB','GB','TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

const props = defineProps<{
  dataset: Dataset;
  isMyDataset?: boolean;
  downloadProgress?: number;
}>();

const emit = defineEmits<{
  (e: 'view-metadata', id: string): void;
  (e: 'view-overview', id: string): void;
  (e: 'download', id: string): void;
  (e: 'delete', id: string): void;
}>();

const statusColor = computed(() => {
  switch (props.dataset.status) {
    case 'Processing': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
    case 'Queued': return 'text-base-content/70 bg-base-300 dark:text-base-content/50 dark:bg-gray-800';
    case 'Finished': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
    default: return 'text-base-content/70';
  }
});

const formattedSize = computed(() => formatBytes(props.dataset.sizeBytes));

const placeholderSvg = computed(() => {
  if (props.isMyDataset) {
    return getDatasetPlaceholderSvg({
      lineColor: '#7C3AED',
      primaryColor: '#7C3AED',
      secondaryColor: '#F0ABFC',
      tertiaryColor: '#DDD6FE',
      showGuides: true
    });
  } else {
    return getDatasetPlaceholderSvg({
      lineColor: '#3F51B5',
      primaryColor: '#3F51B5',
      secondaryColor: '#90CAF9',
      tertiaryColor: '#C5CAE9',
      showGuides: true
    });
  }
});
</script>

<template>
  <div class="group flex flex-col md:flex-row items-start md:items-center p-4 gap-4 bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 border border-base-300 cursor-pointer relative" @click="$emit('view-overview', dataset.id)">
    
    <!-- Unclickable background mask to intercept clicks on the entire right side and bottom right edges -->
    <div class="absolute right-0 top-0 bottom-0 md:w-[160px] w-full max-md:h-[120px] max-md:top-auto z-0 cursor-default" @click.stop></div>

    <!-- Left: Image -->
    <div class="relative z-10 flex-none w-full md:w-[120px] h-48 md:h-[120px] rounded-lg overflow-hidden bg-base-200 flex items-center justify-center border border-base-300">
      <img 
        v-if="dataset.thumbnailUrl" 
        :src="dataset.thumbnailUrl" 
        :alt="dataset.name" 
        class="w-full h-full object-cover"
        loading="lazy"
      />
      <div v-else class="w-full h-full text-base-content" v-html="placeholderSvg"></div>
    </div>

    <!-- Middle: Info -->
    <div class="relative z-10 flex-1 w-full md:w-auto flex flex-col gap-1 md:px-2 min-w-0">
      <div class="flex items-center justify-between gap-2 w-full min-w-0 overflow-hidden">
        <!-- Title and Private/Public Icon wrapper -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <h3
            class="font-bold text-lg text-base-content truncate cursor-pointer hover:text-primary dark:hover:text-indigo-400 transition-colors block"
            @click.stop="$emit('view-overview', dataset.id)"
            :title="dataset.name"
            :aria-label="`Dataset name: ${dataset.name}`"
          >
            {{ dataset.name }}
          </h3>
          <!-- Private/Public Icon for MyDatasets -->
          <div v-if="isMyDataset" class="flex-shrink-0" :title="dataset.isPublic ? 'Public' : 'Private'">
             <svg v-if="dataset.isPublic" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-slate-400">
                <path fill-rule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM5.94 13.94A5.994 5.994 0 0110 4.06v2.333a3.666 3.666 0 100 7.333V16.7c-2.32-.445-4.218-2.022-4.06-2.76z M10 16.7v-2.977a3.667 3.667 0 003.553-3.666h2.333A5.994 5.994 0 0110 16.7z" clip-rule="evenodd" /> <!-- Simplified globe -->
                <path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v3H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm-2 4a2 2 0 114 0v3H8V6z" clip-rule="evenodd" />
             </svg>
          </div>
        </div>
        <!-- Fixed Status Badge on the right, prevents overlap by forcing title to truncate -->
        <span class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 whitespace-nowrap" :class="statusColor">
          {{ dataset.status }}
        </span>
      </div>

      <p class="text-sm text-base-content truncate" :title="dataset.sampleDesc">
        <span class="font-medium">organism_part:</span> {{ dataset.sampleDesc }}
      </p>
      
      <p class="text-sm text-base-content truncate" :title="dataset.instrument">
        <span class="font-medium">Experiment Type:</span> {{ dataset.instrument }}
      </p>

      <p class="text-sm text-base-content truncate mt-1">
        <span class="inline-flex items-center gap-1 flex-wrap">
          <span>Submitted by </span>
          <span class="font-medium text-base-content">{{ dataset.submitter }}</span>
          <span class="text-slate-400 text-xs">({{ new Date(dataset.submitTime).toLocaleDateString() }})</span>
        </span>
        <span class="block md:inline md:ml-2 mt-1 md:mt-0 text-sm text-base-content/60" :title="dataset.sizeBytes != null ? `${dataset.sizeBytes.toLocaleString()} bytes` : ''" :aria-label="dataset.sizeBytes != null ? `File size: ${formattedSize} (${dataset.sizeBytes.toLocaleString()} bytes)` : 'File size unknown'">
          {{ formattedSize }}
        </span>
      </p>
    </div>

    <!-- Right: Actions -->
    <div class="relative z-10 flex-none w-full md:w-[140px] flex flex-row md:flex-col gap-3 md:gap-2 md:border-l border-t md:border-t-0 border-base-300 pt-3 md:pt-0 md:pl-4 items-center md:items-start justify-start md:justify-center flex-wrap cursor-default self-stretch" @click.stop>

        <button class="flex items-center gap-2 text-sm font-medium text-base-content/70 hover:text-base-content transition-colors group/btn" @click.stop="$emit('view-metadata', dataset.id)">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008h-.008V8.25z" />
          </svg>
          <span>Metadata</span>
        </button>

        <button class="flex items-center gap-2 text-sm font-medium text-base-content/70 hover:text-base-content transition-colors group/btn" @click.stop="$emit('view-overview', dataset.id)">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
        </svg>
        <span>Overview</span>
      </button>

      <button 
        class="flex items-center gap-2 text-sm font-medium transition-colors group/btn" 
        :class="downloadProgress !== undefined ? 'text-primary pointer-events-none' : 'text-base-content/70 hover:text-base-content'"
        @click.stop="$emit('download', dataset.id)"
      >
          <span v-if="downloadProgress !== undefined" class="loading loading-spinner loading-xs"></span>
          <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span>{{ downloadProgress !== undefined ? `${downloadProgress}%` : 'Download' }}</span>
      </button>

      <!-- Delete for Owner -->
      <template v-if="isMyDataset">
        <div class="hidden md:block w-full h-px bg-base-200 my-1"></div>
        <div class="md:hidden h-4 w-px bg-base-200 mx-1"></div>
          <button class="flex items-center gap-2 text-sm text-error hover:text-error transition-colors group/btn" @click.stop="$emit('delete', dataset.id)">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
           </svg>
           <span>Delete</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Ensure consistent layout inside flex items */
</style>
