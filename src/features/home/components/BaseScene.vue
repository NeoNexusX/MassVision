<script setup lang="ts">
import { computed } from 'vue'

/**
 * 全屏场景外壳 —— 场景式滚动叙事的统一基础块。
 * 负责：满视口高度、统一留白、滚动吸附对齐、离屏渲染优化。
 */
const props = withDefaults(
  defineProps<{
    /** 渲染标签，收尾场景用 'footer' */
    as?: string
    /** 是否启用滚动吸附对齐 */
    snap?: boolean
    /** 内容纵向分布 */
    align?: 'center' | 'between' | 'start'
  }>(),
  { as: 'section', snap: true, align: 'center' },
)

const justifyClass = computed(
  () =>
    ({
      center: 'justify-center',
      between: 'justify-between',
      start: 'justify-start',
    })[props.align],
)
</script>

<template>
  <component
    :is="as"
    class="scene relative flex w-full flex-col items-center overflow-hidden px-6 py-20 sm:px-8 lg:px-12"
    :class="[justifyClass, { 'scene--snap': snap }]"
  >
    <slot />
  </component>
</template>

<style scoped>
.scene {
  min-height: 100vh; /* 回退 */
  min-height: 100svh;
  /* 离屏场景跳过渲染/布局，长页保持流畅 */
  content-visibility: auto;
  contain-intrinsic-size: auto 100svh;
}
.scene--snap {
  scroll-snap-align: start;
}
</style>
