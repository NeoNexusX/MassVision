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
 *
 * 详情页无路径参数：集合 id / public_id 由 router.push 的 state 携带
 * （与数据集 /overview 同方案），直刷/书签进入时 state 为空 → isStale，
 * 不发请求、由页面引导回列表。
 *
 * 详情读取走免登录公开接口 GET /collections/public/{public_id}
 * （认证版 GET /collections/{id} 暂不使用）。公开响应不带数字 id，
 * 而编辑/删除/成员管理等写操作仍按数字 id 走认证端点，
 * 所以 fetch 后用 state 里带来的数字 id 补回 detail.id。
 */
export function useCollectionDetail() {
  const auth = useAuthStore()

  const detail = shallowRef<CollectionDetail | null>(null)
  const loading = ref(false)
  const error = ref('')
  const notFound = ref(false)

  const state = history.state as { collectionId?: unknown; publicId?: unknown } | null
  const collectionId = computed(() => Number(state?.collectionId))
  /** 公开详情的查询键（GET /collections/public/{public_id}） */
  const publicId = computed(() =>
    typeof state?.publicId === 'string' && state.publicId ? state.publicId : '',
  )
  /** 无 state（直刷/书签）即失效：没有键可查，页面显示 Session lost */
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
      // 公开响应不带数字 id（对外只用 public_id）；写操作端点仍要数字 id，
      // 用导航 state 里的 id 补回（响应若携带则同值，覆盖无害）
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

  // 键来自 history.state（无路径参数）：进入即拉一次，之后只有显式 fetch
  onMounted(fetch)

  return { detail, loading, error, notFound, isStale, canEdit, collectionId, fetch, applyDetail }
}
