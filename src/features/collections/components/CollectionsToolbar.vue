<template>
  <!-- 集合列表工具栏：沿用 DatasetFilterBar 的容器几何与搜索/排序控件形态 -->
  <div
    class="flex flex-col md:flex-row gap-4 justify-between items-center page-type bg-base-100 dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-base-300 mb-6"
  >
    <!-- 搜索（占位，后续接入集合检索） -->
    <div class="flex flex-1 items-center gap-2 min-w-0 w-full md:w-auto">
      <SearchInput
        v-model="searchQuery"
        placeholder="Search collections"
        class="flex-1 min-w-0"
        @search="onSearchClick"
      />
      <button @click="onSearchClick" class="btn btn-primary shrink-0 text-[1em]">Search</button>
    </div>

    <!-- 排序：更新时间 / 名称 / 成员数 -->
    <div class="relative w-full md:w-64 min-w-0">
      <select
        v-model="sortValue"
        class="appearance-none w-full min-w-0 bg-base-100 dark:bg-slate-800 border border-base-300 text-base-content py-2 pl-3 pr-8 rounded-lg cursor-pointer text-[1em]"
      >
        <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
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
import type { CollectionSortKey } from '@/features/collections/types/collection'

const emit = defineEmits<{
  (e: 'search', query: string): void
  (e: 'sort', value: CollectionSortKey): void
}>()

const searchQuery = ref('')
const sortValue = ref<CollectionSortKey>('updated_desc')

const sortOptions: { label: string; value: CollectionSortKey }[] = [
  { label: 'Sort by updated time', value: 'updated_desc' },
  { label: 'Sort by name', value: 'name_asc' },
  { label: 'Sort by dataset count', value: 'count_desc' },
]

const onSearchClick = () => emit('search', searchQuery.value)

watch(sortValue, (value) => emit('sort', value))
</script>
