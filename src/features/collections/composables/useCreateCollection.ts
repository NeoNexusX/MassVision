import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { listFiles } from '@/features/datasets/api/datasetApi'
import { useDatasetList } from '@/features/datasets/composables/useDatasetList'
import { createDefaultDatasetFilters } from '@/features/datasets/constants/datasetMetadata'
import type { File } from '@/features/datasets/types/dataset'
import { useAuthStore } from '@/shared/auth/authStore'
import { useToast } from '@/shared/composables/useToast'
import { addCollection } from '../data/collectionsMock'
import { useOrderedSelection } from './useOrderedSelection'

/**
 * Create Collection 页装配（/collections/new）。
 *
 * 三个来源的状态：
 * 1. 选择器 —— useDatasetList 直连 public 列表（与 useAnalysisDatasets 同模式，
 *    listFiles(..., true) 走免登录 client），300ms 防抖搜索（filename 键）；
 * 2. 已选列表 —— useOrderedSelection，独立于分页/搜索的 datasets ref，
 *    跨页选择天然持久；reorder 就是移动这个数组；
 * 3. 表单 —— name/description/isPublic（字段约束与 CollectionDialog 一致）。
 *
 * 保存写入 mock store 后回列表页（列表页 onMounted 重拉，updatedAt 倒序使新
 * 集合出现在第一页最前）。脏态离开时弹 ConfirmDialog——本页是仓库中第一个
 * onBeforeRouteLeave 用例，promise 式守卫：确认 resolve(true) 放行，取消
 * resolve(false) 留在页面。
 */
export function useCreateCollection() {
  const router = useRouter()
  const auth = useAuthStore()
  const { showToast } = useToast()

  // ---- 1) 选择器：public datasets（与 PublicDatasets 页同一套默认过滤器）----
  const {
    datasets,
    loading,
    error,
    meta,
    size,
    pagination,
    fetchFiles,
    applyFilters,
    goToPage,
    changeSize,
  } = useDatasetList((filters, page, size) => listFiles(filters, page, size, true), {
    defaultFilters: createDefaultDatasetFilters(),
  })

  const datasetQuery = ref('')

  // 防抖服务器端搜索。过滤键与数据集列表页一致用 filename（不是 name）。
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const runSearch = (query: string) => {
    applyFilters({ filename: query.trim() })
    fetchFiles({ page: 1, size: size.value }).catch(() => {})
  }
  watch(datasetQuery, (query) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => runSearch(query), 300)
  })

  // 卸载时清掉 pending 的防抖搜索，避免在已销毁页面上发请求
  onBeforeUnmount(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  })

  // ---- 2) 已选列表（选择序 = 显示序）----
  const { selected, isSelected, toggle, move, moveUp, moveDown, removeById, clear } =
    useOrderedSelection<File>()

  const selectedCount = computed(() => selected.value.length)
  const selectedOrganisms = computed(() =>
    Array.from(new Set(selected.value.map((d) => d.organism).filter(Boolean))),
  )

  // ---- 3) 表单 ----
  const form = reactive({ name: '', description: '', isPublic: true })

  const isDirty = computed(
    () =>
      selectedCount.value > 0 ||
      form.name !== '' ||
      form.description !== '' ||
      !form.isPublic,
  )
  const canCreate = computed(() => form.name.trim() !== '' && selectedCount.value > 0)

  // ---- 4) 保存 ----
  const saving = ref(false)
  // 提交后的返回跳转不再触发离开确认（isDirty 此刻仍为 true）
  const saved = ref(false)

  function submit() {
    if (!canCreate.value || saving.value) return
    saving.value = true
    addCollection(
      {
        name: form.name.trim(),
        description: form.description,
        isPublic: form.isPublic,
        datasetIds: selected.value.map((d) => d.id),
        organisms: selectedOrganisms.value as string[],
      },
      auth.user?.username || 'me',
    )
    showToast('Collection created successfully', 'success')
    saved.value = true
    router.push('/collections')
  }

  // ---- 5) 脏态离开守卫：ConfirmDialog + promise 式 onBeforeRouteLeave ----
  const showLeaveConfirm = ref(false)
  let resolveLeave: ((ok: boolean) => void) | null = null

  onBeforeRouteLeave(async () => {
    if (saved.value || !isDirty.value) return true
    showLeaveConfirm.value = true
    return new Promise<boolean>((resolve) => {
      resolveLeave = resolve
    })
  })

  function confirmLeave() {
    showLeaveConfirm.value = false
    resolveLeave?.(true)
    resolveLeave = null
  }

  function cancelLeave() {
    showLeaveConfirm.value = false
    resolveLeave?.(false)
    resolveLeave = null
  }

  onMounted(() => {
    fetchFiles().catch(() => {})
  })

  return {
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
    // 表单
    form,
    isDirty,
    canCreate,
    // 动作
    submit,
    saving,
    // 离开守卫
    showLeaveConfirm,
    confirmLeave,
    cancelLeave,
  }
}
