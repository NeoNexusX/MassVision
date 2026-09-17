import { computed, onMounted, shallowRef, ref } from 'vue'
import { useAuthStore } from '@/shared/auth/authStore'
import { collectionErrorMessage, getPublicCollection } from '../api/collectionApi'
import { isCollectionApiError } from '../types/collection'
import type { CollectionDetail } from '../types/collection'
import { t } from '@/i18n'

/**
 * Collection Overview 页的数据装配：详情拉取 + owner/admin 编辑权判定。
 * 所有成员写操作（增/删/调序）成功后通过 applyDetail() 回写这里持有的
 * detail（响应即完整 CollectionDetail），保证单一数据源。
 * 详情页无路径参数：集合 id / public_id 由 router.push 的 state 携带。
 * 详情读取走公开接口 GET /collections/public/{public_id}；公开响应不带数字 id，
 * fetch 后用 state 中的数字 id 补回，以供编辑、删除和成员管理使用。
 */
export function useCollectionDetail() {
  const auth = useAuthStore()

  const detail = shallowRef<CollectionDetail | null>(null)
  const loading = ref(false)
  const error = ref('')
  const notFound = ref(false)

  const state = history.state as { collectionId?: unknown; publicId?: unknown } | null
  const collectionId = computed(() => Number(state?.collectionId))
  const publicId = computed(() =>
    typeof state?.publicId === 'string' && state.publicId ? state.publicId : '',
  )
  const isStale = computed(() => !publicId.value || !Number.isFinite(collectionId.value))

  // 写操作仅限 owner 或 admin（与后端权限一致）
  const canEdit = computed(
    () => !!detail.value && (detail.value.ownerUsername === auth.user?.username || auth.isAdmin),
  )

  async function fetch() {
    if (isStale.value) return
    loading.value = true
    error.value = ''
    notFound.value = false
    try {
      const fetched = await getPublicCollection(publicId.value)
      detail.value = { ...fetched, id: fetched.id ?? collectionId.value }
    } catch (err: any) {
      notFound.value = isCollectionApiError(err) && err.status === 404
      error.value = collectionErrorMessage(
        err,
        t('common.feedback.loadFailed', { target: t('collections.overview.target') }),
      )
    } finally {
      loading.value = false
    }
  }

  function applyDetail(next: CollectionDetail) {
    detail.value = next
  }

  onMounted(fetch)

  return { detail, loading, error, notFound, isStale, canEdit, collectionId, fetch, applyDetail }
}
