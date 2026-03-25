<script setup lang="ts">
import { computed } from 'vue';
import type { Dataset } from '@/types/dataset';

const props = defineProps<{
  dataset: Dataset;
  isMyDataset?: boolean;
}>();

const emit = defineEmits<{
  (e: 'view-metadata', id: string): void;
  (e: 'view-overview', id: string): void;
  (e: 'edit', id: string): void;
  (e: 'delete', id: string): void;
}>();

const statusColor = computed(() => {
  switch (props.dataset.status) {
    case 'Processing': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
    case 'Queued': return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800';
    case 'Finished': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
    default: return 'text-gray-600';
  }
});
</script>

<template>
  <div class="group flex items-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 border border-slate-200 dark:border-slate-700">
    <!-- Left: Image -->
    <div class="flex-none w-[120px] h-[120px] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-700">
      <img 
        v-if="dataset.thumbnailUrl" 
        :src="dataset.thumbnailUrl" 
        :alt="dataset.name" 
        class="w-full h-full object-cover"
        loading="lazy"
      />
      <div v-else class="text-slate-300 dark:text-slate-600">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    </div>

    <!-- Middle: Info -->
    <div class="flex-1 flex flex-col gap-1 px-4 min-w-0">
      <div class="flex items-center gap-2">
        <h3 class="font-bold text-lg text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" @click="$emit('view-overview', dataset.id)">
          {{ dataset.name }}
        </h3>
        <!-- Private/Public Icon for MyDatasets -->
        <div v-if="isMyDataset" class="flex-shrink-0" :title="dataset.isPublic ? 'Public' : 'Private'">
           <svg v-if="dataset.isPublic" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-slate-400">
              <path fill-rule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM5.94 13.94A5.994 5.994 0 0110 4.06v2.333a3.666 3.666 0 100 7.333V16.7c-2.32-.445-4.218-2.022-4.06-2.76z M10 16.7v-2.977a3.667 3.667 0 003.553-3.666h2.333A5.994 5.994 0 0110 16.7z" clip-rule="evenodd" /> <!-- Simplified globe -->
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" /> <!-- Fallback circle if simplified is weird -->
           </svg>
           <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-slate-400">
              <path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v3H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm-2 4a2 2 0 114 0v3H8V6z" clip-rule="evenodd" />
           </svg>
        </div>
        <span class="text-xs px-2 py-0.5 rounded-full font-medium ml-auto sm:ml-2" :class="statusColor">
          {{ dataset.status }}
        </span>
      </div>

      <p class="text-sm text-slate-600 dark:text-slate-400 truncate" :title="dataset.sampleDesc">
        <span class="font-medium">Sample:</span> {{ dataset.sampleDesc }}
      </p>
      
      <p class="text-sm text-slate-600 dark:text-slate-400 truncate" :title="dataset.instrument">
        <span class="font-medium">Instrument:</span> {{ dataset.instrument }}
      </p>

      <p class="text-sm text-slate-600 dark:text-slate-400 truncate">
        <span>Submitted by </span>
        <span class="font-medium text-slate-800 dark:text-slate-200">{{ dataset.submitter }}</span>
        <span> at </span>
        <span class="font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1 rounded">{{ dataset.institution }}</span>
        <span class="ml-1 text-slate-400 text-xs">({{ new Date(dataset.submitTime).toLocaleDateString() }})</span>
      </p>
    </div>

    <!-- Right: Actions -->
    <div class="flex-none w-[140px] flex flex-col gap-2 border-l border-slate-100 dark:border-slate-700 pl-4 items-start justify-center">

      <button class="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group/btn" @click="$emit('view-metadata', dataset.id)">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008h-.008V8.25z" />
        </svg>
        <span class="group-hover/btn:underline decoration-transparent group-hover/btn:decoration-indigo-300 underline-offset-2 transition-all">Metadata</span>
      </button>

      <button class="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group/btn" @click="$emit('view-overview', dataset.id)">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
        </svg>
        <span class="group-hover/btn:underline decoration-transparent group-hover/btn:decoration-indigo-300 underline-offset-2 transition-all">Overview</span>
      </button>

      <!-- Edit/Delete for Owner -->
      <template v-if="isMyDataset">
        <div class="w-full h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
        <button class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group/btn" @click="$emit('edit', dataset.id)">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
           </svg>
           <span>Edit</span>
        </button>
        <button class="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors group/btn" @click="$emit('delete', dataset.id)">
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
