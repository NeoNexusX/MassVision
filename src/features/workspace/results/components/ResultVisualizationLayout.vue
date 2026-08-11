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
  <div
    :class="[
      // Small screens
      'flex flex-col bg-base-100',
      // Desktop
      'lg:h-[100dvh] lg:overflow-hidden',
    ]"
  >
    <div
      :class="[
        // Small screens
        'mx-auto flex w-full flex-col',
        // Desktop
        'lg:h-full',
      ]"
    >
      <div
        :class="[
          // Small screens
          'flex min-h-0 flex-1 flex-col gap-4 px-3 pb-4 pt-4',
          // Medium screens
          'sm:px-6',
          // Desktop
          'lg:flex-row lg:gap-8 lg:overflow-hidden lg:px-10',
        ]"
      >
        <!-- 左列 -->
        <div
          :class="[
            // Small screens
            'w-full scrollbar-thin',
            // Desktop
            'lg:h-full lg:w-auto lg:min-h-0 lg:shrink-0 lg:self-stretch lg:overflow-y-auto',
          ]"
        >
          <slot name="left-panel"></slot>
        </div>
        <!-- 中列 -->
        <div
          :class="[
            // Small screens
            'flex min-w-0 flex-col gap-4 no-scrollbar',
            // Desktop
            'lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-y-auto',
          ]"
        >
          <div
            :class="[
              // Small screens
              'contents',
              // Desktop
              'lg:flex lg:min-h-[940px] lg:flex-1 lg:flex-col lg:gap-4',
            ]"
          >
            <slot name="viz"></slot>
          </div>
          <!-- 桌面端始终只为折叠栏保留 40px；展开内容向下溢出，不参与 viz 的 flex 高度重算。 -->
          <div
            :class="[
              // Small screens
              'contents',
              // Desktop
              'lg:block lg:h-[40px] lg:min-h-[40px] lg:shrink-0 lg:overflow-visible',
            ]"
          >
            <slot name="compare"></slot>
          </div>
        </div>
        <!-- 右列-->
        <div
          :class="[
            // Small screens
            'w-full scrollbar-thin',
            // Desktop
            'lg:w-auto lg:min-h-0 lg:shrink-0 lg:overflow-y-auto',
          ]"
        >
          <slot name="side-panel"></slot>
        </div>
      </div>
    </div>
  </div>
</template>
