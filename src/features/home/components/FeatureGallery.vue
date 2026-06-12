<script setup lang="ts">
/**
 * 联动画廊 + 介绍卡片 —— 上图下文，悬停联动。
 *
 * 上部画廊：图片栈 + 悬停区域，词居中于各自区域，hover 切换对应图。
 * 下部卡片：随 active 联动显示当前项的 title / desc，带过渡动画。
 */
import { computed } from 'vue'

const props = defineProps<{
  /** 画廊项：首张为默认显示；image 已由父组件合并好「自有图 / hero 回退」 */
  items: { word: string; title?: string; desc?: string; image: string }[]
}>()

/** 当前显示索引，与父组件 v-model:active 双向绑定（默认 0 = 首图） */
const active = defineModel<number>('active', { default: 0 })

/** 当前激活项 */
const activeItem = computed(() => props.items[active.value] ?? { word: '', image: '' })
</script>

<template>
  <!-- 基准字号随屏宽变化（与右侧 timeline 同一套 clamp）；内部字号全用 em 从此派生，整块等比缩放 -->
  <div class="w-full text-[clamp(0.8rem,1.1vw,2rem)]" @mouseleave="active = 0">
    <!-- 上部：画廊 -->
    <div class="relative w-full">
        <!-- 图片栈：第一张在文档流撑高，其余绝对定位叠加 -->
        <div v-if="items.length" class="relative w-full overflow-hidden rounded-2xl">
        <img
          v-for="(it, i) in items"
          :key="i"
          :src="it.image"
          alt=""
          loading="lazy"
          class="block h-auto w-full object-cover transition-opacity duration-[400ms] motion-reduce:transition-none"
          :class="[
            active === i ? 'opacity-100 z-[1]' : 'opacity-0',
            i !== 0 ? 'absolute inset-0' : '',
          ]"
        />
      </div>

      <!-- 悬停区域：覆盖画廊，等分网格 -->
      <div
        class="absolute inset-0 z-10 grid px-4"
        :style="{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }"
      >
        <!-- 每格声明为查询容器：词用 cqw 按「本格实际宽度」缩放，格窄时长单词不溢出 -->
        <div
          v-for="(it, i) in items"
          :key="i"
          class="@container grid cursor-pointer place-items-center"
          @mouseenter="active = i"
        >
          <span
            class="pointer-events-none whitespace-nowrap text-[min(20.5cqw,2.5em)] font-extrabold tracking-[0.12em] text-white opacity-70 transition-all duration-300 [text-shadow:0_2px_14px_rgba(0,0,0,0.6)] motion-reduce:transition-none"
            :class="{
              'scale-[1.15] opacity-100 [text-shadow:0_2px_14px_rgba(0,0,0,0.6),0_0_30px_rgba(255,255,255,0.4)]': active === i,
            }"
          >{{ it.word }}</span>
        </div>
      </div>
    </div>

    <!-- 下部：联动介绍卡片 -->
    <div class="pt-4">
      <Transition name="card-fade" mode="out-in">
        <div :key="active">
          <h3
            class="brand-text break-words bg-gradient-to-br from-primary to-[var(--brand-accent)] text-[3em] font-black leading-[1.1] tracking-[-0.02em]"
          >{{ activeItem.word }}</h3>
          <p v-if="activeItem.title" class="mt-4 text-[1.5em] font-semibold text-base-content">{{ activeItem.title }}</p>
          <p v-if="activeItem.desc" class="mt-4 text-justify text-[1.3em] leading-[1.5] text-base-content/60">{{ activeItem.desc }}</p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/*
 * Vue <Transition> 钩子 —— 必须保留 CSS 类名，Tailwind 无法替代。
 * 所有布局/视觉样式已迁移到模板中的 Tailwind 工具类。
 */
.card-fade-enter-active,
.card-fade-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.card-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.card-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .card-fade-enter-active,
  .card-fade-leave-active {
    transition: none;
  }
}
</style>
