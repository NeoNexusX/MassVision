import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/shared/auth/authStore'
import { useToast } from '@/shared/composables/useToast'
import { getConfig } from '@/shared/config/runtimeConfig'
import { buildPageList } from '@/shared/utils/pagination'
import { fetchCollections, updateCollection } from '../data/collectionsMock'
import type { Collection, CollectionDraft, CollectionListMeta, CollectionSortKey } from '../types/collection'

// 每页条数与数据集列表一致，走全局 config（默认 10，选项 [6,10,20]）

/**
 * Collections 列表页装配：取数（mock）/ 搜索 / 排序 / 分页 / 编辑。
 * Create 已迁往独立页面 /collections/new（useCreateCollection）。
 * 后端就绪后只需替换 fetchCollections 为真实 API，页面组件无需改动。
 */
export function useCollectionsPage() {
  const auth = useAuthStore()
  const { showToast } = useToast()

  const collections = ref<Collection[]>([])
  const loading = ref(false)
  const error = ref('')
  const meta = ref<CollectionListMeta>({ current_page: 1, total_pages: 1, total_records: 0 })
  const page = ref(1)
  const size = ref(getConfig().pagination.defaultPageSize || 10)
  const search = ref('')
  const sort = ref<CollectionSortKey>('updated_desc')

  const pagination = computed(() => buildPageList(meta.value.current_page, meta.value.total_pages))

  // 所有者或管理员可编辑（决定卡片上 Edit 操作的显隐）
  const canEdit = (c: Collection) => c.owner === auth.user?.username || auth.isAdmin

  async function fetchPage(targetPage = page.value) {
    loading.value = true
    error.value = ''
    try {
      const result = await fetchCollections(
        { search: search.value, sort: sort.value, page: targetPage, size: size.value },
        auth.user?.username || '',
      )
      collections.value = result.data
      meta.value = result.meta
      page.value = result.meta.current_page
    } catch {
      error.value = 'Failed to load collections. Please try again.'
    } finally {
      loading.value = false
    }
  }

  const handleSearch = (q: string) => {
    search.value = q
    fetchPage(1)
  }

  const clearSearch = () => handleSearch('')

  const handleSort = (key: CollectionSortKey) => {
    sort.value = key
    fetchPage(1)
  }

  const goToPage = (p: number) => fetchPage(p)

  const changeSize = (s: number) => {
    size.value = s
    fetchPage(1)
  }

  function saveEdit(collection: Collection, draft: CollectionDraft) {
    updateCollection(collection.id, draft)
    showToast('Collection updated', 'success')
    fetchPage()
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
    canEdit,
    fetchPage,
    handleSearch,
    clearSearch,
    handleSort,
    goToPage,
    changeSize,
    saveEdit,
  }
}
