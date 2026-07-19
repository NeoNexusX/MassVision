<script setup lang="ts">
import PaginationBar from '@/shared/components/PaginationBar.vue'
import { formatBytes } from '@/shared/utils/format'

const props = defineProps<{
  activeTab: 'my' | 'public'
  datasetQuery: string
  loading: boolean
  error: string
  datasets: any[]
  selectedDataset: any
  meta: Record<string, any>
  page: number
  size: number
  pagination: (number | string)[]
}>()

const emit = defineEmits<{
  (e: 'update:activeTab', value: 'my' | 'public'): void
  (e: 'update:datasetQuery', value: string): void
  (e: 'select-dataset', dataset: any): void
  (e: 'go-to-page', page: number): void
  (e: 'prev-page'): void
  (e: 'next-page'): void
}>()
</script>

<template>
  <section class="bg-base-100 rounded-lg border border-base-200 p-4 sm:p-6 shadow-sm">
    <h2 class="text-[1.5em] font-medium mb-4">Step 1: Data Source</h2>
    <div class="tabs mb-4">
      <a
        :class="['tab', activeTab === 'my' ? 'tab-active' : '']"
        @click.prevent="emit('update:activeTab', 'my')"
        >My Datasets</a
      >
      <a
        :class="['tab', activeTab === 'public' ? 'tab-active' : '']"
        @click.prevent="emit('update:activeTab', 'public')"
        >Public Datasets</a
      >
    </div>

    <div v-if="activeTab === 'my' || activeTab === 'public'">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
        <input
          :value="datasetQuery"
          @input="emit('update:datasetQuery', ($event.target as HTMLInputElement).value)"
          placeholder="Search..."
          class="input input-bordered w-full sm:w-48"
        />
        <div
          v-if="meta.total_pages > 0"
          class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto sm:ml-auto"
        >
          <span class="text-[1em] text-base-content/60 whitespace-nowrap tabular-nums"
            >Page {{ meta.current_page }} / {{ meta.total_pages }} &mdash;
            {{ meta.total_records }} records</span
          >
          <PaginationBar
            :current-page="meta.current_page"
            :total-pages="meta.total_pages"
            :total-items="meta.total_records"
            :from="(meta.current_page - 1) * size + 1"
            :to="Math.min(meta.current_page * size, meta.total_records)"
            :page-range="pagination"
            class="w-full sm:w-auto"
            @prev-page="emit('prev-page')"
            @next-page="emit('next-page')"
            @go-to-page="(p) => emit('go-to-page', p)"
          />
        </div>
      </div>
      <div class="max-h-48 overflow-auto border border-base-200 bg-base-100 rounded-md p-2">
        <div v-if="loading" class="flex items-center justify-center p-4">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <div v-else>
          <div v-if="error" class="text-lg text-error p-3">{{ error }}</div>
          <ul>
            <li
              v-for="dataset in datasets"
              :key="dataset.id"
              :class="[
                'px-4 py-2 cursor-pointer flex items-center justify-between',
                selectedDataset?.id === dataset.id ? 'bg-base-200' : 'hover:bg-base-100',
              ]"
              @click="emit('select-dataset', dataset)"
            >
              <div class="flex-1 mr-4">
                <div class="flex items-center justify-between gap-4">
                  <div class="font-medium truncate">{{ dataset.name }}</div>
                  <div class="text-lg text-base-content/60 ml-2">
                    {{ formatBytes(dataset.sizeBytes) }}
                  </div>
                </div>
                <div class="text-base text-base-content/60">
                  {{ dataset.filename || dataset.submitTime || '–' }}
                </div>
              </div>
              <input
                type="radio"
                name="selectedDataset"
                :checked="selectedDataset?.id === dataset.id"
              />
            </li>
          </ul>
          <div v-if="datasets.length === 0" class="text-lg text-base-content/60 p-3">
            No datasets found.
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
