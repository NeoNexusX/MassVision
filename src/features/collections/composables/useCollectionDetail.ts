import { computed, onMounted, shallowRef, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/shared/auth/authStore'
import { collectionErrorMessage, getCollection } from '../api/collectionApi'
import { isCollectionApiError } from '../types/collection'
import type { CollectionDetail } from '../types/collection'

/**
 * Collection Overview 页的数据装配：详情拉取 + owner/admin 编辑权判定。
 * 所有成员写操作（增/删/调序）成功后通过 applyDetail() 回写这里持有的
 * detail（响应即完整 CollectionDetail），保证单一数据源。
 */
export function useCollectionDetail() {
  const route = useRoute()
  const auth = useAuthStore()

  const detail = shallowRef<CollectionDetail | null>(null)
  const loading = ref(false)
  const error = ref('')
  const notFound = ref(false)

  const collectionId = computed(() => Number(route.params.id))

  // 写操作仅限 owner 或 admin（与后端权限一致）
  const canEdit = computed(
    () =>
      !!detail.value &&
      (detail.value.ownerUsername === auth.user?.username || auth.isAdmin),
  )

  async function fetch() {
    if (!Number.isFinite(collectionId.value)) return
    loading.value = true
    error.value = ''
    notFound.value = false
    try {
      detail.value = await getCollection(collectionId.value)
    } catch (err: any) {
      notFound.value = isCollectionApiError(err) && err.status === 404
      error.value = collectionErrorMessage(err, 'Failed to load collection')
    } finally {
      loading.value = false
    }
  }

  function applyDetail(next: CollectionDetail) {
    detail.value = next
  }

  // 路由参数变化（如删除后跳转/直接改 URL）时重新拉取
  watch(collectionId, fetch)
  onMounted(fetch)

  return { detail, loading, error, notFound, canEdit, collectionId, fetch, applyDetail }
}
