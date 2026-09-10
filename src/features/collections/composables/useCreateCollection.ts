import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { listFiles } from '@/features/datasets/api/datasetApi'
import { useDatasetList } from '@/features/datasets/composables/useDatasetList'
import type { File } from '@/features/datasets/types/dataset'
import { useToast } from '@/shared/composables/useToast'
import { collectionErrorMessage, createCollection } from '../api/collectionApi'
import { useOrderedSelection } from './useOrderedSelection'

/**
 * Create Collection 页装配（/collections/new）。
 *
 * 三个来源的状态：
 * 1. 选择器 —— useDatasetList 直连公开列表（listFiles(..., true) 免登录 client），
 *    固定过滤 experiment_type=imzML + status=completed（集合成员资格的服务端前置校验，
 *    规避保存时 409 invalid collection members），300ms 防抖搜索（filename 键）；
 * 2. 已选列表 —— useOrderedSelection，独立于分页/搜索的 datasets ref，
 *    跨页选择天然持久；reorder 就是移动这个数组；
 * 3. 表单 —— name/description（集合均为公开，无可见性开关）。
 *
 * 保存调 POST /collections（file_ids 顺序 = position 1..n），成功后跳转新集合的
 * overview 页。脏态离开时弹 ConfirmDialog——promise 式 onBeforeRouteLeave 守卫：
 * 确认 resolve(true) 放行，取消 resolve(false) 留在页面。
 */
export function useCreateCollection() {
  const router = useRouter()
  const { showToast } = useToast()

  // ---- 1) 选择器：可加入集合的公开 imzML 数据集（已完成上传）----
  // applyFilters 是 Object.assign 合并语义，搜索只改 filename，固定键不会被冲掉
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
    defaultFilters: {
      filename: '',
      experiment_type: 'imzML',
      status: ['completed'],
    },
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
  const form = reactive({ name: '', description: '' })

  const isDirty = computed(
    () => selectedCount.value > 0 || form.name !== '' || form.description !== '',
  )
  const canCreate = computed(() => form.name.trim() !== '' && selectedCount.value > 0)

  // ---- 4) 保存：file_ids 数组顺序 = position 1..n，成功跳转 overview ----
  const saving = ref(false)
  // 提交后的返回跳转不再触发离开确认（isDirty 此刻仍为 true）
  const saved = ref(false)

  async function submit() {
    if (!canCreate.value || saving.value) return
    saving.value = true
    try {
      const detail = await createCollection({
        name: form.name.trim(),
        description: form.description || undefined,
        file_ids: selected.value.map((d) => Number(d.id)),
      })
      showToast('Collection created successfully', 'success')
      saved.value = true
      router.replace(`/collections/${detail.id}`)
    } catch (err: any) {
      // 409 invalid collection members 等：CollectionApiError.message 是后端 detail 原文
      showToast(collectionErrorMessage(err, 'Failed to create collection'), 'error')
    } finally {
      saving.value = false
    }
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
