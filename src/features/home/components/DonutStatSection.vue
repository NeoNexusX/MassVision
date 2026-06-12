<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CategoryDonutChart from './CategoryDonutChart.vue'
import type { DatasetCategoryItem } from '../api/statsApi'

/**
 * 单个「分类分布环形图」区块：标题 + loading / error / empty / chart 四态 + 底部说明。
 *
 * 纯展示组件：数据三态由父级 composable 提供，本组件只负责渲染（分类分布、离子源类型分布共用）。
 * 所有尺寸用 em，相对父级设定的流式基准字号（text-[clamp(...)]）缩放——
 * 注意：控制高度的盒子（h-[…em]）不要再设 text-[…em]，否则 em 高度会跟着自身字号一起缩。
 *
 * 高度策略：本组件 grow 撑满卡片；小屏图表盒子用固定 h-[4.5em]，大屏（lg）改 flex-1
 * 填满卡片剩余空间。底部说明 <p> 显式 grow-0，抵消 DaisyUI 给 card-body 内 p 加的 flex-grow:1，
 * 避免它抢走图表的弹性空间。
 */
defineProps<{
  title: string
  /** 图表下方说明，如 '131 datasets total' */
  caption: string
  loading: boolean
  error: string | null
  isEmpty: boolean
  items: DatasetCategoryItem[]
}>()

defineEmits<{ reload: [] }>()
</script>

<template>
  <section class="flex grow flex-col min-h-0">
    <h3 class="mb-[0.3em] text-center text-[0.35em] font-semibold text-base-content">{{ title }}</h3>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex h-[4.5em] items-center justify-center lg:h-auto lg:flex-1 lg:min-h-0"
    >
      <div class="flex items-center gap-[0.5em] text-[0.22em] text-base-content/40">
        <span class="loading loading-spinner h-[1.4em] w-[1.4em]" />
        <span>Loading…</span>
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      role="alert"
      class="alert alert-error my-[0.5em] gap-[0.6em] p-[0.7em] text-[0.22em]"
    >
      <Icon icon="mdi:alert-outline" class="h-[1.4em] w-[1.4em] shrink-0" />
      <span class="flex-1">{{ error }}</span>
      <button class="btn btn-ghost btn-xs" @click="$emit('reload')">Retry</button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="isEmpty"
      class="flex h-[4.5em] items-center justify-center lg:h-auto lg:flex-1 lg:min-h-0"
    >
      <span class="text-[0.22em] text-base-content/40">No data</span>
    </div>

    <!-- Chart -->
    <template v-else>
      <div class="h-[4.5em] w-full lg:h-auto lg:flex-1 lg:min-h-0">
        <CategoryDonutChart :items="items" />
      </div>
      <p class="mt-[0.5em] grow-0 text-center text-[0.2em] text-base-content/40">{{ caption }}</p>
    </template>
  </section>
</template>
