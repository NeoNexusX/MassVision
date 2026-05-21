import { onMounted, onUnmounted, type Ref } from 'vue'

export function useClickOutside(
  targetRef: Ref<HTMLElement | null>,
  handler: (e: MouseEvent) => void,
  ignoreRefs?: Ref<HTMLElement | null>[],
) {
  const listener = (e: MouseEvent) => {
    const target = e.target as Node
    if (!targetRef.value?.contains(target)) {
      if (ignoreRefs?.some((r) => r.value?.contains(target))) return
      handler(e)
    }
  }

  onMounted(() => document.addEventListener('click', listener))
  onUnmounted(() => document.removeEventListener('click', listener))
}
