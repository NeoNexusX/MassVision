<template>
  <!-- 集合列表工具栏：沿用 DatasetFilterBar 的容器几何与搜索/排序控件形态 -->
  <div
    class="flex flex-col md:flex-row gap-4 justify-between items-center kawaru-text-100 bg-base-100 dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-base-300 mb-6"
  >
    <!-- 搜索（占位，后续接入集合检索；当前仅本地过滤当前页） -->
    <div class="flex flex-1 items-center gap-2 min-w-0 w-full md:w-auto">
      <SearchInput
        v-model="searchQuery"
:placeholder="$t('collections.toolbar.searchPlaceholder')"
        class="flex-1 min-w-0"
        @search="onSearchClick"
      />
      <button @click="onSearchClick" class="btn btn-primary shrink-0 kawaru-text-100">{{ $t('common.action.search') }}</button>
    </div>

    <!-- 范围切换：默认浏览全部（/collections/all），勾选后仅显示自己的（/collections） -->
    <label
      class="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap
        kawaru-text-95 text-base-content/80"
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        :checked="mineOnly"
        @change="$emit('update:mineOnly', ($event.target as HTMLInputElement).checked)"
      />
      <span>{{ $t('collections.toolbar.mineOnly') }}</span>
    </label>

    <!-- 排序：后端目前仅支持 updated_at 倒序（无排序参数），先以单选项静态展示；
         后端支持排序后在此追加选项并恢复 v-model + @sort 事件 -->
    <div class="relative w-full md:w-64 min-w-0">
      <select
        class="appearance-none w-full min-w-0 bg-base-100 dark:bg-slate-800 border border-base-300 text-base-content py-2 pl-3 pr-8 rounded-lg kawaru-text-100"
:aria-label="$t('collections.toolbar.sortAria')"
      >
        <option>{{ $t('collections.toolbar.sortUpdated') }}</option>
      </select>
      <div
        class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-base-content/60"
      >
        <SvgIcon type="chevron_down" class="fill-current h-[1em] w-[1em]" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import SearchInput from '@/shared/components/SearchInput.vue'

const props = defineProps<{
  /** 仅显示当前登录用户的集合（切换 /collections/all ↔ /collections） */
  mineOnly?: boolean
  /** 当前已应用的搜索词。空态里的 Clear Search 只重置外层状态，
   *  这里跟着清空输入框，避免框里留着旧词与列表状态不一致 */
  searchApplied?: string
}>()

const emit = defineEmits<{
  (e: 'search', query: string): void
  (e: 'update:mineOnly', value: boolean): void
}>()

const searchQuery = ref('')

// 外部清空搜索（如 Clear Search 按钮）时同步清掉输入框；
// 提交搜索（变为非空）不动输入框——两者本就同值
watch(
  () => props.searchApplied,
  (v) => {
    if (!v) searchQuery.value = ''
  },
)

const onSearchClick = () => emit('search', searchQuery.value)
</script>
