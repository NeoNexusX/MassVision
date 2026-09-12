<template>
  <!-- @pointerenter 挂在外层 figure：processed 分支不需要 revealRest，但
       挂外层也能避免里层 hover-gallery 被透传事件错过（悬停热区是整图）。 -->
  <figure class="w-full h-full rounded-lg" @pointerenter="revealRest">
    <!-- Processed 数据没有离子图，只显示 TIC（preview.jpg），不做 hover-gallery -->
    <template v-if="storageMode === 'processed'">
      <div class="w-full h-full overflow-hidden bg-base-200">
        <img
          v-if="tic.src && !tic.error"
          :src="tic.src"
          alt="TIC preview"
          class="w-full h-full object-contain"
          loading="lazy"
          @error="tic.error = true"
        />
        <div
          v-else-if="tic.error"
          class="w-full h-full flex items-center justify-center text-base-content"
          v-html="tic.placeholder"
        />
        <div v-else class="w-full h-full bg-base-200" />
      </div>
    </template>

    <!-- Continuous 或未知类型：hover-gallery，默认 TIC，左右悬停显示两张离子图 -->
    <figure v-else class="hover-gallery w-full h-full rounded-lg">
      <div v-for="(img, i) in images" :key="i" class="overflow-hidden bg-base-200">
        <img
          v-if="img.src && !img.error"
          :src="img.src"
          :alt="`Preview ${i + 1}`"
          class="w-full h-full object-contain"
          loading="lazy"
          @error="img.error = true"
        />
        <div
          v-else-if="img.error"
          class="w-full h-full flex items-center justify-center text-base-content"
          v-html="img.placeholder"
        />
        <div v-else class="w-full h-full bg-base-200" />
      </div>
    </figure>
  </figure>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { buildPreviewImageUrls } from '@/features/datasets/utils/imageUtils'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'

const props = defineProps<{ fileId: string; storageMode?: string }>()

const urls = buildPreviewImageUrls(props.fileId)
const ticUrl = urls[0]!

const tic = reactive({
  url: ticUrl,
  src: ticUrl,
  error: false,
  placeholder: getDatasetPlaceholderSvg({ showGuides: true }),
})

const images = reactive(
  urls.map((url, i) => ({
    url,
    // 只有第 1 张（TIC）挂载时就带 src；第 2/3 张留空，等首次悬停再赋值。
    src: i === 0 ? url : '',
    error: false,
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
