<template>
  <!-- DaisyUI hover-gallery：3 个直接子元素 → 自动产生 2 列悬停区域 -->
  <figure
    class="hover-gallery w-full h-full rounded-lg"
    @pointerenter="revealRest"
  >
    <div v-for="(img, i) in images" :key="i" class="overflow-hidden bg-base-200">
      <img
        v-if="img.src && !img.error"
        :src="img.src"
        :alt="`Preview ${i + 1}`"
        class="w-full h-full object-contain"
        loading="lazy"
        @error="img.error = true"
      />
      <!-- 图片加载失败（404）时用 SVG 占位图填充 -->
      <div
        v-else-if="img.error"
        class="w-full h-full flex items-center justify-center text-base-content"
        v-html="img.placeholder"
      />
      <!-- 尚未悬停过：不给 src，只占住格子，保持 hover-gallery 的三分栏布局 -->
      <div v-else class="w-full h-full bg-base-200" />
    </div>
  </figure>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { buildPreviewImageUrls } from '@/features/datasets/utils/imageUtils'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'

const props = defineProps<{ fileId: string }>()

const images = reactive(
  buildPreviewImageUrls(props.fileId).map((url, i) => ({
    url,
    // 只有第 1 张挂载时就带 src；第 2/3 张留空，等首次悬停再赋值。
    src: i === 0 ? url : '',
    error: false,
    // 每格独立生成随机色占位 SVG，视觉上可区分
    placeholder: getDatasetPlaceholderSvg({ showGuides: true }),
  })),
)

/**
 * hover-gallery 在未悬停时只露出第 1 张，第 2/3 张无论如何都看不见。
 * 而列表页一屏 10 张卡片 × 3 张图 = 30 个图片请求，其中 20 个是用户很可能
 * 永远不会看到的。这里推迟到首次悬停才补上 src，
 * 且 revealed 只翻一次，所以移出再移入不会重复赋值、不会重新下载。
 */
const revealed = ref(false)
const revealRest = () => {
  if (revealed.value) return
  revealed.value = true
  for (const img of images) img.src = img.url
}
</script>
