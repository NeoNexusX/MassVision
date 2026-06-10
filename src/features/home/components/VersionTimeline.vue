<script setup lang="ts">
/**
 * 版本时间线 —— 纵向 DaisyUI timeline，展示版本迭代历程。
 * 奇偶项左右交替（different sides）。
 *
 * 数据从 config.json 的 timeline 数组读取，每个节点含 date / version / features。
 */
import type { TimelineItem } from '@/shared/config/runtimeConfig'

defineProps<{
  items: TimelineItem[]
}>()
</script>

<template>
  <ul v-if="items.length" class="timeline timeline-vertical timeline-snap-icon">
    <li v-for="(item, i) in items" :key="i">
      <hr v-if="i > 0" />
      <div class="timeline-middle">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="text-primary h-5 w-5">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
        </svg>
      </div>
      <!-- 偶数项（i=0,2,4…）：左侧日期，右侧特性；奇数项：反过来 -->
      <template v-if="i % 2 === 0">
        <div class="timeline-start">
          <span class="tl-date">{{ item.date }}</span>
          <span class="badge badge-primary badge-sm mt-0.5 text-[0.7rem]">v{{ item.version }}</span>
        </div>
        <div class="timeline-end">
          <div class="timeline-box">
            <ul class="tl-features">
              <li v-for="(feat, j) in item.features" :key="j">{{ feat }}</li>
            </ul>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="timeline-start">
          <div class="timeline-box">
            <ul class="tl-features">
              <li v-for="(feat, j) in item.features" :key="j">{{ feat }}</li>
            </ul>
          </div>
        </div>
        <div class="timeline-end">
          <span class="tl-date">{{ item.date }}</span>
          <span class="badge badge-primary badge-sm mt-0.5 text-[0.7rem]">v{{ item.version }}</span>
        </div>
      </template>
      <hr v-if="i < items.length - 1" />
    </li>
  </ul>
</template>

<style scoped>
.tl-date {
  font-size: 0.75rem;
  font-weight: 600;
  color: oklch(var(--bc) / 0.5);
  white-space: nowrap;
}
.timeline-start,
.timeline-end {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding-inline: 0.75rem;
  min-width: 4.5rem;
}
.timeline-start,
.timeline-end {
  align-items: flex-start;
  text-align: left;
}
.timeline-box {
  font-size: 0.8rem;
  line-height: 1.6;
}
.tl-features {
  list-style: disc;
  padding-left: 1rem;
}
.tl-features li {
  color: oklch(var(--bc) / 0.7);
}

/* 拉开节点间距，让时间线填满容器 */
.timeline {
  height: 100%;
}
.timeline li {
  flex: 1;
  /* 覆盖 timeline-snap-icon 的 .5rem，让 icon 纵向居中而非贴顶 */
  --timeline-row-start: minmax(0, 1fr);
}
</style>
