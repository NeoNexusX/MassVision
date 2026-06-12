import { onMounted, onUnmounted, ref } from 'vue'

/**
 * 响应式媒体查询：返回随匹配状态实时变化的 ref（窗口缩放 / 设备旋转都会更新）。
 *
 * SSR 或不支持 matchMedia 的环境下恒为 false（挂载后再读真实值），避免首屏报错。
 *
 * @example
 *   const isLarge = useMediaQuery('(min-width: 1024px)')
 */
export function useMediaQuery(query: string) {
  const matches = ref(false)
  let mql: MediaQueryList | null = null
  const onChange = (e: MediaQueryListEvent) => {
    matches.value = e.matches
  }

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    mql = window.matchMedia(query)
    matches.value = mql.matches
    mql.addEventListener('change', onChange)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', onChange)
  })

  return matches
}
