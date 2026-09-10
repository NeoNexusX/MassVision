import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from '@/shared/composables/useToast'
import { getConfig } from '@/shared/config/runtimeConfig'
import { buildPageList } from '@/shared/utils/pagination'
import { deleteCollection, listMyCollections } from '../api/collectionApi'
import type { CollectionListMeta, CollectionSortKey, CollectionSummary } from '../types/collection'

// 每页条数与数据集列表一致，走全局 config（默认 10，选项 [6,10,20]）

/**
 * Collections 列表页装配：取数（真实 API）/ 搜索 / 排序 / 分页 / 删除。
 *
 * 后端 GET /collections 返回「我的集合」全量列表（按 updated_at 倒序，无
 * 分页/搜索/排序参数），因此这里一次拉全量后用 computed 链在本地做
 * 过滤 → 排序 → 分页；后端补上这些参数后可平滑切回服务端查询。
 * Create 走独立页面 /collections/new；Edit 内嵌在 overview 页。
 */
export function useCollectionsPage() {
  const { showToast } = useToast()

  const all = ref<CollectionSummary[]>([])
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const size = ref(getConfig().pagination.defaultPageSize || 10)
  const search = ref('')
  const sort = ref<CollectionSortKey>('updated_desc')

  async function fetchPage(targetPage = page.value) {
    loading.value = true
    error.value = ''
    try {
      all.value = await listMyCollections()
      page.value = Math.min(targetPage, meta.value.total_pages)
    } catch (err: any) {
      error.value = err?.message || 'Failed to load collections. Please try again.'
    } finally {
      loading.value = false
    }
  }

  // ---- 本地查询链：过滤 → 排序 → 分页 ----
  const filtered = computed(() => {
    const q = search.value.trim().toLowerCase()
    if (!q) return all.value
    return all.value.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || (c.title ?? '').toLowerCase().includes(q),
    )
  })

  const sorted = computed(() => {
    const arr = [...filtered.value]
    switch (sort.value) {
      case 'name_asc':
        return arr.sort((a, b) => a.name.localeCompare(b.name))
      case 'count_desc':
        return arr.sort((a, b) => b.memberCount - a.memberCount)
      default:
        // 后端默认序：updated_at 倒序（本地重排以覆盖用户删改后的状态）
        return arr.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    }
  })

  const meta = computed<CollectionListMeta>(() => ({
    current_page: page.value,
    total_pages: Math.max(1, Math.ceil(sorted.value.length / size.value)),
    total_records: sorted.value.length,
  }))

  // 搜索/换页大小导致总页数缩水时，当前页回落到最后一页
  watch(
    () => meta.value.total_pages,
    (total) => {
      if (page.value > total) page.value = total
    },
  )

  const collections = computed(() => {
    const start = (page.value - 1) * size.value
    return sorted.value.slice(start, start + size.value)
  })

  const pagination = computed(() => buildPageList(page.value, meta.value.total_pages))

  const handleSearch = (q: string) => {
    search.value = q
    page.value = 1
  }

  const clearSearch = () => handleSearch('')

  const handleSort = (key: CollectionSortKey) => {
    sort.value = key
    page.value = 1
  }

  const goToPage = (p: number) => {
    page.value = p
  }

  const changeSize = (s: number) => {
    size.value = s
    page.value = 1
  }

  /** 删除集合（不动文件）。本地移除即可，列表已是全量数据 */
  async function removeCollection(id: number) {
    await deleteCollection(id)
    all.value = all.value.filter((c) => c.id !== id)
    showToast('Collection deleted', 'success')
  }

  onMounted(() => fetchPage())

  return {
    collections,
    loading,
    error,
    meta,
    page,
    size,
    search,
    pagination,
    fetchPage,
    handleSearch,
    clearSearch,
    handleSort,
    goToPage,
    changeSize,
    removeCollection,
  }
}
