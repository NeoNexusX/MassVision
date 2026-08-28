<script setup lang="ts">
import type { PropType } from 'vue'
import DatasetCard from '@/features/datasets/components/DatasetCard.vue'
import PaginationFooter from '@/shared/components/PaginationFooter.vue'
import type { File } from '@/features/datasets/types/dataset'

defineProps({
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

const emit = defineEmits<{
  (e: 'view-overview', id: string): void
  (e: 'download', id: string): void
  (e: 'delete', id: string): void
  (e: 'explore', id: string): void
  (e: 'change-size', size: number): void
  (e: 'go-to-page', page: number): void
}>()

const onChangeSize = (v: number) => emit('change-size', v)
const onGoToPage = (p: number) => emit('go-to-page', p)
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
    <PaginationFooter
      v-if="datasets.length"
      :current-page="meta.current_page"
      :total-pages="meta.total_pages"
      :total-items="meta.total_records"
      :size="size"
      :page-range="pagination"
      @go-to-page="onGoToPage"
      @change-size="onChangeSize"
    />
  </div>
</template>

<style scoped>
/* Styles handled by Tailwind/daisyUI */
</style>
