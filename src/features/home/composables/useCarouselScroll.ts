import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 横向卡片轮播的滚动驱动逻辑 —— 从 DeveloperCarousel 抽出的纯交互层。
 *
 * 滑动走原生 CSS scroll-snap（GPU 合成）。卡片「随可见进度缩放 + 淡入淡出」的
 * 「从虚空浮现/隐没」效果已下放到 CSS Scroll-Driven Animations（view() 时间线，
 * 见组件 <style>），由滚动位置驱动、运行在合成层，无需 JS 逐帧计算。
 * 故本文件只负责：端点状态（翻页按钮显隐）、响应式列数、自动逐张步进。
 *
 * 容器边缘再叠加轨道两侧的 mask 横向渐变（CSS），在「空间上」把边缘渐隐到透明，
 * 让轮播容器的边界融入虚空、不再明显；到达两端时收起对应侧遮罩（首/末卡完整可见）。
 *
 * 返回值供模板绑定：trackRef 挂到轨道；atStart/atEnd 驱动翻页按钮显隐；
 * cols/GAP/MAX_CARD/TRACK_MAX 经内联 CSS 变量驱动单元格布局与视口封顶。
 */

// 容差，吸收 scroll-snap / 子像素取整带来的几像素偏移
const EDGE = 10
// 卡片宽度区间（px）：列数取「使每张落在 MIN~MAX」的整数，单元格再均分铺满
const MIN_CARD = 170
// 满宽卡片上限（px）：3:4 竖卡，高 ≈ MAX_CARD×4/3，直接决定 footer 轮播这块的高度
const MAX_CARD = 340
// 同时可见的卡片数上限：无论屏幕多宽，最多并排显示 MAX_COLS 张，其余靠滑动浏览。
// 仅靠此上限还不够——超宽屏下单元格被 MAX_CARD 封顶后会空出余量、再塞进下一张，
// 故组件 CSS 还把轨道视口宽度封顶为「MAX_COLS 张满宽卡片」，二者配合才真正锁死在 5 张。
const MAX_COLS = 5
// 卡片间距（px）—— 间距的唯一来源：经内联 --gap 注入 CSS，轨道 gap 与单元格宽度计算共用此值
const GAP = 24
// 视口封顶宽度（px）：MAX_COLS 张满宽卡片 + 其间距（超宽屏多出的成员只能靠滑动浏览）
const TRACK_MAX = MAX_COLS * MAX_CARD + (MAX_COLS - 1) * GAP

export function useCarouselScroll(options?: { interval?: number; endPause?: number }) {
  /** 自动逐张步进的间隔（ms）：每隔多久平滑翻过一张卡，默认 2000；设 0 禁用 */
  const interval = options?.interval ?? 2000
  /** 滚到末尾后停留多久（ms）再平滑返回开头，默认 5000 */
  const endPause = options?.endPause ?? 5000
  const trackRef = ref<HTMLElement | null>(null)
  const atStart = ref(true)
  const atEnd = ref(false)
  // 当前每行列数，写入 CSS 变量 --cols 驱动单元格宽度
  const cols = ref(1)

  let rafId = 0
  let ro: ResizeObserver | null = null

  // 自动逐张步进的计时器；交互（hover/wheel/翻页）时清掉，离开后重启
  let autoTimer: ReturnType<typeof setInterval> | null = null

  /** 翻页按钮端点状态：是否已滚到最左 / 最右 */
  const syncEdges = (el: HTMLElement) => {
    atStart.value = el.scrollLeft <= EDGE
    atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE
  }

  /**
   * 列数 = 使每张 ≤ MAX_CARD 的最少整数张（均分后恰好铺满、绝无半卡），
   * 再保证单元格不窄于 MIN_CARD（否则减一列、宁可放大也不压拥挤），最后封顶 MAX_COLS。
   */
  const syncColumns = (el: HTMLElement, cs: CSSStyleDeclaration) => {
    // clientWidth 含 px-3 内边距，需扣除后再与 flex 的 100%（内容盒）对齐
    const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    // 离屏首帧（content-visibility）clientWidth 为 0 时跳过，避免 cols 塌成 1（由 .dev-cell max-width 兜底）
    if (avail <= 0) return
    let c = Math.max(1, Math.ceil((avail + GAP) / (MAX_CARD + GAP)))
    while (c > 1 && (avail - (c - 1) * GAP) / c < MIN_CARD) c--
    cols.value = Math.min(c, MAX_COLS)
  }

  // rAF 节流的同步。滚动只需更新端点（翻页按钮显隐）；列数仅随尺寸变化（full=true），
  // 不在滚动热路径重算 —— 省去每帧 getComputedStyle 触发的强制重排。
  // 卡片缩放/淡入淡出已由 CSS view() 时间线在合成层处理，此处不再触碰 transform/opacity。
  const sync = (full: boolean) => {
    const el = trackRef.value
    if (!el) return
    syncEdges(el)
    if (full) syncColumns(el, getComputedStyle(el))
  }
  const schedule = (full: boolean) => {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      sync(full)
    })
  }
  const onScroll = () => schedule(false)
  const onResize = () => schedule(true)

  /** 鼠标滚轮转为水平滚动：PC 端鼠标没有横向滑动手势，滚轮默认只做垂直滚动 */
  const onWheel = (e: WheelEvent) => {
    const el = trackRef.value
    if (!el) return
    const atLeftEdge = el.scrollLeft <= 0 && e.deltaY < 0
    const atRightEdge = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0
    if (atLeftEdge || atRightEdge) return
    e.preventDefault()
    el.scrollBy({ left: e.deltaY, behavior: 'auto' })
    startAutoScroll() // 滚轮交互期间复位计时（与 hover/翻页一致），停手 interval 后再自动续播
  }

  /**
   * 自动逐张步进：每隔 interval 平滑翻过一张卡（靠 DOM 的 scroll-smooth + scroll-snap
   * 自然吸附到下一张）。到末尾时本拍不翻、改回开头，并把下一拍延后 endPause —— 末尾停留。
   * 全程只用一个 setInterval，无 rAF、无中间状态。
   */
  const autoStep = () => {
    const el = trackRef.value
    if (!el) return
    // 卡片步长：首个 <li> 的 offsetWidth + 间距（响应式，实时准确）
    const firstLi = el.firstElementChild as HTMLElement | null
    const cardStep = firstLi ? firstLi.offsetWidth + GAP : MAX_CARD + GAP
    const atTail = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
    if (atTail) {
      el.scrollTo({ left: 0, behavior: 'smooth' })
      startAutoScroll(endPause) // 回到开头后多停 endPause 再继续
    } else {
      el.scrollBy({ left: cardStep, behavior: 'smooth' })
    }
  }

  const stopAutoScroll = () => {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null }
  }
  /** （重新）启动自动步进；firstDelay 为首拍前的额外等待，用于末尾停留。每次调用先清掉旧计时，可安全重入。 */
  const startAutoScroll = (firstDelay = 0) => {
    if (interval <= 0) return
    stopAutoScroll()
    autoTimer = setTimeout(() => {
      autoStep()
      autoTimer = setInterval(autoStep, interval)
    }, firstDelay + interval)
  }

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.value
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
    startAutoScroll() // 手动翻页后重置计时，避免紧接着又自动翻
  }

  // 交互期间暂停（hover/聚焦），离开后从当前位置重新计时步进
  const onResume = () => startAutoScroll()

  onMounted(() => {
    sync(true)
    trackRef.value?.addEventListener('scroll', onScroll, { passive: true })
    trackRef.value?.addEventListener('wheel', onWheel, { passive: false })
    trackRef.value?.addEventListener('mouseenter', stopAutoScroll)
    trackRef.value?.addEventListener('mouseleave', onResume)
    trackRef.value?.addEventListener('focusin', stopAutoScroll)
    trackRef.value?.addEventListener('focusout', onResume)
    // 触屏：手指按下即停，松手/取消后从当前位置重新计时（hover 在触屏上不可靠）
    trackRef.value?.addEventListener('touchstart', stopAutoScroll, { passive: true })
    trackRef.value?.addEventListener('touchend', onResume)
    trackRef.value?.addEventListener('touchcancel', onResume)
    // ResizeObserver 同时覆盖窗口缩放，以及场景因 content-visibility 首次布局
    if (typeof ResizeObserver !== 'undefined' && trackRef.value) {
      ro = new ResizeObserver(onResize)
      ro.observe(trackRef.value)
    } else {
      window.addEventListener('resize', onResize, { passive: true })
    }
    startAutoScroll()
  })

  onBeforeUnmount(() => {
    if (rafId) cancelAnimationFrame(rafId)
    stopAutoScroll()
    trackRef.value?.removeEventListener('scroll', onScroll)
    trackRef.value?.removeEventListener('wheel', onWheel)
    trackRef.value?.removeEventListener('mouseenter', stopAutoScroll)
    trackRef.value?.removeEventListener('mouseleave', onResume)
    trackRef.value?.removeEventListener('focusin', stopAutoScroll)
    trackRef.value?.removeEventListener('focusout', onResume)
    trackRef.value?.removeEventListener('touchstart', stopAutoScroll)
    trackRef.value?.removeEventListener('touchend', onResume)
    trackRef.value?.removeEventListener('touchcancel', onResume)
    ro?.disconnect()
    window.removeEventListener('resize', onResize)
  })

  return { trackRef, atStart, atEnd, cols, GAP, MAX_CARD, TRACK_MAX, scrollByPage }
}
