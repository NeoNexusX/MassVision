import { onMounted, onUnmounted, type Ref } from 'vue'

export function useClickOutside(
  // 1. Arguments
  targetRef: Ref<HTMLElement | null>,
  handler: (e: MouseEvent) => void,
  ignoreRefs?: Ref<HTMLElement | null>[],
  /**
   * 额外忽略的选择器：命中（自身或祖先）即不算 outside。
   * 用于控件内部 teleport 到 body 的浮层（如 TagInput 的词表下拉）——
   * 它们不在 targetRef 的 DOM 子树里，但交互上属于面板内部，点击不应关闭面板。
   */
  ignoreSelector?: string,
) {
  // Methods
  const listener = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!targetRef.value?.contains(target)) {
      if (ignoreRefs?.some((r) => r.value?.contains(target))) return
      if (ignoreSelector && target.closest?.(ignoreSelector)) return
      handler(e)
    }
  }

  // Lifecycle
  onMounted(() => document.addEventListener('click', listener))
  onUnmounted(() => document.removeEventListener('click', listener))
}
