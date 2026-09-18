<template>
  <!-- 页面外壳与 MyDatasets / PublicDatasets 完全一致：bg-base-200 + max-w-[1680px] + kawaru-text-100 -->
  <div class="min-h-screen bg-base-200">
    <div class="max-w-[1680px] mx-auto p-4 md:p-8 kawaru-text-100">
      <!-- 页头：标题/说明 + Create Collection。与 Public Datasets 等顶级页面同级，不带面包屑 -->
      <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 px-3">
        <div class="min-w-0">
          <h1 class="kawaru-text-page-title leading-[1.15] font-bold text-base-content">{{ $t('common.page.collections') }}</h1>
          <p class="kawaru-text-100 text-base-content/70 mt-1">
            {{ $t('collections.view.subtitle') }}
          </p>
        </div>
        <!-- 与数据集列表互跳：Public ↔ My ↔ Collections 三个列表页同级。
             实底 + 边框 + 阴影（对齐 DatasetFilterBar 的跨页入口形态），
             透明 btn-outline 在 bg-base-200 页面上几乎看不出边框 -->
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <router-link
            to="/datasets"
            class="btn bg-base-100 dark:bg-slate-800 border-base-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-base-content/25 shadow-sm kawaru-text-100 h-[2.6em] min-h-[2.6em] px-[1.2em]"
          >
            <SvgIcon type="folder" class="w-[1em] h-[1em]" />
            {{ $t('common.page.publicDatasets') }}
          </router-link>
          <router-link
            to="/mydatasets"
            class="btn bg-base-100 dark:bg-slate-800 border-base-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-base-content/25 shadow-sm kawaru-text-100 h-[2.6em] min-h-[2.6em] px-[1.2em]"
          >
            <SvgIcon type="folder" class="w-[1em] h-[1em]" />
            {{ $t('common.page.myDatasets') }}
          </router-link>
          <button
            class="btn btn-primary kawaru-text-100 h-[2.6em] min-h-[2.6em] px-[1.2em]"
            @click="openCreate"
          >
            <SvgIcon type="plus" class="w-[1em] h-[1em]" />
            {{ $t('collections.list.create') }}
          </button>
        </div>
      </div>

      <!-- 搜索 / 范围切换（全部 ↔ 我的）/ 排序（仅 updated_at 倒序）工具栏。
           search-applied 传入已应用的搜索词，外部 Clear Search 时联动清空输入框 -->
      <CollectionsToolbar
        v-model:mine-only="mineOnly"
        :search-applied="search"
        :show-owner-filter="!mineOnly"
        @search="handleSearch"
        @apply-filters="applyFilters"
      />

      <!-- 列表（骨架屏 / 空态 / 单列卡片 / 分页） -->
      <CollectionList
        :collections="collections"
        :loading="loading"
        :error="error"
        :meta="meta"
        :size="size"
        :pagination="pagination"
        :search-applied="search"
        :can-edit="canEdit"
        :member-image-paths="memberImagePaths"
        :cover-loading="coverLoading"
        @view="handleView"
        @delete="(id: number) => deleteConfirm.open(String(id))"
        @create="openCreate"
        @clear-search="clearSearch"
        @change-size="changeSize"
        @go-to-page="goToPage"
      />
    </div>

    <!-- 删除确认（useConfirmDelete 标准流） -->
    <ConfirmDialog
      :open="deleteConfirm.isOpen"
:title="$t('collections.view.deleteTitle')"
      :message="$t('collections.view.deleteMessage')"
      :confirm-label="$t('common.action.delete')"
      danger
      @confirm="deleteConfirm.confirm"
      @cancel="deleteConfirm.cancel"
    />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import CollectionList from '@/features/collections/components/CollectionList.vue'
import CollectionsToolbar from '@/features/collections/components/CollectionsToolbar.vue'
import { useCollectionsPage } from '@/features/collections/composables/useCollectionsPage'
import { useCollectionCovers } from '@/features/collections/composables/useCollectionCovers'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { useConfirmDelete } from '@/shared/composables/useConfirmDelete'

const router = useRouter()

// 列表装配（取数/服务端分页/范围切换/本地搜索/删除）：
// 默认 POST /collections/list_all 浏览全库集合，勾选 Mine only 切到 POST /collections/list
const {
  collections,
  loading,
  error,
  meta,
  size,
  mineOnly,
  search,
  pagination,
  canEdit,
  isMine,
  handleSearch,
  clearSearch,
  applyFilters,
  goToPage,
  changeSize,
  removeCollection,
} = useCollectionsPage()

// 卡片封面：列表接口不带 members，逐卡按行的 public_id 拉一次公开详情拿成员
// imagePath（按集合 id 缓存）。loading 一并下发，详情补齐期间卡片封面显示骨架
// 而不是随机占位图
const { memberImagePaths, loading: coverLoading } = useCollectionCovers(collections)

// 删除确认流：id 用 String 过桥（useConfirmDelete 以 string id 通用化）
const deleteConfirm = useConfirmDelete({
  onDelete: async (id) => removeCollection(Number(id)),
})

const openCreate = () => {
  router.push({ name: 'CreateCollection' })
}

const handleView = (id: number) => {
  const publicId = collections.value.find((collection) => collection.id === id)?.publicId
  router.push({ name: 'CollectionOverview', state: { collectionId: id, publicId } })
}
</script>

<style scoped>
/* Layout handled by Tailwind classes */
</style>
