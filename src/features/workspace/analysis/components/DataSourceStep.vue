<script setup lang="ts">
import UploadModal from '@/features/upload/components/UploadModal.vue'
import { formatBytes } from '@/shared/utils/format'

defineProps<{
  activeTab: 'upload' | 'my'
  uploadOpen: boolean
  datasetQuery: string
  loading: boolean
  error: string
  filteredDatasets: any[]
  selectedDataset: any
}>()

const emit = defineEmits<{
  (e: 'update:activeTab', value: 'upload' | 'my'): void
  (e: 'update:datasetQuery', value: string): void
  (e: 'open-upload'): void
  (e: 'upload-success'): void
  (e: 'upload-close'): void
  (e: 'select-dataset', dataset: any): void
}>()
</script>

<template>
  <section class="bg-white rounded-lg border border-base-200 p-6 shadow-sm">
    <h2 class="text-xl font-medium mb-4">Step 1: Data Source</h2>
    <div class="tabs mb-4">
      <a
        :class="['tab', activeTab === 'upload' ? 'tab-active' : '']"
        @click.prevent="emit('update:activeTab', 'upload')"
        >Upload</a
      >
      <a
        :class="['tab', activeTab === 'my' ? 'tab-active' : '']"
        @click.prevent="emit('update:activeTab', 'my')"
        >My Datasets</a
      >
    </div>

    <div v-if="activeTab === 'upload'">
      <div class="mt-3">
        <button class="btn btn-primary" @click="emit('open-upload')">Open Uploader</button>
      </div>
      <UploadModal
        :isOpen="uploadOpen"
        @upload-success="emit('upload-success')"
        @close="emit('upload-close')"
      />
    </div>

    <div v-if="activeTab === 'my'">
      <div class="mb-2">
        <input
          :value="datasetQuery"
          @input="emit('update:datasetQuery', ($event.target as HTMLInputElement).value)"
          placeholder="Search datasets"
          class="input input-bordered w-full"
        />
      </div>
      <div class="max-h-48 overflow-auto border border-base-200 bg-base-100 rounded-md p-2">
        <div v-if="loading" class="flex items-center justify-center p-4">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <div v-else>
          <div v-if="error" class="text-sm text-error p-3">{{ error }}</div>
          <ul>
            <li
              v-for="dataset in filteredDatasets"
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
                  <div class="text-sm text-base-content/60 ml-2">
                    {{ formatBytes(dataset.sizeBytes) }}
                  </div>
                </div>
                <div class="text-xs text-base-content/60">
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
          <div v-if="filteredDatasets.length === 0" class="text-sm text-base-content/60 p-3">
            No datasets found.
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
