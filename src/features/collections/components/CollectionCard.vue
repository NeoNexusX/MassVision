<template>
  <!-- 集合卡片：整行三栏 —— 左封面轮播 / 中元数据 / 右 Access + 操作。
       封面图统一取成员文件的 OSS 预览图（images/file_{id}/preview.jpg），
       后端已按数据类型返回对应的那张（processed → TIC，continuous → UMAP），
       前端不做判断；成员超过 1 个时用左右箭头切换。 -->
  <div
    class="flex flex-col lg:flex-row p-4 gap-x-5 gap-y-4 h-full
      bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md
      transition-shadow duration-200 border border-base-300
      cursor-pointer"
    @click="$emit('view', collection.id)"
  >
    <!-- 左：封面轮播 -->
    <div class="shrink-0 w-full sm:w-[240px] lg:w-[260px]">
      <div
        class="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-base-300 bg-base-200"
      >
        <!-- 封面完整显示（contain）：TIC / UMAP 都按原比例缩放进框内，不裁切。
             超宽图（TIC 条带 8500×1500）两侧会有留白，但至少内容是全的。 -->
        <DatasetThumb
          v-if="activeFileId"
          :key="activeFileId"
          :file-id="String(activeFileId)"
          :alt="`${collection.name} preview`"
        />
        <div
          v-else
          class="w-full h-full text-base-content"
          aria-hidden="true"
          v-html="placeholderSvg"
        />

        <template v-if="slideCount > 1">
          <button
            type="button"
            class="absolute left-1 top-1/2 -translate-y-1/2 btn btn-xs btn-circle
              bg-base-100/85 dark:bg-slate-800/85 border border-base-300 shadow-sm
              hover:bg-base-100 dark:hover:bg-slate-800"
            aria-label="Previous dataset"
            @click.stop="prev"
          >
            <SvgIcon type="chevron_left" class="w-[1em] h-[1em]" />
          </button>
          <button
            type="button"
            class="absolute right-1 top-1/2 -translate-y-1/2 btn btn-xs btn-circle
              bg-base-100/85 dark:bg-slate-800/85 border border-base-300 shadow-sm
              hover:bg-base-100 dark:hover:bg-slate-800"
            aria-label="Next dataset"
            @click.stop="next"
          >
            <SvgIcon type="chevron_right" class="w-[1em] h-[1em]" />
          </button>
          <span
            class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[0.7em] font-medium
              bg-base-100/85 dark:bg-slate-800/85 text-base-content/70 border border-base-300"
          >
            {{ activeIndex + 1 }}/{{ slideCount }}
          </span>
        </template>
      </div>
    </div>

    <!-- 中：学术信息在上，基本信息在下 -->
    <div class="flex flex-1 min-w-0 flex-col gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <div
            class="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary
              flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <SvgIcon type="circle_stack" class="w-4.5 h-4.5" />
          </div>
          <h3
            class="flex-1 min-w-0 truncate font-bold text-[1.1em] leading-snug text-base-content"
            :title="collection.name"
          >
            {{ collection.name }}
          </h3>
        </div>

        <!-- 学术信息：title / doi / journal -->
        <p
          v-if="collection.title"
          class="mt-2 text-[0.98em] font-medium text-base-content/85 line-clamp-2"
          :title="collection.title"
        >
          {{ collection.title }}
        </p>
        <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85em]">
          <a
            v-for="doi in collection.doi"
            :key="doi"
            :href="doiHref(doi)"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-primary hover:underline"
            @click.stop
          >
            <SvgIcon type="link" class="w-[1em] h-[1em] shrink-0" />
            {{ doi }}
          </a>
          <span
            v-if="collection.journalName"
            class="inline-flex items-center gap-1 text-base-content/70 italic"
          >
            {{ collection.journalName }}
          </span>
        </div>
      </div>

      <!-- 基本信息：Organism / Organism Part / Ionisation Source -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 mt-auto">
        <div v-for="field in basicFields" :key="field.label" class="min-w-0">
          <div class="text-[0.78em] font-medium text-base-content/45">{{ field.label }}</div>
          <div v-if="field.values.length" class="flex flex-wrap gap-1.5 mt-1">
            <span
              v-for="value in field.values"
              :key="value"
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.78em] font-medium
                bg-base-200/80 text-base-content/70 border border-base-300
                dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
            >
              {{ value }}
            </span>
          </div>
          <div v-else class="text-[0.85em] text-base-content/40 mt-1">—</div>
        </div>
      </div>

      <!-- Owner / 更新时间 -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8em] text-base-content/60">
        <span class="inline-flex items-center gap-1 min-w-0" :title="`Owner: ${collection.ownerUsername}`">
          <SvgIcon type="user" class="w-[1.05em] h-[1.05em] shrink-0" />
          <span class="truncate">{{ collection.ownerUsername }}</span>
        </span>
        <span class="whitespace-nowrap">Updated {{ formattedDate }}</span>
      </div>
    </div>

    <!-- 右：Access 链接 + 操作列。lg 固定 200px：最宽条目 "View Collection"
         需要单行放下（比原来再窄 10px 就会折行），下面各项加 nowrap 兜底。 -->
    <div
      class="cursor-default
        flex flex-row flex-wrap gap-2 items-center justify-evenly
        w-full border-t border-base-300 pt-3
        lg:w-[200px] lg:flex-col lg:items-start lg:self-stretch
        lg:border-l lg:border-t-0 lg:pt-0 lg:pl-4"
      @click.stop
    >
      <!-- Access（后端 access 字段原样透传，可能是 URL 也可能是标签文本） -->
      <a
        v-for="entry in collection.access"
        :key="entry"
        :href="isUrl(entry) ? entry : undefined"
        :target="isUrl(entry) ? '_blank' : undefined"
        :rel="isUrl(entry) ? 'noopener noreferrer' : undefined"
        :title="entry"
        class="flex items-center gap-2 text-[1.0em] font-medium p-1 rounded
          text-primary hover:text-primary-focus transition-colors"
        :class="{ 'cursor-default no-underline': !isUrl(entry) }"
      >
        <SvgIcon type="link" class="w-[1.1em] h-[1.1em] shrink-0" />
        <span class="truncate">Access</span>
      </a>

      <!-- 成员总数 -->
      <div
        class="flex items-center gap-2 text-[1.0em] font-medium p-1 rounded text-base-content/80"
        :title="`${collection.memberCount} datasets in this collection`"
      >
        <SvgIcon type="queue_list" class="w-[1.1em] h-[1.1em]" />
        <span><span class="font-semibold">{{ collection.memberCount }}</span> {{ unitLabel }}</span>
      </div>

      <button
        class="flex items-center gap-2 text-[1.0em] font-medium p-1 rounded
          text-primary hover:text-primary-focus transition-colors"
        @click.stop="$emit('view', collection.id)"
      >
        <SvgIcon type="circle_stack" class="w-[1.1em] h-[1.1em] shrink-0" />
        <span class="whitespace-nowrap">View Collection</span>
      </button>

      <!-- 列表含他人集合：仅 owner/admin 可删除 -->
      <button
        v-if="canEdit"
        class="flex items-center gap-2 text-[1.0em] font-medium p-1 rounded
          text-base-content/80 hover:text-error transition-colors"
        title="Delete collection"
        @click.stop="$emit('delete', collection.id)"
      >
        <SvgIcon type="trash" class="w-[1.1em] h-[1.1em] shrink-0" />
        <span class="whitespace-nowrap">Delete</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CollectionSummary } from '@/features/collections/types/collection'
import DatasetThumb from '@/features/collections/components/DatasetThumb.vue'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'

const props = defineProps<{
  collection: CollectionSummary
  /** 当前用户是 owner 或 admin（控制 Delete 显隐） */
  canEdit?: boolean
  /** 该集合成员的 file_id（由 useCollectionCovers 逐卡补齐），决定封面轮播 */
  memberIds?: number[]
}>()

defineEmits<{
  (e: 'view', id: number): void
  (e: 'delete', id: number): void
}>()

// 占位图只生成一次（随机配色，与数据集页回退同策略）
const placeholderSvg = getDatasetPlaceholderSvg({ showGuides: true })

// ---- 封面轮播：一卡一张，箭头切到下一个成员 ----
const slides = computed(() => props.memberIds ?? [])
const slideCount = computed(() => slides.value.length)
const activeIndex = ref(0)
const activeFileId = computed(() => slides.value[activeIndex.value])

// 列表刷新/换页后成员可能变少，把游标夹回范围内
watch(slideCount, (n) => {
  if (activeIndex.value >= n) activeIndex.value = 0
})

function prev() {
  if (slideCount.value < 2) return
  activeIndex.value = (activeIndex.value - 1 + slideCount.value) % slideCount.value
}
function next() {
  if (slideCount.value < 2) return
  activeIndex.value = (activeIndex.value + 1) % slideCount.value
}

// ---- 中栏：基本信息 ----
const basicFields = computed(() => [
  { label: 'Organism', values: props.collection.organism },
  { label: 'Organism Part', values: props.collection.organismPart },
  { label: 'Ionisation Source', values: props.collection.ionisationSource },
])

// ---- DOI / Access：值是裸 doi 时补 https://doi.org 前缀，已是 URL 就原样用 ----
function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}
function doiHref(doi: string): string {
  return isUrl(doi) ? doi : `https://doi.org/${doi}`
}

const unitLabel = computed(() => (props.collection.memberCount === 1 ? 'dataset' : 'datasets'))

const formattedDate = computed(() =>
  props.collection.updatedAt ? new Date(props.collection.updatedAt).toLocaleDateString() : '',
)
</script>
