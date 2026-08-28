<template>
  <div
    class="flex flex-col items-center lg:flex-row lg:items-center p-4 gap-4
      bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md
      transition-shadow duration-200 border border-base-300
      cursor-pointer relative overflow-hidden"
    @click="$emit('view-overview', dataset.id)"
  >
    <!-- Unclickable background mask to intercept clicks on the entire right side and bottom right edges -->
    <div
      class="absolute right-0 top-0 bottom-0 lg:w-[140px] w-full max-lg:h-[140px] max-lg:top-auto z-0 cursor-default"
      @click.stop
    ></div>

    <!-- Left: Image -->
    <div class="relative z-10 w-full max-w-[250px] min-w-[120px] aspect-square rounded-lg overflow-hidden bg-base-200 flex items-center justify-center border border-base-300">
      <img
        v-if="ticImageUrl && !ticImageError"
        :src="ticImageUrl"
        :alt="dataset.name"
        class="w-full h-full object-contain"
        loading="lazy"
        @error="ticImageError = true"
      />
      <div v-if="!ticImageUrl || ticImageError" class="w-full h-full text-base-content" v-html="placeholderSvg"></div>
    </div>

    <!-- Middle: Info -->
    <div class="relative z-10 flex flex-1 flex-col justify-center gap-2 min-w-0 max-w-full text-base-content">
        <h3
          class="block truncate cursor-pointer min-w-0 mb-1
            font-bold text-base-content text-[1.1em]
            hover:text-primary dark:hover:text-indigo-400 transition-colors"
          @click.stop="$emit('view-overview', dataset.id)"
          :title="dataset.filename || dataset.name"
          :aria-label="`Dataset name: ${dataset.filename || dataset.name}`"
        >
          {{ dataset.name }}
        </h3>

      <p
        v-for="field in metaFields"
        :key="field.label"
        class="truncate text-[0.95em] "
        :title="field.value ?? ''"
      >
        <span>{{ field.label }}</span>
        <span class="ml-2 font-semibold">{{ field.value || '—' }}</span>
      </p>

    </div>

    <!-- Right: Actions -->
    <div class="relative z-10 cursor-default
        flex flex-row flex-wrap gap-2 items-center self-stretch
        w-full justify-evenly
        lg:w-auto lg:flex-col
        border-t border-base-300 pt-3
        lg:border-l lg:border-t-0 lg:pt-0 lg:pl-3"
      @click.stop
    >
      <template v-for="item in actionItems" :key="item.id">
        <button
          v-if="item.onClick"
          class="flex items-center gap-2 text-[1.0em] font-medium p-1 rounded"
          :class="item.colorClass"
          @click.stop="item.onClick"
        >
          <SvgIcon v-if="item.icon" :type="item.icon" class="w-[1.1em] h-[1.1em]" />
          <span>{{ item.label }}</span>
        </button>
        <div
          v-else
          class="flex items-center gap-2 text-[1.0em] font-medium p-1 rounded"
          :class="item.colorClass"
        >
          <span v-if="item.spinner" class="loading loading-spinner loading-xs"></span>
          <SvgIcon v-else-if="item.icon" :type="item.icon" class="w-[1.1em] h-[1.1em]" />
          <span>{{ item.label }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Ensure consistent layout inside flex items */
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { File } from '@/features/datasets/types/dataset'
import type { IconType } from '@/shared/components/svgIcons'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'
import { formatBytes } from '@/shared/utils/format'
import { buildPreviewImageUrl } from '@/features/datasets/utils/imageUtils'

const props = defineProps<{
  dataset: File
  isMyDataset?: boolean
  packing?: boolean
}>()

const emit = defineEmits<{
  (e: 'view-overview', id: string): void
  (e: 'download', id: string): void
  (e: 'delete', id: string): void
  (e: 'explore', id: string): void
}>()

const ticImageUrl = ref<string>(buildPreviewImageUrl(props.dataset.id))
const ticImageError = ref(false)

const submitDate = computed(() =>
  props.dataset.submitTime
    ? new Date(props.dataset.submitTime).toLocaleDateString()
    : '',
)

const formattedSize = computed(() => formatBytes(props.dataset.sizeBytes))

const metaFields = computed(() => [
  { label: 'Organism:', value: props.dataset.organism },
  { label: 'Organism Part:', value: props.dataset.organismPart },
  { label: 'Ionisation Source:', value: props.dataset.ionSource },
  { label: 'Analyzer:', value: props.dataset.analyzer },
  { label: 'File Size:', value: formattedSize.value },
  { label: 'Submitted by:', value: props.dataset.submitter },
  { label: 'Submit Time:', value: submitDate.value },
])

interface ActionItem {
  id: string
  icon?: IconType
  label: string
  colorClass: string
  spinner?: boolean
  onClick?: () => void
}

const actionItems = computed<ActionItem[]>(() => {
  const items: ActionItem[] = []

  // Upload status
  const status = props.dataset.status
  if (status === 'uploading')
    items.push({ id: 'status', label: 'Uploading', colorClass: 'text-info', spinner: true })
  else if (status === 'completed')
    items.push({ id: 'status', icon: 'success', label: 'Uploaded', colorClass: 'text-success' })
  else if (status === 'failed')
    items.push({ id: 'status', icon: 'error', label: 'Failed', colorClass: 'text-error' })

  // Visibility badge (display only, no action)
  if (props.isMyDataset)
    items.push({
      id: 'visibility',
      icon: props.dataset.isPublic ? 'region' : 'password',
      label: props.dataset.isPublic ? 'Public' : 'Private',
      colorClass: 'text-slate-400',
    })

  // Action buttons
  // Explore / View — 根据是否已有可视化任务决定
  const hasRun = props.dataset.defaultRunId != null

  if (hasRun) {
    // 已有可视化任务 → 直接查看
    items.push({
      id: 'explore',
      icon: 'search',
      label: 'Visualize',
      colorClass: 'text-primary hover:text-primary-focus transition-colors',
      onClick: () => emit('explore', props.dataset.id),
    })
  } else {
    // 未关联可视化任务 → Explore
    items.push({
      id: 'explore',
      icon: 'search',
      label: 'Explore',
      colorClass: 'text-primary hover:text-primary-focus transition-colors',
      onClick: () => emit('explore', props.dataset.id),
    })
  }

  items.push(
    {
      id: 'overview',
      icon: 'link',
      label: 'Overview',
      colorClass: 'text-base-content/80 hover:text-base-content transition-colors',
      onClick: () => emit('view-overview', props.dataset.id),
    },
    props.packing
      ? {
          id: 'download',
          label: 'Packing',
          colorClass: 'text-base-content/80',
          spinner: true,
        }
      : {
          id: 'download',
          icon: 'download',
          label: 'Download',
          colorClass: 'text-base-content/80 hover:text-base-content transition-colors',
          onClick: () => emit('download', props.dataset.id),
        },
  )

  if (props.isMyDataset)
    items.push({
      id: 'delete',
      icon: 'trash',
      label: 'Delete',
      colorClass: 'text-error hover:text-error transition-colors',
      onClick: () => emit('delete', props.dataset.id),
    })

  return items
})

const placeholderSvg = computed(() => {
  return getDatasetPlaceholderSvg({
    // Color is chosen randomly inside the generator on each call
    showGuides: true,
  })
})
</script>