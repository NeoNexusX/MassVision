import { onBeforeUnmount, onMounted, ref } from 'vue'

type SceneScrollOptions = {
  sceneSelector?: string
}

// 一次平滑翻屏期间忽略后续按键，避免长按连跳多屏
const STEP_LOCK_MS = 700

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))

/**
 * 场景式滚动：滚轮 / 触摸 / 惯性交给原生滚动 + scroll-snap 就近吸附，
 * 本 composable 只负责追踪激活场景索引（驱动明暗过渡）与键盘精确翻屏。
 * 场景高度不假设等于一屏，故索引与翻屏目标均基于各 scene 的真实位置计算。
 */
export function useSceneScroll(options: SceneScrollOptions = {}) {
  const rootRef = ref<HTMLElement | null>(null)
  const activeSceneIndex = ref(0)
  const sceneCount = ref(0)
  const sceneSelector = options.sceneSelector ?? '.scene--snap'

  let scenes: HTMLElement[] = []
  let scrollRaf = 0
  let stepLocked = false
  let stepUnlockTimer: ReturnType<typeof setTimeout> | null = null
  let resizeObserver: ResizeObserver | null = null

  const syncScenes = () => {
    const root = rootRef.value
    scenes = root ? Array.from(root.querySelectorAll<HTMLElement>(sceneSelector)) : []
    sceneCount.value = scenes.length
  }

  // scene 顶部相对滚动容器内容顶端的偏移
  const sceneOffsetTop = (root: HTMLElement, scene: HTMLElement) =>
    scene.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop

  // 视口中线落入哪个 scene 即为当前激活场景（适配高度不一的场景）
  const syncActiveFromScroll = () => {
    const root = rootRef.value
    if (!root || root.clientHeight <= 0 || sceneCount.value <= 0) return
    const rootTop = root.getBoundingClientRect().top
    const mid = root.clientHeight / 2
    let active = 0
    for (let i = 0; i < scenes.length; i += 1) {
      const scene = scenes[i]
      if (scene && scene.getBoundingClientRect().top - rootTop <= mid) active = i
      else break
    }
    activeSceneIndex.value = clamp(active, 0, sceneCount.value - 1)
  }

  const scheduleActiveSync = () => {
    if (scrollRaf) return
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0
      syncActiveFromScroll()
    })
  }

  const scrollToScene = (index: number, behavior?: ScrollBehavior) => {
    const root = rootRef.value
    if (!root || sceneCount.value <= 0) return
    const nextIndex = clamp(index, 0, sceneCount.value - 1)
    const target = scenes[nextIndex]
    if (!target) return
    activeSceneIndex.value = nextIndex
    root.scrollTo({
      top: sceneOffsetTop(root, target),
      behavior: behavior ?? (prefersReducedMotion() ? 'auto' : 'smooth'),
    })
  }

  const stepScene = (direction: 1 | -1) => {
    if (stepLocked) return
    syncActiveFromScroll()
    scrollToScene(activeSceneIndex.value + direction)
    stepLocked = true
    if (stepUnlockTimer) clearTimeout(stepUnlockTimer)
    stepUnlockTimer = setTimeout(
      () => {
        stepLocked = false
      },
      prefersReducedMotion() ? 100 : STEP_LOCK_MS,
    )
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target) || sceneCount.value <= 1) return
    if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault()
      stepScene(1)
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault()
      stepScene(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      scrollToScene(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      scrollToScene(sceneCount.value - 1)
    }
  }

  // 视口高度变化（含移动端地址栏伸缩）后重新对齐到当前 scene 顶部
  const onResize = () => {
    syncScenes()
    scrollToScene(activeSceneIndex.value, 'auto')
  }

  onMounted(() => {
    const root = rootRef.value
    if (!root) return
    syncScenes()
    syncActiveFromScroll()
    root.addEventListener('scroll', scheduleActiveSync, { passive: true })
    window.addEventListener('keydown', onKeydown)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(root)
    } else {
      window.addEventListener('resize', onResize, { passive: true })
    }
  })

  onBeforeUnmount(() => {
    if (scrollRaf) cancelAnimationFrame(scrollRaf)
    if (stepUnlockTimer) clearTimeout(stepUnlockTimer)
    rootRef.value?.removeEventListener('scroll', scheduleActiveSync)
    window.removeEventListener('keydown', onKeydown)
    resizeObserver?.disconnect()
    window.removeEventListener('resize', onResize)
  })

  return { rootRef, activeSceneIndex }
}
