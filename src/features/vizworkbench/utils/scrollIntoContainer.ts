/**
 * Scroll an element into view within a specific scrollable container, without
 * scrolling any ancestor containers.
 *
 * Unlike `Element.scrollIntoView()` - which scrolls **all** scrollable
 * ancestors - this only adjusts the given container's `scrollTop`. This keeps
 * the outer page layout (e.g. the main content column) put, so the user can
 * keep watching the ion image while clicking through m/z rows.
 *
 * @param position `'nearest'` (default) scrolls only when the element is out
 *   of view, by the minimum amount. `'center'` always centers the element
 *   within the container.
 */
export function scrollIntoContainer(
  el: HTMLElement,
  container: HTMLElement,
  position: 'nearest' | 'center' = 'nearest',
): void {
  const elRect = el.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()

  if (position === 'center') {
    const offset = elRect.top - containerRect.top
    container.scrollTop += offset - containerRect.height / 2 + elRect.height / 2
    return
  }

  // "nearest" behaviour: if the element is already fully visible, no scroll.
  if (elRect.top >= containerRect.top && elRect.bottom <= containerRect.bottom) return

  if (elRect.top < containerRect.top) {
    // Element is above the visible area - scroll up just enough.
    container.scrollTop -= containerRect.top - elRect.top
  } else {
    // Element is below the visible area - scroll down just enough.
    container.scrollTop += elRect.bottom - containerRect.bottom
  }
}
