import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAuthStore } from '@/shared/auth/authStore'
import { getConfig } from '@/shared/config/runtimeConfig'
import { buildPageList } from '@/shared/utils/pagination'
import {
  collectionErrorMessage,
  deleteCollection,
  listAllCollections,
  listCollections,
} from '../api/collectionApi'
import type { CollectionListMeta, CollectionSummary } from '../types/collection'
import { t } from '@/i18n'

// 每页条数与数据集列表一致，走全局 config（默认 10，选项 [6,10,20]）

/**
 * Collections 列表页装配：取数（服务端分页）/ 范围切换 / 搜索 / 删除。
 *
 * 数据源（均按 updated_at 倒序，服务端分页 {meta, data}）：
 * - 默认 GET /collections/all —— 公共集合（浏览全库，含他人集合）；
 * - 勾选「My collections only」后走 GET /collections —— 仅当前登录用户的集合。
 * 后端未提供集合搜索/排序参数：排序固定 updated_at 倒序（无控件），
 * search 是**本地**逻辑，只作用于当前页；后端补上参数后可挪进请求。
 * 写操作（删除）仅对 owner/admin 开放（canEdit）。Create 走独立页面 /collections/new；
 * Edit 内嵌在 overview 页。
 */
export function useCollectionsPage() {
  const auth = useAuthStore()

  // 当前页服务端数据；搜索在 collections computed 里本地派生
  const rows = ref<CollectionSummary[]>([])
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const size = ref(getConfig().pagination.defaultPageSize || 10)
  const mineOnly = ref(false)
  const search = ref('')

  const meta = reactive<CollectionListMeta>({
    current_page: 1,
    current_records: 0,
    total_pages: 1,
    total_records: 0,
  })

  // 所有者或管理员才能删除/编辑（列表含他人集合，与后端写权限一致）
  const canEdit = (c: CollectionSummary) =>
    c.ownerUsername === auth.user?.username || auth.isAdmin

  // 严格归属（不含 admin），卡片据此显示 My Collection 徽标
  const isMine = (c: CollectionSummary) =>
    !!auth.user && c.ownerUsername === auth.user.username

  async function fetchPage(targetPage = page.value) {
    loading.value = true
    error.value = ''
    try {
      const fetcher = mineOnly.value ? listCollections : listAllCollections
      const res = await fetcher(targetPage, size.value)
      rows.value = res.data
      Object.assign(meta, res.meta)
      page.value = res.meta.current_page || targetPage
    } catch (err: any) {
      error.value = collectionErrorMessage(
        err,
        t('common.feedback.loadFailed', { target: t('collections.list.target') }),
      )
    } finally {
      loading.value = false
    }
  }

  // ---- 本地过滤（仅当前页数据）----
  const collections = computed(() => {
    const q = search.value.trim().toLowerCase()
    if (!q) return rows.value
    return rows.value.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || (c.title ?? '').toLowerCase().includes(q),
    )
  })

  const pagination = computed(() => buildPageList(page.value, meta.total_pages))

  const handleSearch = (q: string) => {
    search.value = q
  }

  const clearSearch = () => handleSearch('')

  // 范围切换：回到第一页重新拉取（两个接口的数据集不同，页码不可比）
  watch(mineOnly, () => fetchPage(1))

  const goToPage = (p: number) => {
    fetchPage(p)
  }

  const changeSize = (s: number) => {
    size.value = s
    fetchPage(1)
  }

  /** 删除集合（不动文件）。成功/失败提示由调用方的 useConfirmDelete 统一负责；
   *  服务端分页下重拉当前页，尾页删尽则回落一页 */
  async function removeCollection(id: number) {
    await deleteCollection(id)
    const target = rows.value.length <= 1 && page.value > 1 ? page.value - 1 : page.value
    await fetchPage(target)
  }

  onMounted(() => fetchPage())

  return {
    collections,
    loading,
    error,
    meta,
    page,
    size,
    mineOnly,
    search,
    pagination,
    canEdit,
    isMine,
    fetchPage,
    handleSearch,
    clearSearch,
    goToPage,
    changeSize,
    removeCollection,
  }
}
