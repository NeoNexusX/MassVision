<script setup lang="ts">
import type { PropType } from 'vue'
import CollectionCard from '@/features/collections/components/CollectionCard.vue'
import PaginationFooter from '@/shared/components/PaginationFooter.vue'
import type { CollectionListMeta, CollectionSummary } from '@/features/collections/types/collection'

defineProps({
  collections: { type: Array as PropType<CollectionSummary[]>, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, required: true },
  meta: { type: Object as PropType<CollectionListMeta>, required: true },
  size: { type: Number, required: true },
  pagination: { type: Array as PropType<(number | string)[]>, required: true },
  /** 当前已应用的搜索词（区分「还没有集合」与「搜索无结果」两种空态） */
  searchApplied: { type: String, required: true },
  /** 逐卡片判定 Delete 显隐（所有者或管理员；列表含他人集合） */
  canEdit: {
    type: Function as PropType<(collection: CollectionSummary) => boolean>,
    required: true,
  },
})

const emit = defineEmits<{
  (e: 'view', id: number): void
  (e: 'delete', id: number): void
  (e: 'create'): void
  (e: 'clear-search'): void
  (e: 'change-size', size: number): void
  (e: 'go-to-page', page: number): void
}>()
</script>

<template>
  <!-- 与 DatasetList 相同的流式字号基准 -->
  <div class="text-[clamp(1.0rem,2.5vw,1.3rem)]">
    <!-- Loading：与数据集列表同构的脉冲骨架（每行两个） -->
    <div v-if="loading" class="animate-pulse flex flex-wrap gap-6 justify-start">
      <div
        v-for="i in 4"
        :key="i"
        class="w-full md:w-[calc(50%-12px)] h-56 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"
      ></div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="p-4 bg-error/10 dark:bg-error/10/30 rounded mb-4 border border-error/20 text-error"
    >
      {{ error }}
    </div>

    <!-- Empty state：还没有任何集合 -->
    <div
      v-else-if="!collections.length && !searchApplied"
      class="p-12 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300 text-center"
    >
      <SvgIcon type="circle_stack" class="h-12 w-12 mx-auto text-base-content/30 mb-4" />
      <h3 class="text-[1.15em] font-bold text-base-content">No collections yet</h3>
      <p class="mt-2 text-base-content/60">
        Organize related datasets into curated collections to share and revisit them.
      </p>
      <button class="btn btn-primary mt-6 text-[0.95em]" @click="$emit('create')">
        <SvgIcon type="plus" class="w-[1em] h-[1em]" />
        Create Collection
      </button>
    </div>

    <!-- Empty state：搜索无结果 -->
    <div
      v-else-if="!collections.length"
      class="p-12 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300 text-center"
    >
      <SvgIcon type="search" class="h-12 w-12 mx-auto text-base-content/30 mb-4" />
      <h3 class="text-[1.15em] font-bold text-base-content">No collections found</h3>
      <p class="mt-2 text-base-content/60">
        No collections match “{{ searchApplied }}”. Try a different keyword.
      </p>
      <button
        class="btn btn-outline border-base-300 hover:bg-base-300 mt-6 text-[0.95em]"
        @click="$emit('clear-search')"
      >
        Clear Search
      </button>
    </div>

    <!-- 集合列表：与 DatasetList 相同的每行两个排布（md 起两列） -->
    <div v-else class="flex flex-wrap gap-6 justify-start">
      <div
        v-for="collection in collections"
        :key="collection.id"
        class="w-full md:w-[calc(50%-12px)] flex-shrink-0"
      >
        <CollectionCard
          :collection="collection"
          :can-edit="canEdit(collection)"
          @view="$emit('view', $event)"
          @delete="$emit('delete', $event)"
        />
      </div>
    </div>

    <!-- 分页：复用全站 PaginationFooter（Page x of y — z records + Per page + 页码条），
         每页条数走全局 config（与数据集列表一致） -->
    <PaginationFooter
      v-if="collections.length"
      :current-page="meta.current_page"
      :total-pages="meta.total_pages"
      :total-items="meta.total_records"
      :size="size"
      :page-range="pagination"
      @go-to-page="(p) => $emit('go-to-page', p)"
      @change-size="(s) => $emit('change-size', s)"
    />
  </div>
</template>

<style scoped>
/* Styles handled by Tailwind/daisyUI */
</style>
