<script setup lang="ts">
import DeveloperCard from './DeveloperCard.vue'
import { getConfig } from '@/shared/config'
import { useCarouselScroll } from '@/features/home/composables/useCarouselScroll'

/** 团队成员来自运行时 config.json（bootstrap 已 await loadConfig，此处可安全读取）。 */
const TEAM_MEMBERS = getConfig().team

/**
 * 开发者横向轮播 —— 仅负责标记与样式；滚动驱动的端点/列数/卡片变换逻辑
 * 全部抽到 useCarouselScroll。卡片在边缘缩放淡出（JS）配合轨道两侧 mask
 * 横向渐变（CSS），令容器边界融入虚空、不出现硬裁切竖线。
 */
const { trackRef, atStart, atEnd, cols, GAP, MAX_CARD, TRACK_MAX, scrollByPage } =
  useCarouselScroll()
</script>

<template>
  <div class="dev-viewport relative mx-auto" :style="{ '--track-max': TRACK_MAX + 'px' }">
    <!-- 轨道：列数 = 容器能容纳的整数张（每张介于 MIN_CARD~MAX_CARD），由 --cols 驱动；
         两侧「虚空槽」由 .dev-track 的 padding-inline 给出（= 遮罩宽度），翻页按钮浮于其上、紧贴边缘 -->
    <ul
      ref="trackRef"
      class="dev-track no-scrollbar relative flex snap-x snap-mandatory overflow-x-auto scroll-smooth py-4"
      :style="{ '--cols': cols, '--card-max': MAX_CARD + 'px', '--gap': GAP + 'px' }"
      role="region"
      aria-label="Development team"
      tabindex="0"
    >
      <li v-for="member in TEAM_MEMBERS" :key="member.name" class="dev-cell shrink-0 snap-start">
        <!-- 内层包裹：承载缩放/淡入淡出，不影响 li 的 snap 几何 -->
        <div class="carousel-item">
          <DeveloperCard :member="member" />
        </div>
      </li>
    </ul>

    <!-- 翻页按钮：仅中大屏显示，触摸端用手势；紧贴边缘，浮于两侧虚空槽内 -->
    <button
      type="button"
      class="btn btn-circle btn-sm absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 shadow-md transition-opacity duration-300 md:inline-flex"
      :class="atStart ? 'pointer-events-none opacity-0' : 'opacity-100'"
      :aria-hidden="atStart"
      :tabindex="atStart ? -1 : 0"
      aria-label="Previous"
      @click="scrollByPage(-1)"
    >
      <SvgIcon type="chevron_right" class="h-5 w-5 rotate-180" />
    </button>
    <button
      type="button"
      class="btn btn-circle btn-sm absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 shadow-md transition-opacity duration-300 md:inline-flex"
      :class="atEnd ? 'pointer-events-none opacity-0' : 'opacity-100'"
      :aria-hidden="atEnd"
      :tabindex="atEnd ? -1 : 0"
      aria-label="Next"
      @click="scrollByPage(1)"
    >
      <SvgIcon type="chevron_right" class="h-5 w-5" />
    </button>
  </div>
</template>

<style scoped>
/* 轮播视口封顶：最多容纳 MAX_COLS 张满宽卡片（含其间距）+ 两侧渐隐槽，居中。
   超宽屏不再摊开更多卡片，多出的成员只能靠滑动浏览 —— 与 JS 的 cols 封顶共同锁死可见张数。
   --track-max = MAX_COLS 张满宽卡片含间距（由 :style 写入）；两侧渐隐槽各取 --fade-max
   （视口足够宽到触发封顶时，clamp 的 7% 必然 > --fade-max，故此处用其封顶值即与实际渐隐宽度吻合）。 */
.dev-viewport {
  --fade-max: 5rem; /* 渐隐槽封顶宽度：同时作为 .dev-track 的 --fade clamp 上限（继承） */
  max-width: calc(var(--track-max) + 2 * var(--fade-max));
}

/* 轨道两侧各留一条 =「遮罩宽度」的虚空槽（padding-inline），并在该槽内用 mask 横向渐变
   把内容在「空间上」渐隐到透明 —— 卡片在抵达容器物理边缘「之前」就已淡入虚空，
   故容器边界不再可见、也不会出现硬裁切竖线。遮罩常驻、固定在容器视口、仅作用于水平方向。
   scroll-padding-inline 同取该宽度：吸附到首/末卡时其正好落在不透明区，完整呈现、绝不被裁。 */
.dev-track {
  --fade: clamp(2rem, 7%, var(--fade-max));
  gap: var(--gap);
  padding-inline: var(--fade);
  scroll-padding-inline: var(--fade);
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 var(--fade),
    #000 calc(100% - var(--fade)),
    transparent 100%
  );
  mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 var(--fade),
    #000 calc(100% - var(--fade)),
    transparent 100%
  );
}

.dev-cell {
  /* 宽度 = (容器内容宽度 − 各间距) ÷ 列数，恰好铺满（--gap 与轨道 gap 同源）*/
  flex: 0 0 calc((100% - (var(--cols, 1) - 1) * var(--gap)) / var(--cols, 1));
  /* 硬上限兜底：ceil 列数正常时单元格本就 ≤ MAX_CARD（此处不触发、无半卡）；
     仅当离屏/首帧 cols 错算成 1 时，夹住单卡不被拉满整容器（aspect-3/4 否则会高得离谱） */
  max-width: var(--card-max, 340px);
}
.carousel-item {
  /* 作为容器，使卡片边框可用 cqi 随其宽度自适应 */
  container-type: inline-size;
  transform-origin: center center;
  will-change: transform, opacity;
}
</style>
