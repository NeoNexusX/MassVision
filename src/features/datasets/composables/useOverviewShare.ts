import { computed, ref, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { File } from '@/features/datasets/types/dataset'
import { useToast } from '@/shared/composables/useToast'
import { t } from '@/i18n'
import {
  buildOverviewShareUrl,
  decodeOverviewFileId,
} from '@/features/datasets/utils/overviewShareLink'

/** Route parsing, link creation, and clipboard state for public Overview sharing. */
export function useOverviewShare(dataset: Ref<File | null>) {
  const route = useRoute()
  const router = useRouter()
  const { showToast } = useToast()

  const isShareView = computed(() => route.name === 'SharedDatasetOverview')
  const sharedFileId = computed(() =>
    isShareView.value
      ? decodeOverviewFileId(String(route.params.encodedId ?? ''))
      : null,
  )
  const isShareCopied = ref(false)

  const shareCurrent = async () => {
    const current = dataset.value
    if (!current?.isPublic) return

    const shareUrl = buildOverviewShareUrl(router, current.id, window.location.origin)
    if (!shareUrl) {
      showToast(t('datasets.overview.shareUnavailable'), 'error')
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      isShareCopied.value = true
      showToast(t('common.feedback.copied'), 'success')
      setTimeout(() => {
        isShareCopied.value = false
      }, 2000)
    } catch (error) {
      console.error('Failed to copy share link:', error)
      showToast(t('common.feedback.copyFailed'), 'error')
    }
  }

  return {
    isShareView,
    sharedFileId,
    isShareCopied,
    shareCurrent,
  }
}
