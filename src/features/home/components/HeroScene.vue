<script setup lang="ts">
import BaseScene from './BaseScene.vue'
import HoverGallery from '@/shared/components/HoverGallery.vue'
import { getBrandParts } from '@/shared/config/appName'
import { getContent } from '@/features/home/config/contentConfig'

const { taglines: HERO_TAGLINES, gallery: HERO_GALLERY = [] } = getContent().hero

// 每个 tagline 停留 2000ms，整圈时长 = 数量 × 2000ms
const rotateDuration = `${HERO_TAGLINES.length * 2000}ms`

// 把中间的大写 X 单独拆出来，做浅蓝→深蓝渐变；没有 X 时回退为完整名称
const { pre: namePre, x: nameX, post: namePost } = getBrandParts()
</script>

<template>
  <BaseScene
    id="hero"
    class="h-[var(--scene-height)] max-h-[var(--scene-height)] 
    overflow-hidden bg-base-100 text-[clamp(2.5rem,min(12vw,9.5vh),8rem)]"
  >
    <!-- 主内容：my-auto 在单屏 Hero 内垂直居中，矮屏时通过 Hero 基准字号整体收敛。 -->
    <div class="my-auto flex flex-col items-center">
      <!-- #标题 -->
      <span class="leading-none text-[1em] mt-[0.2em]">
        {{ namePre
        }}<span
          class="brand-text bg-gradient-to-bl from-[var(--brand-accent)] 
          to-primary font-['Outfit',sans-serif] text-[1.2em]"
          style="font-synthesis: style"
          >{{ nameX }}</span
        >{{ namePost }}
      </span>
      <!-- 滚动 -->
      <span
        class="text-rotate mt-[0.5em] text-[0.7em] leading-none mb-[0.5em]"
        :style="{ '--duration': rotateDuration }"
      >
        <span
          class="justify-items-center font-bold italic font-['Outfit',sans-serif]"
          style="font-synthesis: style"
        >
          <span v-for="tagline in HERO_TAGLINES" :key="tagline" class="px-2">{{ tagline }}</span>
        </span>
      </span>

      <!-- 预览图 -->
      <HoverGallery :images="HERO_GALLERY" class="mt-[0.5em]" />

      <!-- 按钮组：渐变取自标题 X，字体与标语一致；尺寸全用 em，跟随场景字号缩放 -->
      <div class="mt-[1em] flex flex-col items-center gap-3 sm:flex-row sm:gap-[0.5em]">
        <RouterLink
          to="/register"
          class="btn h-[2.5em] w-[min(18rem,calc(100vw-3rem))] justify-center gap-[0.5em] sm:w-auto
          rounded-full border-none bg-gradient-to-bl
          from-[var(--brand-accent)] to-primary px-[1.6em] text-[max(0.22em,1rem)]
          font-['Outfit',sans-serif] font-bold
          text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/40"
        >Join to start<SvgIcon type="chevron_right" class="h-[1.1em] w-[1.1em]" />
        </RouterLink>

        <RouterLink
          to="/datasets"
          class="btn h-[2.5em] w-[min(18rem,calc(100vw-3rem))] justify-center gap-[0.5em] sm:w-auto
          rounded-full border-none bg-gradient-to-bl
          from-[var(--brand-accent)] to-secondary px-[1.6em] text-[max(0.22em,1rem)]
          font-['Outfit',sans-serif] font-bold
          text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/40"
        >View Datasets<SvgIcon type="chevron_right" class="h-[1.1em] w-[1.1em]" />
        </RouterLink>
      </div>
    </div>

    <!-- 向下滚动提示：脱离文档流，避免继承 Hero 大字号行高后撑高场景 -->
    <div
      class="scroll-cue pointer-events-none absolute inset-x-0 bottom-1 flex justify-center leading-none text-primary"
      aria-hidden="true"
    >
      <SvgIcon type="chevron_down" class="h-[0.8em] w-[0.8em]" />
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
    transform: translateY(0);
    opacity: 0.2;
  }
  50% {
    transform: translateY(-4px);
    opacity: 0.9;
  }
}
@media (prefers-reduced-motion: reduce) {
  .scroll-cue {
    animation: none;
  }
}
</style>
