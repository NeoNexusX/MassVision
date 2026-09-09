<template>
  <!-- Step 1 选择区卡片：搜索 + 紧凑行列表（checkbox 多选）+ 分页。
       行风格参照分析向导 DataSourceStep（max-h 滚动容器 + li 行），
       多选状态由父级持有，跨页/跨搜索的已选项经 isSelected 回显。 -->
  <section
    class="bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm border border-base-300 p-4 sm:p-6"
  >
    <div class="flex items-center justify-between gap-3 mb-4">
      <h2 class="text-[1.25em] font-bold text-base-content">Step 1: Choose Datasets</h2>
      <span class="badge badge-primary badge-sm gap-1 font-medium whitespace-nowrap">
        <SvgIcon type="check" class="w-[0.9em] h-[0.9em]" />
        {{ selectedCount }} selected
      </span>
    </div>

    <!-- 搜索：实时防抖（300ms），由 composable 侧 watch 处理。
         IconInput 的 update:modelValue 参数是 string | number，这里收敛为 string -->
    <IconInput
      :model-value="query"
      icon-type="search"
      placeholder="Search public datasets"
      class="mb-3"
      @update:model-value="emit('update:query', String($event))"
    />

    <!-- 行列表 -->
    <div class="max-h-72 overflow-auto border border-base-200 dark:border-slate-700 bg-base-100 dark:bg-slate-800 rounded-md p-2">
      <div v-if="loading" class="flex items-center justify-center p-6">
        <span class="loading loading-spinner loading-md"></span>
      </div>
      <template v-else>
        <div v-if="error" class="text-error p-3">{{ error }}</div>
        <ul v-else-if="datasets.length" class="flex flex-col gap-1">
          <li
            v-for="dataset in datasets"
            :key="dataset.id"
            :class="[
              'px-3 py-2 rounded-lg cursor-pointer flex items-center gap-3 transition-colors',
              isSelected(dataset.id)
                ? 'bg-primary/10 dark:bg-primary/20'
                : 'hover:bg-base-200 dark:hover:bg-slate-700',
            ]"
            @click="emit('toggle', dataset)"
          >
            <input
              type="checkbox"
              class="checkbox checkbox-sm checkbox-primary shrink-0"
              :checked="isSelected(dataset.id)"
              :aria-label="`Select ${dataset.name}`"
              tabindex="-1"
              @click.stop
              @change="emit('toggle', dataset)"
            />
            <div class="w-10 h-10 shrink-0">
              <DatasetThumb :file-id="dataset.id" :alt="`Preview of ${dataset.name}`" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate text-base-content" :title="dataset.name">
                {{ dataset.name }}
              </div>
              <div class="text-[0.85em] text-base-content/60 truncate">
                {{ [dataset.organism, dataset.submitter].filter(Boolean).join(' · ') || '–' }}
              </div>
            </div>
            <div class="text-[0.85em] text-base-content/60 whitespace-nowrap tabular-nums shrink-0">
              {{ formatBytes(dataset.sizeBytes) }}
            </div>
          </li>
        </ul>
        <div v-else class="text-base-content/60 p-6 text-center">
          No public datasets found.
        </div>
      </template>
    </div>

    <!-- 分页：复用全站 PaginationFooter（含每页条数切换） -->
    <PaginationFooter
      v-if="datasets.length"
      class="mt-3"
      :current-page="meta.current_page"
      :total-pages="meta.total_pages"
      :total-items="meta.total_records"
      :size="size"
      :page-range="pagination"
      variant="compact"
      @go-to-page="(p) => emit('go-to-page', p)"
      @change-size="(s) => emit('change-size', s)"
    />
  </section>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import DatasetThumb from '@/features/collections/components/DatasetThumb.vue'
import IconInput from '@/shared/components/IconInput.vue'
import PaginationFooter from '@/shared/components/PaginationFooter.vue'
import { formatBytes } from '@/shared/utils/format'
import type { File } from '@/features/datasets/types/dataset'
import type { CollectionListMeta } from '@/features/collections/types/collection'

defineProps({
  datasets: { type: Array as PropType<File[]>, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, required: true },
  meta: { type: Object as PropType<CollectionListMeta>, required: true },
  size: { type: Number, required: true },
  pagination: { type: Array as PropType<(number | string)[]>, required: true },
  query: { type: String, required: true },
  /** 逐行判定已选（跨页已选项在回到当前页时回显勾选态） */
  isSelected: { type: Function as PropType<(id: string) => boolean>, required: true },
  selectedCount: { type: Number, required: true },
})

const emit = defineEmits<{
  (e: 'update:query', value: string): void
  (e: 'toggle', dataset: File): void
  (e: 'go-to-page', page: number): void
  (e: 'change-size', size: number): void
}>()
</script>
