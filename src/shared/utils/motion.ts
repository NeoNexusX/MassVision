/**
 * 用户是否偏好「减少动态」（无障碍设置 prefers-reduced-motion）。
 * SSR / 不支持 matchMedia 的环境下返回 false（即默认允许动画）。
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
