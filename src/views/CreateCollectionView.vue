<template>
  <!-- 页面外壳与 CollectionsView 一致；pb-24 给 sticky 底部操作条留出空间 -->
  <div class="min-h-screen bg-base-200">
    <div class="max-w-[1680px] mx-auto p-4 md:p-8 pb-24 page-type">
      <!-- 页头：标题/说明。与 Public Datasets 等顶级页面同级，不带面包屑 -->
      <div class="mb-6 px-3">
        <h1 class="page-title font-bold text-base-content">Create Collection</h1>
        <p class="page-subtitle text-base-content/70 mt-1">
          Pick public datasets and organize them into a curated collection.
        </p>
      </div>

      <!-- Step 1: 选择 public 数据集 -->
      <CollectionDatasetPicker
        :datasets="datasets"
        :loading="loading"
        :error="error"
        :meta="meta"
        :size="size"
        :pagination="pagination"
        :query="datasetQuery"
        :is-selected="isSelected"
        :selected-count="selectedCount"
        @update:query="datasetQuery = $event"
        @toggle="toggle"
        @go-to-page="goToPage"
        @change-size="changeSize"
      />

      <!-- Step 2: 已选数据集排序 -->
      <SelectedDatasetList
        class="mt-6"
        :selected="selected"
        @reorder="move"
        @move-up="moveUp"
        @move-down="moveDown"
        @remove="removeById"
        @clear-all="clear"
      />

      <!-- Step 3: 集合元信息（名称/简介） -->
      <CollectionFormCard
        class="mt-6"
        v-model:name="metadata.name"
        v-model:description="metadata.description"
      />

      <!-- Step 4: 学术元数据。可从选中数据集推导的 8 个 list 字段已自动预填，
           手改某字段后该字段停止自动同步，旁边出现「Reset to detected」。 -->
      <section
        class="mt-6 bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm border border-base-300 p-4 sm:p-6"
      >
        <h2 class="text-[1.25em] font-bold text-base-content mb-1">Step 4: Metadata</h2>
        <p class="text-[0.9em] text-base-content/60 mb-4">
          Sample and acquisition fields are pre-filled from the selected datasets. Edit any
          of them and it stops updating automatically.
        </p>
        <CollectionMetadataForm
          :draft="metadata"
          :exclude-keys="['name', 'description']"
          :auto-keys="derivedKeys"
          :locked-keys="lockedKeys"
          @reset-field="resetDerivedField"
        />
      </section>
    </div>

    <!-- 底部 sticky 操作条：汇总 + Cancel/Create，选择/排序时始终可见。
         它不在上方 page-type 容器内，需自行挂 page-type 才能继承全站流体字号基准 -->
    <div
      class="page-type sticky bottom-0 z-30 bg-base-100/95 dark:bg-slate-800/95 backdrop-blur
        border-t border-base-300 py-3 px-4 md:px-8"
    >
      <div class="max-w-[1680px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="text-base-content/70 text-[0.95em]">
          <span class="font-semibold text-base-content">{{ selectedCount }}</span>
          {{ selectedCount === 1 ? 'dataset' : 'datasets' }} ·
          {{ selectedOrganisms.length }}
          {{ selectedOrganisms.length === 1 ? 'organism' : 'organisms' }}
        </div>
        <div class="flex items-center gap-2">
          <button class="btn text-[1em]" @click="cancelCreate">Cancel</button>
          <button
            class="btn btn-primary text-[1em]"
            :disabled="!canCreate || saving"
            @click="submit"
          >
            <SvgIcon v-if="!saving" type="plus" class="w-[1em] h-[1em]" />
            <span v-else class="loading loading-spinner loading-sm"></span>
            Create Collection
          </button>
        </div>
      </div>
    </div>

    <!-- 脏态离开确认（onBeforeRouteLeave promise 守卫驱动） -->
    <ConfirmDialog
      :open="showLeaveConfirm"
      title="Discard unsaved changes?"
      message="Your dataset selection and collection details will be lost."
      confirm-label="Discard"
      danger
      @confirm="confirmLeave"
      @cancel="cancelLeave"
    />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import CollectionDatasetPicker from '@/features/collections/components/CollectionDatasetPicker.vue'
import CollectionFormCard from '@/features/collections/components/CollectionFormCard.vue'
import CollectionMetadataForm from '@/features/collections/components/CollectionMetadataForm.vue'
import SelectedDatasetList from '@/features/collections/components/SelectedDatasetList.vue'
import { useCreateCollection } from '@/features/collections/composables/useCreateCollection'

const router = useRouter()

const {
  // 选择器
  datasets,
  loading,
  error,
  meta,
  size,
  pagination,
  datasetQuery,
  goToPage,
  changeSize,
  // 已选列表
  selected,
  selectedCount,
  selectedOrganisms,
  isSelected,
  toggle,
  move,
  moveUp,
  moveDown,
  removeById,
  clear,
  // 表单（name/description 与学术元数据共用一份草稿）
  metadata,
  derivedKeys,
  lockedKeys,
  resetDerivedField,
  canCreate,
  // 动作
  submit,
  saving,
  // 离开守卫
  showLeaveConfirm,
  confirmLeave,
  cancelLeave,
} = useCreateCollection()

// Cancel 走路由离开，与面包屑/浏览器返回共用同一道脏态守卫
const cancelCreate = () => router.push('/collections')
</script>

<style scoped>
/* Layout handled by Tailwind classes */
</style>
