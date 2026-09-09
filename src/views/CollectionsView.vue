<template>
  <!-- 页面外壳与 MyDatasets / PublicDatasets 完全一致：bg-base-200 + max-w-[1680px] + page-type -->
  <div class="min-h-screen bg-base-200">
    <div class="max-w-[1680px] mx-auto p-4 md:p-8 page-type">
      <!-- 页头：标题/说明 + Create Collection。与 Public Datasets 等顶级页面同级，不带面包屑 -->
      <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 px-3">
        <div class="min-w-0">
          <h1 class="page-title font-bold text-base-content">Collections</h1>
          <p class="page-subtitle text-base-content/70 mt-1">
            Organize related datasets into curated collections.
          </p>
        </div>
        <button
          class="btn btn-primary shrink-0 text-[1em] h-[2.6em] min-h-[2.6em] px-[1.2em]"
          @click="openCreate"
        >
          <SvgIcon type="plus" class="w-4 h-4" />
          Create Collection
        </button>
      </div>

      <!-- 搜索 / 排序工具栏 -->
      <CollectionsToolbar @search="handleSearch" @sort="handleSort" />

      <!-- 列表（骨架屏 / 空态 / 网格 / 分页） -->
      <CollectionList
        :collections="collections"
        :loading="loading"
        :error="error"
        :meta="meta"
        :size="size"
        :pagination="pagination"
        :search-applied="search"
        :can-edit="canEdit"
        @view="handleView"
        @edit="openEdit"
        @create="openCreate"
        @clear-search="clearSearch"
        @change-size="changeSize"
        @go-to-page="goToPage"
      />

      <!-- Create / Edit 弹窗 -->
      <CollectionDialog
        :open="dialog.open"
        :editing="dialog.editing"
        @save="handleSave"
        @cancel="dialog.open = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import CollectionDialog from '@/features/collections/components/CollectionDialog.vue'
import CollectionList from '@/features/collections/components/CollectionList.vue'
import CollectionsToolbar from '@/features/collections/components/CollectionsToolbar.vue'
import { useCollectionsPage } from '@/features/collections/composables/useCollectionsPage'
import { useToast } from '@/shared/composables/useToast'
import type { Collection, CollectionDraft } from '@/features/collections/types/collection'

const router = useRouter()

const { showToast } = useToast()

// 列表装配（取数/搜索/排序/分页/编辑），数据源为前端 mock
const {
  collections,
  loading,
  error,
  meta,
  size,
  search,
  pagination,
  canEdit,
  handleSearch,
  clearSearch,
  handleSort,
  goToPage,
  changeSize,
  saveEdit,
} = useCollectionsPage()

// Edit 弹窗状态（Create 已迁往 /collections/new 独立页面）
const dialog = reactive({ open: false, editing: null as Collection | null })

const openCreate = () => {
  router.push({ name: 'CreateCollection' })
}

const openEdit = (collection: Collection) => {
  dialog.editing = collection
  dialog.open = true
}

const handleSave = (draft: CollectionDraft) => {
  if (dialog.editing) saveEdit(dialog.editing, draft)
  dialog.open = false
}

// 详情页属于下一设计阶段，先用 toast 占位反馈
const handleView = (_id: string) => {
  showToast('Collection detail page is coming in the next design phase', 'info')
}
</script>

<style scoped>
/* Layout handled by Tailwind classes */
</style>
