<script setup lang="ts">
import { computed } from 'vue'
import type { File } from '@/features/datasets/types/dataset'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'
import { formatBytes } from '@/shared/utils/format'

const props = defineProps<{
  dataset: File
  isMyDataset?: boolean
}>()

const emit = defineEmits<{
  (e: 'view-overview', id: string): void
  (e: 'download', id: string): void
  (e: 'delete', id: string): void
}>()

const formattedSize = computed(() => formatBytes(props.dataset.sizeBytes))

const placeholderSvg = computed(() => {
  return getDatasetPlaceholderSvg({
    // Color is chosen randomly inside the generator on each call
    showGuides: true,
  })
})
</script>

<template>
  <div
    class="group flex flex-col md:flex-row items-start md:items-center p-4 gap-4 bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-base-300 cursor-pointer relative antialiased overflow-hidden"
    @click="$emit('view-overview', dataset.name)"
  >
    <!-- Unclickable background mask to intercept clicks on the entire right side and bottom right edges -->
    <div
      class="absolute right-0 top-0 bottom-0 md:w-[140px] w-full max-md:h-[140px] max-md:top-auto z-0 cursor-default"
      @click.stop
    ></div>

    <!-- Left: Image -->
    <div
      class="relative z-10 flex-none w-full md:w-[200px] h-48 md:h-[200px] rounded-lg overflow-hidden bg-base-200 flex items-center justify-center border border-base-300"
    >
      <img
        :src="`/api/files/${dataset.id}/tic`"
        :alt="dataset.name"
        class="w-full h-full object-contain"
        loading="lazy"
        @error="
          ;($event.target as HTMLImageElement).style.display = 'none'
          ;($event.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
        "
      />
      <div class="w-full h-full text-base-content hidden" v-html="placeholderSvg"></div>
    </div>

    <!-- Middle: Info -->
    <div class="relative z-10 flex-1 flex flex-col justify-center gap-2 min-w-0">
      <div class="flex items-center justify-between gap-2 w-full min-w-0 overflow-hidden">
        <h3
          class="text-xl md:text-2xl font-semibold text-base-content truncate cursor-pointer hover:text-primary dark:hover:text-indigo-400 transition-colors block"
          @click.stop="$emit('view-overview', dataset.name)"
          :title="dataset.name"
          :aria-label="`Dataset name: ${dataset.name}`"
        >
          {{ dataset.name }}
        </h3>
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
          <span class="text-slate-400 text-sm"
            >({{ new Date(dataset.submitTime).toLocaleDateString() }})</span
          >
        </span>
        <span
          class="block md:inline md:ml-2 mt-1 md:mt-0 text-base text-base-content/60"
          :title="dataset.sizeBytes != null ? `${dataset.sizeBytes.toLocaleString()} bytes` : ''"
          :aria-label="
            dataset.sizeBytes != null
              ? `File size: ${formattedSize} (${dataset.sizeBytes.toLocaleString()} bytes)`
              : 'File size unknown'
          "
        >
          {{ formattedSize }}
        </span>
      </p>
    </div>

    <!-- Right: Actions -->
    <div
      class="relative z-10 w-full md:w-[140px] shrink flex flex-row md:flex-col md:justify-evenly gap-2 md:border-l border-t md:border-t-0 border-base-300 pt-3 md:pt-0 md:pl-3 items-center cursor-default self-stretch"
      @click.stop
    >
      <!-- Upload Status -->
      <div
        v-if="dataset.status === 'uploading'"
        class="flex items-center gap-2 text-sm font-medium p-1 rounded text-info"
      >
        <span class="loading loading-spinner loading-xs"></span>
        <span>Uploading</span>
      </div>
      <div
        v-else-if="dataset.status === 'completed'"
        class="flex items-center gap-2 text-sm font-medium p-1 rounded text-success"
      >
        <SvgIcon type="success" class="w-4 h-4" />
        <span>Uploaded</span>
      </div>
      <div
        v-else-if="dataset.status === 'failed'"
        class="flex items-center gap-2 text-sm font-medium p-1 rounded text-error"
      >
        <SvgIcon type="error" class="w-4 h-4" />
        <span>Failed</span>
      </div>

      <button
        v-if="isMyDataset"
        class="flex items-center gap-2 text-sm font-medium p-1 rounded"
        :class="dataset.isPublic ? 'text-slate-400' : 'text-slate-400'"
        :title="dataset.isPublic ? 'Public' : 'Private'"
      >
        <SvgIcon v-if="dataset.isPublic" type="region" class="w-4 h-4" />
        <SvgIcon v-else type="password" class="w-4 h-4" />
        <span>{{ dataset.isPublic ? 'Public' : 'Private' }}</span>
      </button>

      <button
        class="flex items-center gap-2 text-sm font-medium text-base-content/80 hover:text-base-content transition-colors p-1 rounded"
        @click.stop="$emit('view-overview', dataset.name)"
      >
        <SvgIcon type="link" class="w-4 h-4" />
        <span>Overview</span>
      </button>

      <button
        class="flex items-center gap-2 text-sm font-medium text-base-content/80 hover:text-base-content transition-colors p-1 rounded"
        @click.stop="$emit('download', dataset.id)"
      >
        <SvgIcon type="download" class="w-4 h-4" />
        <span>Download</span>
      </button>

      <button
        v-if="isMyDataset"
        class="flex items-center gap-2 text-sm text-error hover:text-error transition-colors p-1 rounded"
        @click.stop="$emit('delete', dataset.id)"
      >
        <SvgIcon type="trash" class="w-4 h-4" />
        <span>Delete</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Ensure consistent layout inside flex items */
</style>
