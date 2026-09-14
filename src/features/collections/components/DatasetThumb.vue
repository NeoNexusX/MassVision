<template>
  <!-- 数据集小缩略图：单张预览图，404/加载失败回退数据集占位 SVG。
       尺寸由父级 class 控制（w-10 h-10 rounded-md 等），本组件只负责填满。
       object-contain 完整显示图片（与 DatasetPreviewGallery 一致），
       非正方形图的 letterbox 区域露出 bg-base-200 底色。 -->
  <div class="w-full h-full rounded-md overflow-hidden bg-base-200 shrink-0">
    <img
      v-if="!failed"
      :src="previewUrl"
:alt="alt ?? $t('collections.thumb.defaultAlt')"
      class="w-full h-full object-contain"
      loading="lazy"
      @error="failed = true"
    />
    <div v-else class="w-full h-full text-base-content" aria-hidden="true" v-html="placeholder" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { buildPreviewImageUrl } from '@/features/datasets/utils/imageUtils'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'

const props = withDefaults(
  defineProps<{
    fileId: string
    alt?: string
  }>(),
  { alt: undefined },
)

// 随 fileId 跟随：调用方目前都用 :key 绑定 id 不会变更，但组件契约上不应缓存旧值
const previewUrl = computed(() => buildPreviewImageUrl(props.fileId))
// 占位图只生成一次（随机配色，与 DatasetPreviewGallery 的回退同策略）
const placeholder = getDatasetPlaceholderSvg({ showGuides: true })
const failed = ref(false)

// fileId 变化（同组件复用）时清掉上一张的失败态，让新 URL 重新尝试加载
watch(
  () => props.fileId,
  () => {
    failed.value = false
  },
)
</script>
