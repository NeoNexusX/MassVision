<script setup lang="ts">
import type { PropType } from 'vue';
import DatasetCard from '@/components/dataset/DatasetCard.vue';
import type { File } from '@/types/file';

const props = defineProps({
  datasets: { type: Array as PropType<File[]>, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, required: true },
  meta: { type: Object as PropType<Record<string, any>>, required: true },
  size: { type: Number, required: true },
  pagination: { type: Array as PropType<(number | string)[]>, required: true },
  downloadingMap: { type: Object as PropType<Record<string, number>>, required: true },
  isMyDataset: { type: Boolean, required: false, default: false },
  deletingId: { type: String as PropType<string | null>, required: false, default: null }
});

const emit = defineEmits([
  'view-metadata', 'view-overview', 'download', 'delete', 'change-size', 'go-to-page'
]);

const onChangeSize = (v: number) => emit('change-size', v);
const onGoToPage = (p: number) => emit('go-to-page', p);
</script>

<template>
  <div>
    <!-- Loading state -->
    <div v-if="loading" class="flex flex-col gap-3">
      <div class="animate-pulse flex flex-col gap-4">
        <div class="h-40 bg-base-100 dark:bg-slate-800 rounded-xl p-4"></div>
        <div class="h-40 bg-base-100 dark:bg-slate-800 rounded-xl p-4"></div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="p-4 bg-error/10 dark:bg-error/10/30 rounded mb-4 border border-error/20 text-error">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="!datasets.length" class="p-6 bg-base-100 dark:bg-slate-800 rounded-xl text-base-content mb-4">
      <slot name="empty">No datasets found matching your filters.</slot>
    </div>

    <!-- Data list -->
    <div v-else class="flex flex-wrap gap-6 justify-start">
      <div 
        v-for="dataset in datasets" 
        :key="dataset.id"
        class="w-full md:w-[calc(50%-12px)] flex-shrink-0"
        :class="{ 'opacity-50 pointer-events-none': deletingId === dataset.id }"
      >
        <DatasetCard 
          :dataset="dataset"
          :is-my-dataset="isMyDataset"
          :download-progress="downloadingMap[dataset.id]"
          @view-metadata="$emit('view-metadata', $event)"
          @view-overview="$emit('view-overview', $event)"
          @download="$emit('download', $event)"
          @delete="$emit('delete', $event)"
        />
      </div>
    </div>

    <!-- Pagination (daisyUI join-style) -->
    <div v-if="datasets.length" class="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="text-sm text-base-content text-center sm:text-left">
        Page <span class="font-medium">{{ meta.current_page }}</span> of <span class="font-medium">{{ meta.total_pages }}</span> — <span class="font-medium">{{ meta.total_records }}</span> records
      </div>
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <label class="whitespace-nowrap text-sm text-base-content/60">Per page</label>
          <select :value="size" @change="e => onChangeSize(Number((e.target as HTMLSelectElement).value))" class="select select-sm select-bordered">
            <option :value="10">10</option>
            <option :value="20">20</option>
          </select>
        </div>

        <nav aria-label="Pagination">
          <ul class="join">
            <!-- Prev -->
            <li>
              <button
                :disabled="meta.current_page <= 1"
                @click="() => onGoToPage(meta.current_page - 1)"
                class="join-item btn btn-sm"
              >Prev</button>
            </li>

            <!-- Page buttons -->
            <li v-for="(p, idx) in pagination" :key="`pg-${idx}-${p}`">
              <button
                v-if="p !== '...'"
                @click="() => onGoToPage(Number(p))"
                :aria-current="p === meta.current_page ? 'page' : undefined"
                :class="['join-item btn btn-sm', p === meta.current_page ? 'btn-active' : '']"
              >{{ p }}</button>

              <button v-else class="join-item btn btn-sm btn-disabled">...</button>
            </li>

            <!-- Next -->
            <li>
              <button
                :disabled="meta.current_page >= meta.total_pages"
                @click="() => onGoToPage(meta.current_page + 1)"
                class="join-item btn btn-sm"
              >Next</button>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <!-- Active Downloads Overlay Widgets -->
    <div v-if="Object.keys(downloadingMap).length > 0" class="fixed bottom-6 right-20 z-50 flex flex-col gap-3 pointer-events-none">
      <div 
        v-for="(progress, id) in downloadingMap" 
        :key="id"
        class="card bg-base-100 shadow-2xl border border-base-200 p-4 w-72 pointer-events-auto rounded-xl animate-fade-in-up"
      >
        <div class="flex items-center justify-between mb-3 text-sm">
          <span class="font-bold truncate pr-3 text-base-content" :title="datasets.find(d => d.id === id)?.name || String(id)">
            Downloading: {{ datasets.find(d => d.id === id)?.name || 'Dataset' }}
          </span>
          <span class="font-black text-black whitespace-nowrap">{{ progress }}%</span>
        </div>
        <progress class="progress progress-primary w-full h-2" :value="progress" max="100"></progress>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Styles handled by Tailwind/daisyUI */
</style>
