<script setup lang="ts">
import { computed } from 'vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import { getConfig } from '@/shared/config/runtimeConfig'

/**
 * 列表分页页脚：「Page x of y — z records」+ 每页条数下拉 + PaginationBar。
 * variant="compact" 为表格底部工具栏形态（右对齐、小一号字体、无页码文本），见 UserTable。
 */
const props = withDefaults(
  defineProps<{
    currentPage: number
    totalPages: number
    totalItems: number
    size: number
    pageRange: (number | string)[]
    pageSizeOptions?: number[]
    /** false 时隐藏「Page x of y — z records」文本 */
    showPageText?: boolean
    variant?: 'default' | 'compact'
  }>(),
  {
    // 「每页条数」选项来自 config.json（pagination.pageSizeOptions），不写死在组件
    pageSizeOptions: () => getConfig().pagination.pageSizeOptions,
    showPageText: true,
    variant: 'default',
  },
)

const emit = defineEmits<{
  (e: 'go-to-page', page: number): void
  (e: 'change-size', size: number): void
}>()

const from = computed(() => (props.currentPage - 1) * props.size + 1)
const to = computed(() => Math.min(props.currentPage * props.size, props.totalItems))

const onChangeSize = (e: Event) => {
  emit('change-size', Number((e.target as HTMLSelectElement).value))
}
</script>

<template>
  <div
    :class="
      variant === 'compact'
        ? 'p-4 border-t border-base-200 bg-base-200/50'
        : 'mt-6 flex flex-col sm:flex-row items-center justify-between gap-4'
    "
  >
    <div
      v-if="showPageText"
      class="text-[1.1em] text-base-content text-center sm:text-left ml-2"
    >
      Page <span class="font-medium">{{ currentPage }}</span> of
      <span class="font-medium">{{ totalPages }}</span> —
      <span class="font-medium">{{ totalItems }}</span> records
    </div>

    <div
      :class="
        variant === 'compact'
          ? 'flex flex-wrap items-center gap-4 justify-end'
          : 'flex flex-wrap items-center gap-4 mr-2'
      "
    >
      <div class="flex items-center gap-2">
        <label
          class="whitespace-nowrap text-base-content/60"
          :class="variant === 'compact' ? 'text-base' : 'text-[1.1em]'"
          >Per page</label
        >
        <select
          :value="size"
          @change="onChangeSize"
          class="select select-bordered pl-3 pr-8"
          :class="variant === 'compact' ? 'text-base' : 'select-sm text-[1.1em]'"
        >
          <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>

      <PaginationBar
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="totalItems"
        :from="from"
        :to="to"
        :page-range="pageRange"
        class="!justify-center"
        @prev-page="emit('go-to-page', currentPage - 1)"
        @next-page="emit('go-to-page', currentPage + 1)"
        @go-to-page="(p) => emit('go-to-page', p)"
      />
    </div>
  </div>
</template>
