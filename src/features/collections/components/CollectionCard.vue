<template>
  <!-- 与 DatasetCard 同构的横向卡片：左侧封面图位（当前为占位 SVG）+
       内容区（名称/简介/物种/元信息）+ 右侧固定操作列（成员数 / View Collection / Edit）。
       卡片几何（rounded-xl / shadow-sm→md / border-base-300 / 暗色 slate-800）与数据集卡片一致；
       右列 200px（数据集卡片为 160px）是因为最宽条目 "View Collection" 需要单行放下。 -->
  <div
    class="flex flex-col lg:flex-row p-4 gap-x-4 gap-y-3 h-full
      bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md
      transition-shadow duration-200 border border-base-300
      cursor-pointer"
    @click="$emit('view', collection.id)"
  >
    <!-- 左侧：封面图 + 内容 -->
    <div class="flex flex-1 min-w-0 gap-x-4">
      <!-- 封面图位：设计阶段先用数据集页的占位 SVG（随机配色），
           后端就绪后换真实封面，缺失/加载失败时回退占位 -->
      <div
        class="self-center shrink-0 w-[100px] sm:w-[120px] lg:w-[140px] aspect-square
          rounded-lg overflow-hidden border border-base-300 bg-base-200"
        aria-hidden="true"
        v-html="placeholderSvg"
      />

      <!-- 内容：名称/简介/物种/元信息 -->
      <div class="flex flex-1 min-w-0 flex-col gap-2.5">
        <!-- 名称行：集合图标 + 名称 + Public/Private 状态标签 -->
        <div class="flex items-center gap-3 min-w-0">
          <div
            class="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary
              flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <SvgIcon type="circle_stack" class="w-5 h-5" />
          </div>
          <h3
            class="flex-1 min-w-0 truncate font-bold text-[1.1em] leading-snug text-base-content
              hover:text-primary dark:hover:text-indigo-400 transition-colors"
            :title="collection.name"
            :aria-label="`Collection name: ${collection.name}`"
          >
            {{ collection.name }}
          </h3>
          <span
            v-if="collection.isPublic"
            class="badge badge-sm gap-1 font-medium border border-success/30 bg-success/10 text-success shrink-0"
          >
            <SvgIcon type="region" class="w-[0.9em] h-[0.9em]" />
            Public
          </span>
          <span
            v-else
            class="badge badge-sm gap-1 font-medium border border-base-300 bg-base-200
              text-base-content/60 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 shrink-0"
          >
            <SvgIcon type="password" class="w-[0.9em] h-[0.9em]" />
            Private
          </span>
        </div>

        <!-- 简介（1–3 行，line-clamp 截断） -->
        <p
          class="text-[0.92em] leading-relaxed text-base-content/70 line-clamp-3"
          :title="collection.description"
        >
          {{ collection.description }}
        </p>

        <!-- 物种 chips：最多 3 个，超出折叠为 “+N more”（hover 查看完整列表） -->
        <div class="flex flex-wrap items-center gap-1.5">
          <span
            v-for="organism in visibleOrganisms"
            :key="organism"
            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.78em] font-medium
              bg-base-200/80 text-base-content/70 border border-base-300
              dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
          >
            {{ organism }}
          </span>
          <span
            v-if="moreOrganisms.length"
            tabindex="0"
            class="tooltip tooltip-top inline-flex items-center rounded-full px-2.5 py-0.5
              text-[0.78em] font-semibold bg-primary/10 text-primary border border-primary/20
              cursor-help before:whitespace-pre-wrap"
            :data-tip="`Also: ${moreOrganisms.join(', ')}`"
          >
            +{{ moreOrganisms.length }} more
          </span>
        </div>

        <!-- 元信息：Owner / 更新时间 -->
        <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8em] text-base-content/60">
          <span class="inline-flex items-center gap-1 min-w-0" :title="`Owner: ${collection.owner}`">
            <SvgIcon type="user" class="w-[1.05em] h-[1.05em] shrink-0" />
            <span class="truncate">{{ collection.owner }}</span>
          </span>
          <span class="whitespace-nowrap">Updated {{ formattedDate }}</span>
        </div>
      </div>
    </div>

    <!-- 右侧：操作列。整列点击不触发卡片跳转；lg 固定 200px、左边框分隔、纵向均匀分布，
         与 DatasetCard 的操作列形态一致；移动端退化为卡片底部的横向 wrap 行 -->
    <div
      class="cursor-default
        flex flex-row flex-wrap gap-2 items-center justify-evenly
        w-full border-t border-base-300 pt-3
        lg:w-[200px] lg:flex-col lg:items-start lg:self-stretch
        lg:border-l lg:border-t-0 lg:pt-0 lg:pl-3"
      @click.stop
    >
      <!-- 成员总数 -->
      <div
        class="flex items-center gap-2 text-[1.0em] font-medium p-1 rounded text-base-content/80"
        :title="`${collection.datasetCount} datasets in this collection`"
      >
        <SvgIcon type="queue_list" class="w-[1.1em] h-[1.1em]" />
        <span><span class="font-semibold">{{ collection.datasetCount }}</span> {{ unitLabel }}</span>
      </div>

      <button
        class="flex items-center gap-2 text-[1.0em] font-medium p-1 rounded
          text-primary hover:text-primary-focus transition-colors"
        @click.stop="$emit('view', collection.id)"
      >
        <SvgIcon type="link" class="w-[1.1em] h-[1.1em]" />
        <span>View Collection</span>
      </button>

      <!-- 管理员或所有者可见 -->
      <button
        v-if="canEdit"
        class="flex items-center gap-2 text-[1.0em] font-medium p-1 rounded
          text-base-content/80 hover:text-base-content transition-colors"
        title="Edit collection"
        @click.stop="$emit('edit', collection)"
      >
        <SvgIcon type="pencil" class="w-[1.1em] h-[1.1em]" />
        <span>Edit</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Collection } from '@/features/collections/types/collection'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'

const props = defineProps<{
  collection: Collection
  canEdit?: boolean
}>()

defineEmits<{
  (e: 'view', id: string): void
  (e: 'edit', collection: Collection): void
}>()

// 封面占位：直接复用数据集页的占位 SVG（随机配色，实例创建时生成一次）
const placeholderSvg = getDatasetPlaceholderSvg()

// 卡片上最多展示 3 个物种 chip，其余收进 “+N more” 的 tooltip
const visibleOrganisms = computed(() => props.collection.organisms.slice(0, 3))
const moreOrganisms = computed(() => props.collection.organisms.slice(3))

const unitLabel = computed(() => (props.collection.datasetCount === 1 ? 'dataset' : 'datasets'))

const formattedDate = computed(() =>
  props.collection.updatedAt ? new Date(props.collection.updatedAt).toLocaleDateString() : '',
)
</script>
