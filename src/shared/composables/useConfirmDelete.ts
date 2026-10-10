/**
 * Reusable delete-confirmation flow for list pages.
 *
 * Two pages (MyDatasets, WorkspacePage) had identical delete modal + confirm
 * logic copied verbatim. This composable factors out the shared state and
 * ConfirmDialog bindings so the caller only provides the actual delete
 * function and toast message.
 */
import { reactive, ref } from 'vue'
import { useToast } from '@/shared/composables/useToast'
import { t } from '@/i18n'

export interface UseConfirmDeleteOptions {
  /** Called with the confirmed id; should return a promise. */
  onDelete: (id: string) => Promise<void>
  /** Success toast after deletion; defaults to the shared "Deleted" feedback. Pass a getter to resolve it at toast time. */
  successMessage?: string | (() => string)
}

export function useConfirmDelete(options: UseConfirmDeleteOptions) {
  const { showToast } = useToast()

  const isOpen = ref(false)
  const targetId = ref<string | null>(null)
  const deleting = ref(false)

  function open(id: string) {
    targetId.value = id
    isOpen.value = true
  }

  function cancel() {
    isOpen.value = false
    targetId.value = null
  }

  async function confirm() {
    if (!targetId.value) return
    const id = targetId.value
    isOpen.value = false
    deleting.value = true
    try {
      await options.onDelete(id)
      const msg = options.successMessage
      showToast(typeof msg === 'function' ? msg() : (msg ?? t('common.feedback.deleted')), 'success')
    } catch (err: any) {
      showToast(err?.message ?? t('common.feedback.deleteFailed'), 'error')
      console.error('Delete failed:', err)
    } finally {
      deleting.value = false
      targetId.value = null
    }
  }

  // reactive() 深度解包内部 ref：模板里 `deleteConfirm.isOpen` 拿到的是布尔值
  // 而非 Ref 对象（Ref 对象永远 truthy，会让对话框关不掉、loading 永真）。
  return reactive({ isOpen, targetId, deleting, open, cancel, confirm })
}