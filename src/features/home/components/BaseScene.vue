<script setup lang="ts">
import { computed } from 'vue'

/**
 * 场景外壳 —— 场景式滚动叙事的统一基础块。
 * 负责：至少一屏高（内容更多时自然向下撑开、绝不裁剪）、统一留白、就近滚动吸附对齐。
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
    class="scene relative flex w-full flex-col items-center px-6 sm:px-8 lg:px-16"
    :class="[justifyClass, { 'scene--snap': snap }]"
  >
    <slot />
  </component>
</template>

<style scoped>
.scene {
  /* 至少一屏高，内容更多时向下撑开（不再硬锁一屏、不裁剪） */
  min-height: var(--scene-height, 100vh);
}
.scene--snap {
  /* 就近吸附到场景顶部；不强制每屏停顿，超高场景可连续滚动 */
  scroll-snap-align: start;
}
</style>
