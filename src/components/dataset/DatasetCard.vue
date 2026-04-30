<script setup lang="ts">
import { computed } from 'vue';
import type { File } from '@/types/file';
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
  dataset: File;
  isMyDataset?: boolean;
  downloadProgress?: number;
}>();

const emit = defineEmits<{
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
  <div class="group flex flex-col md:flex-row items-start md:items-center p-4 gap-4 bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-base-300 cursor-pointer relative antialiased overflow-hidden" @click="$emit('view-overview', dataset.name)">
    
    <!-- Unclickable background mask to intercept clicks on the entire right side and bottom right edges -->
    <div class="absolute right-0 top-0 bottom-0 md:w-[140px] w-full max-md:h-[120px] max-md:top-auto z-0 cursor-default" @click.stop></div>

    <!-- Left: Image -->
    <div class="relative z-10 flex-none w-full md:w-[160px] h-48 md:h-[160px] rounded-lg overflow-hidden bg-base-200 flex items-center justify-center border border-base-300">
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
    <div class="relative z-10 flex-1 flex flex-col gap-2 md:px-4 min-w-0">
      <div class="flex items-center justify-between gap-2 w-full min-w-0 overflow-hidden">
        <!-- Title and Private/Public Icon wrapper -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <h3
            class="text-2xl md:text-3xl font-semibold text-base-content truncate cursor-pointer hover:text-primary dark:hover:text-indigo-400 transition-colors block mb-4"
            @click.stop="$emit('view-overview', dataset.name)"
            :title="dataset.name"
            :aria-label="`Dataset name: ${dataset.name}`"
          >
            {{ dataset.name }}
          </h3>
          <!-- Private/Public Icon for MyDatasets -->
           <div v-if="isMyDataset" class="flex-shrink-0 self-center ml-2" :title="dataset.isPublic ? 'Public' : 'Private'">
             <SvgIcon v-if="dataset.isPublic" type="region" class="w-4 h-4 text-slate-400" />
             <SvgIcon v-else type="password" class="w-4 h-4 text-slate-400" />
           </div>
        </div>
        <!-- Fixed Status Badge on the right, prevents overlap by forcing title to truncate -->
        <span class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 whitespace-nowrap" :class="statusColor">
          {{ dataset.status }}
        </span>
      </div>

      <p class="text-base text-base-content truncate" :title="dataset.organism">
        <span class="font-medium">Organism:</span> {{ dataset.organism || '—' }}
      </p>

      <p class="text-base text-base-content truncate" :title="dataset.organismPart">
        <span class="font-medium">Organism Part:</span> {{ dataset.organismPart || '—' }}
      </p>

      <p class="text-base text-base-content truncate" :title="dataset.experimentType">
        <span class="font-medium">Experiment Type:</span> {{ dataset.experimentType || '—' }}
      </p>

      <p class="text-base text-base-content truncate" :title="dataset.ionSource">
        <span class="font-medium">Ionisation Source:</span> {{ dataset.ionSource || '—' }}
      </p>

      <p class="text-base text-base-content truncate" :title="dataset.analyzer">
        <span class="font-medium">Analyzer:</span> {{ dataset.analyzer || '—' }}
      </p>

      <p class="text-base text-base-content truncate">
        <span class="inline-flex items-center gap-1 flex-wrap">
          <span>Submitted by </span>
          <span class="font-medium text-base-content">{{ dataset.submitter }}</span>
          <span class="text-slate-400 text-sm">({{ new Date(dataset.submitTime).toLocaleDateString() }})</span>
        </span>
        <span class="block md:inline md:ml-2 mt-1 md:mt-0 text-base text-base-content/60" :title="dataset.sizeBytes != null ? `${dataset.sizeBytes.toLocaleString()} bytes` : ''" :aria-label="dataset.sizeBytes != null ? `File size: ${formattedSize} (${dataset.sizeBytes.toLocaleString()} bytes)` : 'File size unknown'">
          {{ formattedSize }}
        </span>
      </p>
    </div>

    <!-- Right: Actions -->
    <div class="relative z-10 w-full md:w-[140px] shrink flex flex-row md:flex-col md:justify-evenly gap-2 md:border-l border-t md:border-t-0 border-base-300 pt-3 md:pt-0 md:pl-3 items-center cursor-default self-stretch" @click.stop>

      <button class="flex items-center gap-2 text-sm font-medium text-base-content/80 hover:text-base-content transition-colors p-1 rounded" @click.stop="$emit('view-overview', dataset.name)">
        <SvgIcon type="link" class="w-4 h-4" />
        <span>Overview</span>
      </button>

      <button
        class="flex items-center gap-2 text-sm font-medium transition-colors p-1 rounded"
        :class="downloadProgress !== undefined ? 'text-primary pointer-events-none' : 'text-base-content/80 hover:text-base-content'"
        @click.stop="$emit('download', dataset.id)"
      >
        <span v-if="downloadProgress !== undefined" class="loading loading-spinner loading-xs"></span>
        <SvgIcon v-else type="download" class="w-4 h-4" />
        <span>{{ downloadProgress !== undefined ? `${downloadProgress}%` : 'Download' }}</span>
      </button>

      <button v-if="isMyDataset" class="flex items-center gap-2 text-sm text-error hover:text-error transition-colors p-1 rounded" @click.stop="$emit('delete', dataset.id)">
        <SvgIcon type="trash" class="w-4 h-4" />
        <span>Delete</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Ensure consistent layout inside flex items */
</style>
