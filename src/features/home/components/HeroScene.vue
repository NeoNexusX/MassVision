<script setup lang="ts">
import BaseScene from './BaseScene.vue'
import ScenePlaceholder from './ScenePlaceholder.vue'
import HoverGallery from '@/shared/components/HoverGallery.vue'
import { APP_NAME } from '@/shared/config/app'
import { getConfig } from '@/shared/config/runtimeConfig'

const { taglines: HERO_TAGLINES, gallery: HERO_GALLERY = [] } = getConfig().hero

// 每个 tagline 停留 2000ms，整圈时长 = 数量 × 2000ms
const rotateDuration = `${HERO_TAGLINES.length * 2000}ms`

// 把中间的大写 X 单独拆出来，做浅蓝→深蓝渐变；没有 X 时回退为完整名称
const xIndex = APP_NAME.indexOf('X')
const namePre = xIndex >= 0 ? APP_NAME.slice(0, xIndex) : APP_NAME
const nameX = xIndex >= 0 ? APP_NAME[xIndex] : ''
const namePost = xIndex >= 0 ? APP_NAME.slice(xIndex + 1) : ''
</script>

<template>
  <BaseScene id="hero" class="bg-base-100 text-[clamp(2.5rem,12vw,15rem)]">

    <!-- #标题 -->
    <span class="leading-none text-[1em]">
      {{ namePre }}<span class="bg-gradient-to-bl 
                                to-[#1F52F5] 
                                from-[#8ca9f6] 
                                bg-clip-text 
                                text-transparent 
                                font-['Outfit',sans-serif] text-[1.2em]"
        style="font-synthesis: style">{{ nameX }}</span>{{ namePost }}
    </span>
    <!-- 滚动 -->
    <span
      class="text-rotate mt-[0.5em] text-[0.7em] leading-none"
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

    <!-- 预览图 -->
    <HoverGallery :images="HERO_GALLERY" class="mt-[0.6em]" />

    <!-- 加入按钮：渐变取自标题 X，字体与标语一致；尺寸全用 em，跟随场景字号缩放 -->
    <RouterLink
      to="/register"
      class="btn mt-[2em] h-[2.5em] gap-[0.4em] rounded-full border-none bg-gradient-to-bl from-[#8ca9f6] to-[#1F52F5] px-[1.6em] text-[max(0.22em,1rem)] font-['Outfit',sans-serif] font-bold text-white shadow-lg shadow-[#1F52F5]/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#1F52F5]/40"
    >
      Join to start
      <SvgIcon type="chevron_right" class="h-[1.1em] w-[1.1em]" />
    </RouterLink>

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
