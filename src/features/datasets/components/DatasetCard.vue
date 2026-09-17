<template>
  <!-- 六个容器：卡片 → 左（文件名/图片/信息）+ 右（状态/操作）。
       右侧容器 lg 下宽 8em，public 与 my datasets 卡片几何完全一致；
       中间信息以左容器为基准居中，右侧操作列靠左、纵向均匀分布。 -->
  <div
    class="flex flex-col lg:flex-row p-4 gap-x-4 gap-y-2
      bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md
      transition-shadow duration-200 border border-base-300
      cursor-pointer relative overflow-hidden"
    @click="$emit('view-overview', dataset.publicId)"
  >
    <!-- 左侧容器：文件名 + 图片 + 中间信息 -->
    <div class="flex flex-1 min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
      <!-- 文件名 + 可见性标志：标志由右侧操作列移到这里（同一行）。
           My Datasets 才有（public 列表不展示），且只保留 svg——文字信息
           收进 title/aria-label，不占横向空间。 -->
      <h3
        class="w-full flex items-center gap-2 min-w-0
          font-bold text-base-content kawaru-text-112 leading-snug"
        :aria-label="$t('datasets.card.datasetName', { name: dataset.filename || dataset.name })"
      >
        <span
          class="truncate cursor-pointer min-w-0
            hover:text-primary dark:hover:text-indigo-400 transition-colors"
          :title="dataset.filename || dataset.name"
          @click.stop="$emit('view-overview', dataset.publicId)"
        >
          {{ dataset.name }}
        </span>
        <span
          v-if="isMyDataset"
          class="shrink-0 inline-flex items-center text-slate-400"
          :title="dataset.isPublic ? $t('datasets.card.public') : $t('datasets.card.private')"
          :aria-label="dataset.isPublic ? $t('datasets.card.public') : $t('datasets.card.private')"
        >
          <SvgIcon :type="dataset.isPublic ? 'region' : 'password'" class="w-[1.1em] h-[1.1em]" />
        </span>
      </h3>

      <!-- 图片 -->
      <div class="w-full max-w-[250px] min-w-[120px] aspect-square rounded-lg overflow-hidden border border-base-300">
        <DatasetPreviewGallery :image-path="dataset.imagePath" :storage-mode="dataset.storageMode" />
      </div>

      <!-- 中间信息：以左容器为基准，在图片与右侧容器之间居中 -->
      <div class="flex flex-1 flex-col justify-center gap-2 min-w-0 max-w-full text-base-content">
        <p
          v-for="field in metaFields"
          :key="field.label"
          class="truncate kawaru-text-95"
          :title="field.value ?? ''"
        >
          <span>{{ field.label }}</span>
          <span class="ml-2 font-semibold">{{ field.value || '—' }}</span>
        </p>

      </div>
    </div>

    <!-- 右侧容器：上传状态 + 操作。整列点击不触发卡片跳转。
         lg：靠左对齐，列宽 8em 减去 pl-3 后的内容盒能装下最宽的
         "Visualize" 项并给右侧留出空隙；justify-evenly
         随条目数自适应拉开间距（public 4 项也能均匀排满整列）。
         列宽用 8em 而非写死 160px：本容器自挂 kawaru-text-100 钉住字号，
         8em 恒等于「档位 × 8」，换档时列宽同步跟上，标签不会撞墙换行。 -->
    <div
      class="cursor-default kawaru-text-100
        flex flex-row flex-wrap gap-2 items-center justify-evenly
        w-full border-t border-base-300 pt-3
        lg:w-[8em] lg:flex-col lg:items-start lg:self-stretch
        lg:border-l lg:border-t-0 lg:pt-0 lg:pl-3"
      @click.stop
    >
      <template v-for="item in actionItems" :key="item.id">
        <button
          v-if="item.onClick"
          class="flex items-center gap-2 kawaru-text-100 font-medium p-1 rounded"
          :class="item.colorClass"
          @click.stop="item.onClick"
        >
          <SvgIcon v-if="item.icon" :type="item.icon" class="w-[1.1em] h-[1.1em]" />
          <span>{{ item.label }}</span>
        </button>
        <div
          v-else
          class="flex items-center gap-2 kawaru-text-100 font-medium p-1 rounded"
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
import { computed } from 'vue'
import type { File } from '@/features/datasets/types/dataset'
import type { IconType } from '@/shared/components/svgIcons'
import { formatBytes, formatDate } from '@/shared/utils/format'
import DatasetPreviewGallery from '@/features/datasets/components/DatasetPreviewGallery.vue'
import { vocabLabel } from '@/features/datasets/constants/vocabLabels'
import { t } from '@/i18n'

const props = defineProps<{
  dataset: File
  isMyDataset?: boolean
  packing?: boolean
}>()

const emit = defineEmits<{
  (e: 'view-overview', publicId: string): void
  (e: 'download', publicId: string): void
  (e: 'delete', publicId: string): void
  (e: 'explore', publicId: string): void
  (e: 'edit', publicId: string): void
}>()

const submitDate = computed(() => formatDate(props.dataset.submitTime))

const formattedSize = computed(() => formatBytes(props.dataset.sizeBytes))

const labelColon = (label: string) => t('common.format.labelColon', { label })

const metaFields = computed(() => [
  { label: labelColon(t('common.meta.organism')), value: vocabLabel(props.dataset.organism) },
  { label: labelColon(t('common.meta.organismPart')), value: vocabLabel(props.dataset.organismPart) },
  { label: labelColon(t('common.meta.ionisationSource')), value: vocabLabel(props.dataset.ionSource) },
  { label: labelColon(t('common.meta.analyzer')), value: vocabLabel(props.dataset.analyzer) },
  { label: labelColon(t('datasets.field.fileSize')), value: formattedSize.value },
  { label: labelColon(t('datasets.field.submittedBy')), value: props.dataset.submitter },
  { label: labelColon(t('datasets.card.submitTime')), value: submitDate.value },
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
    items.push({ id: 'status', label: t('common.status.processing'), colorClass: 'text-info', spinner: true })
  else if (status === 'completed')
    items.push({ id: 'status', icon: 'success', label: t('datasets.card.uploaded'), colorClass: 'text-success' })
  else if (status === 'failed')
    items.push({ id: 'status', icon: 'error', label: t('common.status.failed'), colorClass: 'text-error' })

  // 元信息编辑（原本在 Dataset Overview 页，现收到卡片右侧；可见性标志已挪到文件名旁）
  if (props.isMyDataset)
    items.push({
      id: 'edit',
      icon: 'pencil',
      label: t('common.action.edit'),
      colorClass: 'text-base-content/80 hover:text-base-content transition-colors',
      onClick: () => emit('edit', props.dataset.publicId),
    })

  // Action buttons
  // Explore / View — 根据是否已有可视化任务决定
  const hasRun = props.dataset.defaultRunId != null

  if (hasRun) {
    // 已有可视化任务 → 直接查看
    items.push({
      id: 'explore',
      icon: 'search',
      label: t('datasets.card.visualize'),
      colorClass: 'text-primary hover:text-primary-focus transition-colors',
      onClick: () => emit('explore', props.dataset.publicId),
    })
  } else {
    // 未关联可视化任务 → Explore
    items.push({
      id: 'explore',
      icon: 'search',
      label: t('datasets.card.explore'),
      colorClass: 'text-primary hover:text-primary-focus transition-colors',
      onClick: () => emit('explore', props.dataset.publicId),
    })
  }

  items.push(
    {
      id: 'overview',
      icon: 'document-text',
      label: t('datasets.card.overview'),
      colorClass: 'text-base-content/80 hover:text-base-content transition-colors',
      onClick: () => emit('view-overview', props.dataset.publicId),
    },
    props.packing
      ? {
          id: 'download',
          label: t('datasets.card.packing'),
          colorClass: 'text-base-content/80',
          spinner: true,
        }
      : {
          id: 'download',
          icon: 'download',
          label: t('common.action.download'),
          colorClass: 'text-base-content/80 hover:text-base-content transition-colors',
          onClick: () => emit('download', props.dataset.publicId),
        },
  )

  if (props.isMyDataset)
    items.push({
      id: 'delete',
      icon: 'trash',
      label: t('common.action.delete'),
      colorClass: 'text-error hover:text-error transition-colors',
      onClick: () => emit('delete', props.dataset.publicId),
    })

  return items
})
</script>