<script setup lang="ts">
import BaseScene from './BaseScene.vue'
import ScenePlaceholder from './ScenePlaceholder.vue'
import { APP_NAME } from '@/shared/config/app'
import { getConfig } from '@/shared/config/runtimeConfig'

const { taglines: HERO_TAGLINES, image: HERO_IMAGE } = getConfig().hero

// 每个 tagline 停留 1500ms，整圈时长 = 数量 × 1500ms
const rotateDuration = `${HERO_TAGLINES.length * 1500}ms`
</script>

<template>
  <BaseScene id="hero" class="bg-base-100 text-[clamp(2.5rem,12vw,8rem)]">
    <span class="leading-none text-[1em] ">
      {{ APP_NAME }}
    </span>

    <img
      v-if="HERO_IMAGE"
      :src="HERO_IMAGE"
      alt=""
      class="my-[0.15em] h-[0.8em] w-auto object-contain"
    />

    <span
      class="text-rotate text-[0.7em] leading-none"
      :style="{ '--duration': rotateDuration }"
    >
      <span class="justify-items-center 
                    font-bold 
                    italic 
                    font-['Outfit',sans-serif]" 
                    style="font-synthesis: style">
        <span v-for="tagline in HERO_TAGLINES" :key="tagline" class="px-2">{{ tagline }}</span>
      </span>
 </span>

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
