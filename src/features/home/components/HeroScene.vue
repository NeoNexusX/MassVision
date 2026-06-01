<script setup lang="ts">
import BaseScene from './BaseScene.vue'
import ScenePlaceholder from './ScenePlaceholder.vue'
import { APP_NAME } from '@/shared/config/app'
</script>

<template>
  <BaseScene id="hero" class="bg-base-100">
    <!-- ========= 背景视觉层（预留：WebGL / Canvas / 背景动效）========= -->
    <div class="pointer-events-none absolute inset-0" aria-hidden="true">
      <!-- TODO: Hero 背景主视觉 -->
    </div>

    <!-- ========= 内容层（预留：主标题 / 副标题 / CTA）========= -->
    <ScenePlaceholder
      as="h1"
      eyebrow="Scene 01"
      :title="APP_NAME"
      subtitle="Hero 场景预留区 · 主视觉 / 标题 / 背景动效"
    />

    <!-- 向下滚动提示 -->
    <div
      class="scroll-cue pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-base-content/30"
      aria-hidden="true"
    >
      <SvgIcon type="chevron_down" class="h-6 w-6" />
    </div>
  </BaseScene>
</template>

<style scoped>
.scroll-cue {
  animation: scroll-bounce 2s ease-in-out infinite;
}
@keyframes scroll-bounce {
  0%,
  100% {
    transform: translate(-50%, 0);
    opacity: 0.4;
  }
  50% {
    transform: translate(-50%, 8px);
    opacity: 0.9;
  }
}
@media (prefers-reduced-motion: reduce) {
  .scroll-cue {
    animation: none;
  }
}
</style>
