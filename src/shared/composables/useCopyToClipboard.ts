import { useToast } from '@/shared/composables/useToast'
import { t } from '@/i18n'

/**
 * 复制文本到剪贴板并给出统一反馈。成功弹「已复制」toast（可覆盖文案）；失败时
 * 默认弹「复制失败」错误 toast，调用方可用 onError 改成就地兜底（如把 URL 明文
 * 弹出来供手动复制）。返回是否成功，供需要额外状态（如「已复制」高亮）的调用方使用。
 */
export function useCopyToClipboard() {
  const { showToast } = useToast()

  async function copy(
    text: string,
    opts?: { successMsg?: string; onError?: (text: string) => void },
  ): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      showToast(opts?.successMsg ?? t('common.feedback.copied'), 'success')
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      if (opts?.onError) opts.onError(text)
      else showToast(t('common.feedback.copyFailed'), 'error')
      return false
    }
  }

  return { copy }
}
