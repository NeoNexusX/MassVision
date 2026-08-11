<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

/**
 * The left column height is synced to the middle column's actual content
 * height (capped at the available row height) via JS. Using flex
 * `align-self: stretch` would make the left column fill all available vertical
 * space, causing the annotation panel to "fill up" far beyond the middle
 * content when the viewport is zoomed out.
 */
const leftColumnRef = ref<HTMLElement | null>(null)
const middleContentRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null
const DESKTOP = '(min-width: 1024px)'

function syncLeftHeight() {
  const left = leftColumnRef.value
  const content = middleContentRef.value
  if (!left || !content) return
  // Mobile: layout stacks vertically, panel is fixed-positioned — leave height auto.
  if (!window.matchMedia(DESKTOP).matches) {
    left.style.height = ''
    return
  }
  const contentHeight = content.scrollHeight
  const rowHeight = left.parentElement?.clientHeight ?? contentHeight
  left.style.height = `${Math.min(contentHeight, rowHeight)}px`
}

onMounted(() => {
  if (!middleContentRef.value) return
  resizeObserver = new ResizeObserver(syncLeftHeight)
  // Observe the middle content (catches content load / layout changes) and the
  // flex row (catches viewport / zoom changes).
  resizeObserver.observe(middleContentRef.value)
  if (leftColumnRef.value?.parentElement) {
    resizeObserver.observe(leftColumnRef.value.parentElement)
  }
  nextTick(syncLeftHeight)
})

onUnmounted(() => resizeObserver?.disconnect())
</script>

<template>
  <div class="flex flex-col bg-base-100 lg:h-screen lg:overflow-hidden">
    <div class="flex flex-col max-w-[1920px] mx-auto w-full lg:h-full">
      <div class="px-10 shrink-0">
        <slot name="top-bar"></slot>
      </div>
      <div class="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 lg:gap-6 px-10 py-4 pt-2 lg:overflow-hidden">
        <div ref="leftColumnRef" class="lg:shrink-0 lg:min-h-0 lg:self-start lg:overflow-y-auto scrollbar-thin">
          <slot name="left-panel"></slot>
        </div>
        <div class="min-w-0 lg:flex-1 lg:min-h-0 lg:overflow-y-auto no-scrollbar">
          <div ref="middleContentRef" class="flex flex-col gap-4">
            <slot name="main"></slot>
          </div>
        </div>
        <div class="lg:shrink-0 lg:min-h-0 lg:overflow-y-auto scrollbar-thin">
          <slot name="side-panel"></slot>
        </div>
      </div>
    </div>
  </div>
</template>
