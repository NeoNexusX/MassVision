<template>
  <div class="min-h-screen bg-base-200">
    <div class="max-w-[1680px] mx-auto p-4 md:p-8 page-type">
      <!-- Loading：与列表页同构的骨架 -->
      <div v-if="loading" class="animate-pulse flex flex-col gap-6">
        <div class="h-16 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
        <div class="h-40 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
        <div class="h-64 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
      </div>

      <!-- 错误态：集合不存在（404）与其他加载失败 -->
      <div
        v-else-if="error"
        class="p-12 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300 text-center"
      >
        <SvgIcon type="circle_stack" class="h-12 w-12 mx-auto text-base-content/30 mb-4" />
        <h3 class="text-[1.15em] font-bold text-base-content">
          {{ notFound ? 'Collection not found' : 'Failed to load collection' }}
        </h3>
        <p class="mt-2 text-base-content/60">{{ error }}</p>
        <div class="mt-6 flex justify-center gap-2">
          <button v-if="!notFound" class="btn btn-outline" @click="fetch">Retry</button>
          <router-link to="/collections" class="btn btn-primary">Back to Collections</router-link>
        </div>
      </div>

      <template v-else-if="detail">
        <!-- 页头：返回 + 名称/标题 + 操作（Edit/Delete 仅 owner/admin；Share 需 publicId） -->
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div class="min-w-0">
            <router-link
              to="/collections"
              class="inline-flex items-center gap-1 text-[0.85em] text-base-content/60 hover:text-primary transition-colors"
            >
              <SvgIcon type="back" class="w-3.5 h-3.5" />
              Collections
            </router-link>
            <h1 class="page-title font-bold text-base-content mt-1 truncate" :title="detail.name">
              {{ detail.name }}
            </h1>
            <p v-if="detail.title" class="text-base-content/70 mt-0.5 truncate">
              {{ detail.title }}
            </p>
          </div>
          <div v-if="canEdit" class="flex items-center gap-2 shrink-0">
            <button
              v-if="detail.publicId"
              class="btn btn-outline border-base-300 text-[0.95em]"
              @click="copyShareLink"
            >
              <SvgIcon type="share" class="w-4 h-4" />
              Share
            </button>
            <button class="btn btn-outline border-base-300 text-[0.95em]" @click="editOpen = true">
              <SvgIcon type="pencil" class="w-4 h-4" />
              Edit
            </button>
            <button
              class="btn btn-outline border-base-300 text-error text-[0.95em]"
              @click="deleteConfirm.open(String(detail.id))"
            >
              <SvgIcon type="trash" class="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        <!-- 统计条 -->
        <div
          class="flex flex-wrap items-center gap-x-6 gap-y-2 bg-base-100 dark:bg-slate-800
            rounded-xl shadow-sm border border-base-300 px-4 py-3 mb-6
            text-[0.9em] text-base-content/70"
        >
          <span class="inline-flex items-center gap-1.5">
            <SvgIcon type="queue_list" class="w-[1.1em] h-[1.1em]" />
            <span class="font-semibold text-base-content">{{ detail.memberCount }}</span>
            {{ detail.memberCount === 1 ? 'dataset' : 'datasets' }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <SvgIcon type="folder" class="w-[1.1em] h-[1.1em]" />
            {{ formatBytes(detail.totalSize) }}
          </span>
          <span class="inline-flex items-center gap-1.5" :title="`Owner: ${detail.ownerUsername}`">
            <SvgIcon type="user" class="w-[1.1em] h-[1.1em]" />
            {{ detail.ownerUsername }}
          </span>
          <span v-if="updatedDate" class="ml-auto whitespace-nowrap">
            Updated {{ updatedDate }}
          </span>
        </div>

        <!-- 学术元数据（表驱动只读展示） -->
        <CollectionMetadataPanel :metadata="detail.metadata" />

        <!-- 成员列表（管理态 = canEdit） -->
        <CollectionMemberList
          class="mt-6"
          :members="members"
          :manage-mode="canEdit"
          :adding="adding"
          :removing="removing"
          :reordering="reordering"
          @add="openAddMembers"
          @remove="memberOps.remove"
          @reorder="memberOps.reorder"
          @download="downloadMember"
        />
      </template>
    </div>

    <!-- 编辑元信息弹窗 -->
    <CollectionDialog
      :open="editOpen"
      :collection="detail"
      @close="editOpen = false"
      @saved="applyDetail"
    />

    <!-- 添加成员弹窗：选择器复用 Picker（排除已在集合中的成员） -->
    <dialog class="modal" :class="{ 'modal-open': addOpen }">
      <div class="modal-box max-w-2xl">
        <CollectionDatasetPicker
          :datasets="pickerDatasets"
          :loading="pickerLoading"
          :error="pickerError"
          :meta="pickerMeta"
          :size="pickerSize"
          :pagination="pickerPagination"
          :query="pickerQuery"
          :is-selected="pickerSelection.isSelected"
          :selected-count="pickerSelection.selected.value.length"
          title="Add Members"
          :exclude-ids="memberIds"
          @update:query="pickerQuery = $event"
          @toggle="pickerSelection.toggle"
          @go-to-page="pickerGoToPage"
          @change-size="pickerChangeSize"
        />
        <div class="modal-action">
          <button class="btn" :disabled="adding" @click="closeAddMembers">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="!pickerSelection.selected.value.length || adding"
            @click="confirmAddMembers"
          >
            <span v-if="adding" class="loading loading-spinner loading-sm"></span>
            Add {{ pickerSelection.selected.value.length || '' }}
            {{ pickerSelection.selected.value.length === 1 ? 'dataset' : 'datasets' }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="closeAddMembers">
        <button @click.prevent="closeAddMembers">close</button>
      </form>
    </dialog>

    <!-- 删除集合确认 -->
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
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CollectionDatasetPicker from '@/features/collections/components/CollectionDatasetPicker.vue'
import CollectionDialog from '@/features/collections/components/CollectionDialog.vue'
import CollectionMemberList from '@/features/collections/components/CollectionMemberList.vue'
import CollectionMetadataPanel from '@/features/collections/components/CollectionMetadataPanel.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { useConfirmDelete } from '@/shared/composables/useConfirmDelete'
import { useToast } from '@/shared/composables/useToast'
import { formatBytes } from '@/shared/utils/format'
import { listFiles } from '@/features/datasets/api/datasetApi'
import { useDatasetList } from '@/features/datasets/composables/useDatasetList'
import type { File } from '@/features/datasets/types/dataset'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { deleteCollection } from '@/features/collections/api/collectionApi'
import { useCollectionDetail } from '@/features/collections/composables/useCollectionDetail'
import { useCollectionMembers } from '@/features/collections/composables/useCollectionMembers'
import { useOrderedSelection } from '@/features/collections/composables/useOrderedSelection'

const router = useRouter()
const { showToast } = useToast()

// ---- 详情 + 成员管理（单一数据源：detail，写操作成功后整体回写）----
const {
  detail,
  loading,
  error,
  notFound,
  canEdit,
  fetch,
  applyDetail,
} = useCollectionDetail()

const memberOps = useCollectionMembers({ detail, refresh: fetch })
const { members, adding, removing, reordering, add } = memberOps

const memberIds = computed(() => members.value.map((m) => String(m.id)))

const updatedDate = computed(() =>
  detail.value?.updatedAt ? new Date(detail.value.updatedAt).toLocaleDateString() : '',
)

// ---- 下载（复用数据集下载链：限流 + 逐文件 iframe 触发）----
const { handleDownloadRaw } = useDownloadProgress()

function downloadMember(member: { id: number; filename: string }) {
  handleDownloadRaw(String(member.id), {
    getFallbackFilename: () => member.filename,
  })
}

// ---- 编辑元信息 ----
const editOpen = ref(false)

// ---- 删除集合：确认后调 API 并回列表 ----
const deleteConfirm = useConfirmDelete({
  onDelete: async (id) => {
    await deleteCollection(Number(id))
    router.push('/collections')
  },
  successMessage: 'Collection deleted',
})

// ---- 分享链接（publicId 后端未确认携带，无则按钮隐藏）----
async function copyShareLink() {
  if (!detail.value?.publicId) return
  const url = `${location.origin}/collections/public/${detail.value.publicId}`
  try {
    await navigator.clipboard.writeText(url)
    showToast('Share link copied to clipboard', 'success')
  } catch {
    showToast(`Share link: ${url}`, 'info')
  }
}

// ---- 添加成员弹窗：picker 直连公开 imzML/completed 列表（与创建页同一套过滤）----
const addOpen = ref(false)

const {
  datasets: pickerDatasets,
  loading: pickerLoading,
  error: pickerError,
  meta: pickerMeta,
  size: pickerSize,
  pagination: pickerPagination,
  fetchFiles: pickerFetch,
  applyFilters: pickerApplyFilters,
  goToPage: pickerGoToPage,
  changeSize: pickerChangeSize,
} = useDatasetList((filters, page, size) => listFiles(filters, page, size, true), {
  defaultFilters: { filename: '', experiment_type: 'imzML', status: ['completed'] },
})
const pickerSelection = useOrderedSelection<File>()
const pickerQuery = ref('')

// 300ms 防抖搜索（与创建页一致）
let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(pickerQuery, (query) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    pickerApplyFilters({ filename: query.trim() })
    pickerFetch({ page: 1, size: pickerSize.value }).catch(() => {})
  }, 300)
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

function openAddMembers() {
  addOpen.value = true
  pickerSelection.clear()
  pickerFetch().catch(() => {})
}

function closeAddMembers() {
  if (adding.value) return
  addOpen.value = false
}

async function confirmAddMembers() {
  const ids = pickerSelection.selected.value.map((f) => Number(f.id))
  if (!ids.length) return
  await add(ids)
  addOpen.value = false
}
</script>

<style scoped>
/* Layout handled by Tailwind classes */
</style>
