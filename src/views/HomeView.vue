<template>
  <!-- 场景式滚动叙事容器：自身为滚动根，proximity snap 就近对齐、不强制一屏 -->
  <div
    ref="rootRef"
    class="home-scroll bg-base-100 text-base-content"
    tabindex="0"
    aria-label="MassVision home scenes"
  >
    <HeroScene :class="{ 'is-active': activeSceneIndex === 0 }" />
    <FeatureScene :class="{ 'is-active': activeSceneIndex === 1 }" />
    <StatsScene :class="{ 'is-active': activeSceneIndex === 2 }" />
    <FooterScene :class="{ 'is-active': activeSceneIndex === 3 }" />
  </div>
</template>

<script setup lang="ts">
import HeroScene from '@/features/home/components/HeroScene.vue'
import FeatureScene from '@/features/home/components/FeatureScene.vue'
import StatsScene from '@/features/home/components/StatsScene.vue'
import FooterScene from '@/features/home/components/FooterScene.vue'
import { useSceneScroll } from '@/features/home/composables/useSceneScroll'

const { rootRef, activeSceneIndex } = useSceneScroll()
</script>

<style scoped>
.home-scroll {
  --scene-height: 100vh;
  height: var(--scene-height);
  overflow-y: auto;
  overflow-x: hidden;
  scroll-snap-type: y proximity;
  scroll-behavior: smooth;
  overscroll-behavior-y: contain;
  /* 横纵向平移都放行：仅 pan-y 会因祖先链取交集而禁掉内部轮播的触摸横滑；
     根自身 overflow-x:hidden，横滑手势自然落到内部 .dev-track */
  touch-action: pan-x pan-y;
}

@supports (height: 100dvh) {
  .home-scroll {
    --scene-height: 100dvh;
  }
}

.home-scroll:focus {
  outline: none;
}

:deep(.scene) {
  transition:
    opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.7s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}

:deep(.scene:not(.is-active)) {
  opacity: 0.72;
  transform: scale(0.985);
  filter: saturate(0.88);
}

@media (prefers-reduced-motion: reduce) {
  .home-scroll {
    scroll-behavior: auto;
  }

  :deep(.scene) {
    transition: none;
  }

  :deep(.scene:not(.is-active)) {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
</style>
