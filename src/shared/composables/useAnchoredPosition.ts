import { onBeforeUnmount, ref, watch, type CSSProperties, type Ref } from 'vue'

/**
 * 让 Teleport 到 body 的浮层（下拉菜单等）贴着锚点元素定位。
 *
 * 浮层脱离了原 DOM 位置，父级的 overflow / transform / 弹窗层叠都不会裁掉它，
 * 代价是位置要自己算：用 fixed + 锚点的 getBoundingClientRect。
 * 打开期间监听滚动（捕获阶段，任意祖先滚动都能收到）、窗口缩放和锚点尺寸变化
 * （如标签输入框换行变高），关闭时全部解绑。
 * 下方空间不足且上方更宽裕时向上翻转。
 */
export function useAnchoredPosition(
  anchor: Ref<HTMLElement | null>,
  open: Ref<boolean>,
  options: { gap?: number; maxHeight?: number | (() => number); width?: number } = {},
) {
  const gap = options.gap ?? 4
  // 函数形式允许按视口实时求值（如面板占视口高的比例），数字则固定
  const resolveMaxHeight = () => {
    const v = typeof options.maxHeight === 'function' ? options.maxHeight() : options.maxHeight
    return v ?? 256
  }
  // 显式宽度（如筛选面板）：不再贴合锚点，而是左缘钳制在视口内的定宽浮层；
  // 缺省沿用锚点宽度（下拉菜单语义）
  const fixedWidth = options.width

  const style = ref<CSSProperties>({})

  function update() {
    const el = anchor.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const viewportW = window.innerWidth
    const width = fixedWidth ? Math.min(fixedWidth, viewportW - 32) : rect.width
    const left = fixedWidth
      ? Math.min(Math.max(16, rect.left), viewportW - width - 16)
      : rect.left
    const maxHeight = resolveMaxHeight()
    const below = window.innerHeight - rect.bottom - gap
    const above = rect.top - gap
    const flip = below < maxHeight && above > below
    style.value = {
      position: 'fixed',
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${Math.max(0, Math.min(maxHeight, flip ? above : below))}px`,
      ...(flip
        ? { bottom: `${window.innerHeight - rect.top + gap}px` }
        : { top: `${rect.bottom + gap}px` }),
    }
  }

  let observer: ResizeObserver | null = null

  function bind() {
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    if (typeof ResizeObserver !== 'undefined' && anchor.value) {
      observer = new ResizeObserver(update)
      observer.observe(anchor.value)
    }
  }

  function unbind() {
    window.removeEventListener('scroll', update, true)
    window.removeEventListener('resize', update)
    observer?.disconnect()
    observer = null
  }

  watch(open, (isOpen) => (isOpen ? bind() : unbind()))
  onBeforeUnmount(unbind)

  return { style, update }
}
