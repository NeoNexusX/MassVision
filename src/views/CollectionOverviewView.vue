<template>
  <div class="min-h-screen bg-base-200">
    <div class="max-w-[1680px] mx-auto p-4 md:p-8 kawaru-text-100">
      <!-- Loading：与列表页同构的骨架 -->
      <div v-if="loading" class="animate-pulse flex flex-col gap-6">
        <div class="h-16 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
        <div class="h-40 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
        <div class="h-64 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
      </div>

      <!-- 无 state 进入（直刷/书签 /collections/overview）：id 已丢失，
           与数据集 overview 同策略，引导回列表而不是留白 -->
      <div
        v-else-if="isStale"
        class="p-12 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300 text-center"
      >
        <SvgIcon type="circle_stack" class="h-12 w-12 mx-auto text-base-content/30 mb-4" />
        <h3 class="kawaru-text-112 font-bold text-base-content">Session lost</h3>
        <p class="mt-2 text-base-content/60">
          Please navigate from Collections to view details.
        </p>
        <router-link to="/collections" class="btn btn-primary mt-6 kawaru-text-100">
          Back to Collections
        </router-link>
      </div>

      <!-- 错误态：集合不存在（404）与其他加载失败 -->
      <div
        v-else-if="error"
        class="p-12 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300 text-center"
      >
        <SvgIcon type="circle_stack" class="h-12 w-12 mx-auto text-base-content/30 mb-4" />
        <h3 class="kawaru-text-112 font-bold text-base-content">
          {{ notFound ? 'Collection not found' : 'Failed to load collection' }}
        </h3>
        <p class="mt-2 text-base-content/60">{{ error }}</p>
        <div class="mt-6 flex justify-center gap-2">
          <button v-if="!notFound" class="btn btn-outline kawaru-text-100" @click="fetch">Retry</button>
          <router-link to="/collections" class="btn btn-primary kawaru-text-100">
            Back to Collections
          </router-link>
        </div>
      </div>

      <template v-else-if="detail">
        <!-- 页头：返回 + 名称/标题 + 操作（Edit/Delete 仅 owner/admin；Share 需 publicId） -->
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div class="min-w-0">
            <router-link
              to="/collections"
              class="inline-flex items-center gap-1 kawaru-text-87 text-base-content/60 hover:text-primary transition-colors"
            >
              <SvgIcon type="back" class="w-[0.9em] h-[0.9em]" />
              Collections
            </router-link>
            <h1 class="kawaru-text-page-title leading-[1.15] font-bold text-base-content mt-1 truncate" :title="headerName">
              {{ headerName }}
            </h1>
            <p v-if="headerTitle" class="text-base-content/70 mt-0.5 truncate">
              {{ headerTitle }}
            </p>
          </div>
          <div v-if="canEdit" class="flex items-center gap-2 shrink-0">
            <!-- 编辑态：原地修改，头部换成保存/取消（Delete/Share 期间隐藏，避免误触） -->
            <template v-if="editing">
              <button
                class="btn btn-outline border-base-300 kawaru-text-95"
                :disabled="saving"
                @click="cancel"
              >
                Cancel
              </button>
              <button
                class="btn btn-primary kawaru-text-95"
                :disabled="saving || !isDirty || !draft?.name?.trim()"
                @click="save"
              >
                <span v-if="saving" class="loading loading-spinner loading-sm"></span>
                Save Changes
              </button>
            </template>
            <template v-else>
              <button
                v-if="detail.publicId"
                class="btn btn-outline border-base-300 kawaru-text-95"
                @click="copyShareLink"
              >
                <SvgIcon type="share" class="w-[1em] h-[1em]" />
                Share
              </button>
              <button class="btn btn-outline border-base-300 kawaru-text-95" @click="start">
                <SvgIcon type="pencil" class="w-[1em] h-[1em]" />
                Edit
              </button>
              <button
                class="btn btn-outline border-base-300 text-error kawaru-text-95"
                @click="deleteConfirm.open(String(detail.id))"
              >
                <SvgIcon type="trash" class="w-[1em] h-[1em]" />
                Delete
              </button>
            </template>
          </div>
        </div>

        <!-- 表单校验失败（Name 必填/超长等）：留在原地编辑，不弹窗 -->
        <p v-if="editing && validationError" class="text-error kawaru-text-87 -mt-3 mb-4">
          {{ validationError }}
        </p>

        <!-- 统计条 -->
        <div
          class="flex flex-wrap items-center gap-x-6 gap-y-2 bg-base-100 dark:bg-slate-800
            rounded-xl shadow-sm border border-base-300 px-4 py-3 mb-6
            kawaru-text-87 text-base-content/70"
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

        <!-- 学术元数据：编辑态整卡换成表单（同一张字段表），卡片外壳不变 -->
        <CollectionMetadataPanel :metadata="detail.metadata" :draft="editing ? draft : null" />

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

    <!-- 添加成员弹窗：选择器复用 Picker（排除已在集合中的成员）。
         弹窗在 kawaru-text-100 容器之外，需自行挂 kawaru-text-100 继承流体字号基准 -->
    <dialog class="modal" :class="{ 'modal-open': addOpen }">
      <div class="modal-box max-w-2xl kawaru-text-100">
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
          <button class="btn kawaru-text-100" :disabled="adding" @click="closeAddMembers">Cancel</button>
          <button
            class="btn btn-primary kawaru-text-100"
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
import CollectionMemberList from '@/features/collections/components/CollectionMemberList.vue'
import CollectionMetadataPanel from '@/features/collections/components/CollectionMetadataPanel.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { useConfirmDelete } from '@/shared/composables/useConfirmDelete'
import { useToast } from '@/shared/composables/useToast'
import { formatBytes, formatDate } from '@/shared/utils/format'
import { listFiles } from '@/features/datasets/api/datasetApi'
import { useDatasetList } from '@/features/datasets/composables/useDatasetList'
import type { File } from '@/features/datasets/types/dataset'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { deleteCollection } from '@/features/collections/api/collectionApi'
import { useCollectionDetail } from '@/features/collections/composables/useCollectionDetail'
import { useCollectionEdit } from '@/features/collections/composables/useCollectionEdit'
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
  isStale,
  canEdit,
  fetch,
  applyDetail,
} = useCollectionDetail()

const memberOps = useCollectionMembers({ detail, refresh: fetch })
const { members, adding, removing, reordering, add } = memberOps

const memberIds = computed(() => members.value.map((m) => String(m.id)))

const updatedDate = computed(() => formatDate(detail.value?.updatedAt))

// ---- 下载（复用数据集下载链：限流 + 逐文件 iframe 触发）----
const { handleDownloadRaw } = useDownloadProgress()

function downloadMember(member: { id: number; filename: string }) {
  handleDownloadRaw(String(member.id), {
    getFallbackFilename: () => member.filename,
  })
}

// ---- 编辑元信息：页内原地编辑（Edit → 字段变输入框 → Save/Cancel）----
const { editing, draft, saving, validationError, isDirty, start, cancel, save } =
  useCollectionEdit({ detail, onSaved: applyDetail })

/** 编辑态下头部跟着草稿实时变，用户能直接看到改后的样子（空 name 回落到原值） */
const headerName = computed(() =>
  editing.value ? draft.value?.name || detail.value?.name || '' : (detail.value?.name ?? ''),
)
const headerTitle = computed(() =>
  editing.value ? (draft.value?.title ?? '') : (detail.value?.title ?? ''),
)

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
  const url = `${location.origin}/collections/${detail.value.publicId}`
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
  datasets: rawPickerDatasets,
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
  defaultFilters: { filename: '', experiment_type: 'imzML' },
})
// 后端筛选参数不含 status，completed 前端兜底过滤（与创建页一致）
const pickerDatasets = computed(() =>
  rawPickerDatasets.value.filter((d) => d.status === 'completed'),
)
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
  // 失败（409 等）时保持弹窗打开：选择仍留在 pickerSelection 里，可直接重试
  if (await add(ids)) addOpen.value = false
}
</script>

<style scoped>
/* Layout handled by Tailwind classes */
</style>
