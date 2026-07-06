<script setup lang="ts">
import type { PropType } from 'vue'
import DatasetCard from '@/features/datasets/components/DatasetCard.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import { getConfig } from '@/shared/config/runtimeConfig'
import type { File } from '@/features/datasets/types/dataset'

const props = defineProps({
  datasets: { type: Array as PropType<File[]>, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, required: true },
  meta: { type: Object as PropType<Record<string, any>>, required: true },
  size: { type: Number, required: true },
  pagination: { type: Array as PropType<(number | string)[]>, required: true },
  isMyDataset: { type: Boolean, required: false, default: false },
  deletingId: { type: String as PropType<string | null>, required: false, default: null },
  packingIds: { type: Object as PropType<Set<string>>, required: false, default: () => new Set() },
})

const emit = defineEmits(['view-overview', 'download', 'delete', 'explore', 'change-size', 'go-to-page'])

const onChangeSize = (v: number) => emit('change-size', v)
const onGoToPage = (p: number) => emit('go-to-page', p)

// 「每页条数」选项来自 config.json（pagination.pageSizeOptions），不写死在组件
const pageSizeOptions = getConfig().pagination.pageSizeOptions
</script>

<template>
  <div class="text-[clamp(1.0rem,2.5vw,1.3rem)]">
    <!-- Loading state -->
    <div v-if="loading" class="flex flex-col gap-3">
      <div class="animate-pulse flex flex-col gap-4">
        <div class="h-40 bg-base-100 dark:bg-slate-800 rounded-xl p-4"></div>
        <div class="h-40 bg-base-100 dark:bg-slate-800 rounded-xl p-4"></div>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="p-4 bg-error/10 dark:bg-error/10/30 rounded mb-4 border border-error/20 text-error"
    >
      {{ error }}
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!datasets.length"
      class="p-6 bg-base-100 dark:bg-slate-800 rounded-xl text-base-content mb-4"
    >
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
          :packing="packingIds.has(dataset.id)"
          @view-overview="$emit('view-overview', $event)"
          @download="$emit('download', $event)"
          @delete="$emit('delete', $event)"
          @explore="$emit('explore', $event)"
        />
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="datasets.length"
      class="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
    >
      <div class="text-[1.1em] text-base-content text-center sm:text-left ml-2">
        Page <span class="font-medium">{{ meta.current_page }}</span> of
        <span class="font-medium">{{ meta.total_pages }}</span> —
        <span class="font-medium">{{ meta.total_records }}</span> records
      </div>
      
      <div class="flex flex-wrap items-center gap-4 mr-2">
        <div class="flex items-center gap-2">
          <label class="whitespace-nowrap text-[1.1em] text-base-content/60">Per page</label>
          <select
            :value="size"
            @change="(e) => onChangeSize(Number((e.target as HTMLSelectElement).value))"
            class="select select-sm select-bordered text-[1.1em] pl-3 pr-8"
          >
            <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>

        <PaginationBar
          :current-page="meta.current_page"
          :total-pages="meta.total_pages"
          :total-items="meta.total_records"
          :from="(meta.current_page - 1) * size + 1"
          :to="Math.min(meta.current_page * size, meta.total_records)"
          :page-range="pagination"
          class="!justify-center"
          @prev-page="() => onGoToPage(meta.current_page - 1)"
          @next-page="() => onGoToPage(meta.current_page + 1)"
          @go-to-page="onGoToPage"
        >
        </PaginationBar>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Styles handled by Tailwind/daisyUI */
</style>
