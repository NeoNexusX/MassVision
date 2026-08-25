<template>
  <!-- DaisyUI hover-gallery：3 个直接子元素 → 自动产生 2 列悬停区域 -->
  <figure class="hover-gallery w-full h-full rounded-lg">
    <div v-for="(img, i) in images" :key="i" class="overflow-hidden bg-base-200">
      <img
        v-if="!img.error"
        :src="img.url"
        :alt="`Preview ${i + 1}`"
        class="w-full h-full object-contain"
        loading="lazy"
        @error="img.error = true"
      />
      <!-- 图片加载失败（404）时用 SVG 占位图填充 -->
      <div
        v-else
        class="w-full h-full flex items-center justify-center text-base-content"
        v-html="img.placeholder"
      />
    </div>
  </figure>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { buildPreviewImageUrls } from '@/features/datasets/utils/imageUtils'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'

const props = defineProps<{ fileId: string }>()

const images = reactive(
  buildPreviewImageUrls(props.fileId).map((url) => ({
    url,
    error: false,
    // 每格独立生成随机色占位 SVG，视觉上可区分
    placeholder: getDatasetPlaceholderSvg({ showGuides: true }),
  })),
)
</script>
