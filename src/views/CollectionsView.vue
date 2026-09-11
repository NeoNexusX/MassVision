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
        <!-- 与数据集列表互跳：Public ↔ My ↔ Collections 三个列表页同级 -->
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <router-link
            to="/datasets"
            class="btn btn-outline border-base-300 text-[1em] h-[2.6em] min-h-[2.6em] px-[1.2em]"
          >
            <SvgIcon type="folder" class="w-[1em] h-[1em]" />
            Public Datasets
          </router-link>
          <router-link
            to="/mydatasets"
            class="btn btn-outline border-base-300 text-[1em] h-[2.6em] min-h-[2.6em] px-[1.2em]"
          >
            <SvgIcon type="folder" class="w-[1em] h-[1em]" />
            My Datasets
          </router-link>
          <button
            class="btn btn-primary text-[1em] h-[2.6em] min-h-[2.6em] px-[1.2em]"
            @click="openCreate"
          >
            <SvgIcon type="plus" class="w-[1em] h-[1em]" />
            Create Collection
          </button>
        </div>
      </div>

      <!-- 搜索 / 范围切换（全部 ↔ 我的）/ 排序（仅 updated_at 倒序）工具栏。
           search-applied 传入已应用的搜索词，外部 Clear Search 时联动清空输入框 -->
      <CollectionsToolbar
        v-model:mine-only="mineOnly"
        :search-applied="search"
        @search="handleSearch"
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
        :member-ids="memberIds"
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
      title="Delete collection?"
      message="The collection will be removed. Member datasets are not affected."
      confirm-label="Delete"
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
// 默认 GET /collections/all 浏览全库集合，勾选 Mine only 切到 GET /collections
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
  handleSearch,
  clearSearch,
  goToPage,
  changeSize,
  removeCollection,
} = useCollectionsPage()

// 卡片封面：列表接口不带 members，逐卡按行的 public_id 拉一次公开详情拿成员
// file_id（按集合 id 缓存）。loading 一并下发，详情补齐期间卡片封面显示骨架
// 而不是随机占位图
const { memberIds, loading: coverLoading } = useCollectionCovers(collections)

// 删除确认流：id 用 String 过桥（useConfirmDelete 以 string id 通用化）
const deleteConfirm = useConfirmDelete({
  onDelete: async (id) => removeCollection(Number(id)),
  successMessage: 'Collection deleted',
})

const openCreate = () => {
  router.push({ name: 'CreateCollection' })
}

// 详情页无路径参数（与数据集 overview 同方案）：详情读取走公开接口，public_id
// 随 state 传递；数字 id 仅用于编辑/删除等写操作，一并带上
const handleView = (id: number) => {
  const publicId = collections.value.find((c) => c.id === id)?.publicId
  router.push({ name: 'CollectionOverview', state: { collectionId: id, publicId } })
}
</script>

<style scoped>
/* Layout handled by Tailwind classes */
</style>
