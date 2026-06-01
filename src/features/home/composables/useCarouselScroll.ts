import { onBeforeUnmount, onMounted, ref } from 'vue'
import { prefersReducedMotion } from '@/shared/utils/motion'

/**
 * 横向卡片轮播的滚动驱动逻辑 —— 从 DeveloperCarousel 抽出的纯交互层。
 *
 * 滑动走原生 CSS scroll-snap（GPU 合成）。滚动时每张卡片按其在可视区内的
 * 可见比例缩放 + 淡入淡出：出现的卡片从小变大、消失的卡片从大变小，仿佛从
 * 虚空中浮现/隐没。计算用布局偏移（offsetLeft/Width，不受 transform 影响，
 * 避免反馈），transform 作用在内层包裹元素上（不干扰 scroll-snap 几何）。
 * scroll/resize 经 passive + rAF 节流，仅写 transform/opacity，流畅不卡。
 *
 * 关键：整张卡片的 opacity 是「均匀」变化的，无法柔化容器边缘那条竖直硬裁切线，
 * 故再叠加轨道两侧的 mask 横向渐变（CSS），在「空间上」把边缘渐隐到透明，
 * 让轮播容器的边界融入虚空、不再明显；到达两端时收起对应侧遮罩（首/末卡完整可见）。
 *
 * 返回值供模板绑定：trackRef 挂到轨道；atStart/atEnd 驱动翻页按钮显隐；
 * cols/GAP/MAX_CARD/TRACK_MAX 经内联 CSS 变量驱动单元格布局与视口封顶。
 */

// 容差，吸收 scroll-snap / 子像素取整带来的几像素偏移
const EDGE = 10
// 边缘卡片的最小缩放 / 最小不透明度（越小，卡片在边缘缩得越小、淡得越透 —— 从虚空浮现/隐没越明显）
// 与轨道两侧 mask 渐变（见组件 <style>）配合：缩放营造「从虚空浮现/隐没」，mask 柔化容器边界
const MIN_SCALE = 0.1
const MIN_OPACITY = 0
// 缩放缓动指数（>1：卡片一进入边缘虚空槽就更快地缩小，让大小变化更明显）
const EDGE_EASE = 2

// 卡片宽度区间（px）：列数取「使每张落在 MIN~MAX」的整数，单元格再均分铺满
const MIN_CARD = 170
const MAX_CARD = 340
// 同时可见的卡片数上限：无论屏幕多宽，最多并排显示 MAX_COLS 张，其余靠滑动浏览。
// 仅靠此上限还不够——超宽屏下单元格被 MAX_CARD 封顶后会空出余量、再塞进下一张，
// 故组件 CSS 还把轨道视口宽度封顶为「MAX_COLS 张满宽卡片」，二者配合才真正锁死在 5 张。
const MAX_COLS = 5
// 卡片间距（px）—— 间距的唯一来源：经内联 --gap 注入 CSS，轨道 gap 与单元格宽度计算共用此值
const GAP = 24
// 视口封顶宽度（px）：MAX_COLS 张满宽卡片 + 其间距（超宽屏多出的成员只能靠滑动浏览）
const TRACK_MAX = MAX_COLS * MAX_CARD + (MAX_COLS - 1) * GAP

export function useCarouselScroll() {
  const trackRef = ref<HTMLElement | null>(null)
  const atStart = ref(true)
  const atEnd = ref(false)
  // 当前每行列数，写入 CSS 变量 --cols 驱动单元格宽度
  const cols = ref(1)

  let rafId = 0
  let ro: ResizeObserver | null = null

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

  /**
   * 每张卡片随其在「不透明带」（视口去掉两侧虚空槽）内的可见比例缩放 / 淡入淡出，
   * 与 mask 的空间渐隐同步 —— 边缩边溶入虚空。用布局偏移（offsetLeft/Width，不受
   * transform 影响）计算以避免反馈；transform/opacity 只写在内层包裹上、不扰动 snap 几何。
   */
  const syncCardTransforms = (el: HTMLElement, cs: CSSStyleDeclaration) => {
    const reduce = prefersReducedMotion()
    const padL = parseFloat(cs.paddingLeft) || 0
    const padR = parseFloat(cs.paddingRight) || 0
    const bandLeft = el.scrollLeft + padL
    const bandRight = el.scrollLeft + el.clientWidth - padR
    for (const li of Array.from(el.children) as HTMLElement[]) {
      const inner = li.firstElementChild as HTMLElement | null
      if (!inner) continue
      if (reduce) {
        inner.style.transform = ''
        inner.style.opacity = ''
        continue
      }
      const itemLeft = li.offsetLeft
      const itemRight = itemLeft + li.offsetWidth
      const visible = Math.max(0, Math.min(itemRight, bandRight) - Math.max(itemLeft, bandLeft))
      const f = li.offsetWidth ? Math.min(1, visible / li.offsetWidth) : 1
      inner.style.transform = `scale(${(MIN_SCALE + (1 - MIN_SCALE) * f ** EDGE_EASE).toFixed(3)})`
      inner.style.opacity = (MIN_OPACITY + (1 - MIN_OPACITY) * f).toFixed(3)
    }
  }

  // scroll/resize 经 rAF 节流后调用：一次 getComputedStyle，依次同步端点 / 列数 / 卡片变换
  const update = () => {
    const el = trackRef.value
    if (!el) return
    const cs = getComputedStyle(el)
    syncEdges(el)
    syncColumns(el, cs)
    syncCardTransforms(el, cs)
  }

  const onScroll = () => {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      update()
    })
  }

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.value
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  onMounted(() => {
    update()
    trackRef.value?.addEventListener('scroll', onScroll, { passive: true })
    // ResizeObserver 同时覆盖窗口缩放，以及场景因 content-visibility 首次布局
    if (typeof ResizeObserver !== 'undefined' && trackRef.value) {
      ro = new ResizeObserver(onScroll)
      ro.observe(trackRef.value)
    } else {
      window.addEventListener('resize', onScroll, { passive: true })
    }
  })

  onBeforeUnmount(() => {
    if (rafId) cancelAnimationFrame(rafId)
    trackRef.value?.removeEventListener('scroll', onScroll)
    ro?.disconnect()
    window.removeEventListener('resize', onScroll)
  })

  return { trackRef, atStart, atEnd, cols, GAP, MAX_CARD, TRACK_MAX, scrollByPage }
}
