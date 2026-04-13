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
  return getDatasetPlaceholderSvg({
    // Color is chosen randomly inside the generator on each call
    showGuides: true
  });
});
</script>

<template>
  <div class="group flex flex-col md:flex-row items-start md:items-center p-4 gap-4 bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 border border-base-300 cursor-pointer relative" @click="$emit('view-overview', dataset.name)">
    
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
            @click.stop="$emit('view-overview', dataset.name)"
            :title="dataset.name"
            :aria-label="`Dataset name: ${dataset.name}`"
          >
            {{ dataset.name }}
          </h3>
           <!-- Private/Public Icon for MyDatasets -->
           <div v-if="isMyDataset" class="flex-shrink-0" :title="dataset.isPublic ? 'Public' : 'Private'">
             <SvgIcon v-if="dataset.isPublic" type="region" class="w-4 h-4 text-slate-400" />
             <SvgIcon v-else type="password" class="w-4 h-4 text-slate-400" />
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
          <SvgIcon type="info" class="w-4 h-4" />
          <span>Metadata</span>
        </button>

        <button class="flex items-center gap-2 text-sm font-medium text-base-content/70 hover:text-base-content transition-colors group/btn" @click.stop="$emit('view-overview', dataset.name)">
        <SvgIcon type="link" class="w-4 h-4" />
        <span>Overview</span>
      </button>

      <button 
        class="flex items-center gap-2 text-sm font-medium transition-colors group/btn" 
        :class="downloadProgress !== undefined ? 'text-primary pointer-events-none' : 'text-base-content/70 hover:text-base-content'"
        @click.stop="$emit('download', dataset.id)"
      >
          <span v-if="downloadProgress !== undefined" class="loading loading-spinner loading-xs"></span>
          <SvgIcon v-else type="download" class="w-4 h-4" />
          <span>{{ downloadProgress !== undefined ? `${downloadProgress}%` : 'Download' }}</span>
      </button>

      <!-- Delete for Owner -->
      <template v-if="isMyDataset">
        <div class="hidden md:block w-full h-px bg-base-200 my-1"></div>
        <div class="md:hidden h-4 w-px bg-base-200 mx-1"></div>
           <button class="flex items-center gap-2 text-sm text-error hover:text-error transition-colors group/btn" @click.stop="$emit('delete', dataset.id)">
            <SvgIcon type="trash" class="w-4 h-4" />
            <span>Delete</span>
          </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Ensure consistent layout inside flex items */
</style>
