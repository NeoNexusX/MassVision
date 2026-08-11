import { computed, ref, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { File } from '@/features/datasets/types/dataset'
import { useToast } from '@/shared/composables/useToast'
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
      showToast('Unable to create a share link for this dataset.', 'error')
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      isShareCopied.value = true
      showToast('Public overview link copied.', 'success')
      setTimeout(() => {
        isShareCopied.value = false
      }, 2000)
    } catch (error) {
      console.error('Failed to copy share link:', error)
      showToast('Failed to copy the share link.', 'error')
    }
  }

  return {
    isShareView,
    sharedFileId,
    isShareCopied,
    shareCurrent,
  }
}
