<script setup lang="ts">
/**
 * 悬停画廊 —— 直接使用 DaisyUI 的 `hover-gallery` 组件。
 * 首张图默认铺满展示，鼠标在区域内横向移动时切换显示对应图片。
 * 图片链接由调用方传入（见 config.json 的 hero.gallery）。
 */
defineProps<{
  /** 一组图片的 URL；按源顺序排列，首张为默认展示图 */
  images: string[]
}>()
</script>

<template>
  <figure v-if="images.length" class="hover-gallery max-w-[min(60vw,700px)]">
    <img v-for="src in images" :key="src" :src="src" alt="" loading="lazy" />
  </figure>
</template>
