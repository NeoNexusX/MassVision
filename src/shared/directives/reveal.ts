import type { Directive } from 'vue'
import { prefersReducedMotion } from '@/shared/utils/motion'

/**
 * v-reveal —— 进场动画指令（基于 IntersectionObserver）。
 *
 * 元素进入视口时添加 `is-visible` 类，配合 style.css 中的 `.reveal` 过渡
 * 实现淡入 / 上移。无障碍场景（prefers-reduced-motion）或不支持
 * IntersectionObserver 时直接显示，不做动画。
 *
 * 用法：
 *   <div v-reveal>...</div>
 *   <div v-reveal="{ delay: 150 }">...</div>   // 错峰延迟（毫秒）
 *   <div v-reveal:200>...</div>                 // 简写延迟
 */
interface RevealEl extends HTMLElement {
  __revealObserver__?: IntersectionObserver
}

export const vReveal: Directive<RevealEl, { delay?: number } | undefined> = {
  mounted(el, binding) {
    el.classList.add('reveal')

    const delay = binding.value?.delay ?? (binding.arg ? Number(binding.arg) : 0)
    if (delay) el.style.transitionDelay = `${delay}ms`

    // 不支持 IO 或用户偏好减少动态 → 立即显示
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible')
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add('is-visible')
            observer.unobserve(el) // 只触发一次
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(el)
    el.__revealObserver__ = observer
  },
  unmounted(el) {
    el.__revealObserver__?.disconnect()
    delete el.__revealObserver__
  },
}
