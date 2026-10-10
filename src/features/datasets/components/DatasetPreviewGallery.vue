<template>
  <!-- @pointerenter 挂在外层 figure：processed 分支不需要 revealRest，但
       挂外层也能避免里层 hover-gallery 被透传事件错过（悬停热区是整图）。 -->
  <figure class="w-full h-full rounded-lg" @pointerenter="revealRest">
    <!-- Processed 数据没有离子图，只显示主图（preview.jpg），不做 hover-gallery -->
    <template v-if="storageMode === 'processed'">
      <div class="w-full h-full overflow-hidden bg-base-200">
        <img
          v-if="tic.src && !tic.error"
          :src="tic.src"
          :alt="t('datasets.card.ticPreviewAlt')"
          class="w-full h-full object-contain"
          loading="lazy"
          @error="tic.error = true"
        />
        <!-- 加载失败或 image_path 为空（预览未生成）都走占位图 -->
        <div
          v-else
          class="w-full h-full flex items-center justify-center text-base-content"
          v-html="tic.placeholder"
        />
      </div>
    </template>

    <!-- Continuous 或未知类型：hover-gallery，默认主图，左右悬停显示两张离子图。
         preview_2/3 不保证存在（仅 UMAP 生成的 continuous 文件才有），缺失或
         加载失败时该槽位回退占位图，不影响其余槽位。 -->
    <figure v-else class="hover-gallery w-full h-full rounded-lg">
      <div v-for="(img, i) in slots" :key="i" class="overflow-hidden bg-base-200">
        <img
          v-if="img.src && !img.error"
          :src="img.src"
          :alt="t('datasets.card.previewAlt', { n: i + 1 })"
          class="w-full h-full object-contain"
          loading="lazy"
          @error="img.error = true"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center text-base-content"
          v-html="img.placeholder"
        />
      </div>
    </figure>
  </figure>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { buildPreviewImageUrls } from '@/features/datasets/utils/imageUtils'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'
// 模板里直接用导入的 t（而不是 $t）：本组件的单测不安装 i18n 插件，alt 文字也无需断言
import { t } from '@/i18n'

const props = defineProps<{ imagePath: string | null; storageMode?: string }>()

interface SlotState {
  url: string | null
  src: string | null
  error: boolean
  placeholder: string
}

const buildSlots = (): SlotState[] =>
  buildPreviewImageUrls(props.imagePath).map((url, i) => ({
    url,
    // 只有第 1 张（主图）挂载时就带 src；第 2/3 张留空，等首次悬停再赋值。
    // url 为 null（image_path 空）时保持 null → 占位图，不发起图片请求。
    src: i === 0 ? url : null,
    error: false,
    placeholder: getDatasetPlaceholderSvg({ showGuides: true }),
  }))

const slots = reactive(buildSlots())
/** processed 分支只渲染主图（TIC）；槽位恒有 3 个，[0] 必存在 */
const tic = computed(() => slots[0]!)

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
  for (const img of slots) {
    if (img.url) img.src = img.url
  }
}

// imagePath 变化（同组件复用）时重建槽位并清失败态，让新 URL 重新尝试加载
watch(
  () => props.imagePath,
  () => {
    slots.splice(0, slots.length, ...buildSlots())
    revealed.value = false
  },
)
</script>
