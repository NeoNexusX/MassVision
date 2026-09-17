<template>
  <!-- 集合卡片：整行三栏 —— 左封面轮播 / 中两列元信息 / 右操作列。
       封面图统一取成员文件的 OSS 预览图（目录来自后端 image_path），
       后端已按数据类型返回对应的那张（processed → TIC，continuous → UMAP），
       前端不做判断；成员超过 1 个时用左右箭头切换。
       轮播用 daisyUI carousel（帧常驻 DOM + scrollIntoView 翻页），
       只挂前 5 个成员的帧，封顶图片请求数。

       中栏两列：左列 Title / DOI / Access / Journal，右列 Organism /
       Organism Part / Ionisation Source（三个字段名恒显示，空值占位「—」）。
       每个字段最多常显 2 个值，超出的值点 More 用 popover 悬浮窗查看
       （top layer，不占卡片高度，也不会被祖先裁切）。
       卡片右侧多留一截空白（lg:pr-10），让操作列不贴边。 -->
  <div
    class="flex flex-col lg:flex-row p-4 lg:pr-10 gap-x-5 gap-y-4 h-full bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-base-300 cursor-pointer"
    @click="$emit('view', collection.id)"
  >
    <!-- 左：封面轮播 -->
    <div class="shrink-0 w-full sm:w-[340px] lg:w-[400px]">
      <div
        class="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-base-300 bg-base-200"
      >
        <!-- 封面完整显示（contain）：TIC / UMAP 都按原比例缩放进框内，不裁切。
             超宽图（TIC 条带 8500×1500）两侧会有留白，但至少内容是全的。 -->
        <!-- 封面成员仍在拉取（列表接口不带 members）：骨架占位，
             避免先闪随机占位图再换真图 -->
        <div
          v-if="coverLoading"
          class="w-full h-full animate-pulse bg-base-200 dark:bg-slate-700"
          aria-hidden="true"
        />
        <!-- daisyUI carousel，官方示例同款外观（snap-mandatory + smooth scroll +
             滚动条隐藏）。官方用 <a href="#slideN"> 翻页，直接搬会污染 history 且
             要求全页唯一 id，这里换 button + scrollIntoView。帧常驻 DOM，img 各自 lazy。 -->
        <div
          v-else-if="slideCount"
          ref="carouselEl"
          class="carousel overscroll-x-contain w-full h-full"
          role="group"
          :aria-label="$t('collections.card.coversAria', { name: collection.name })"
          @scroll.passive="onCoverScroll"
        >
          <div v-for="(imagePath, i) in slides" :key="i" class="carousel-item w-full h-full">
            <DatasetThumb :image-path="imagePath" :alt="`${collection.name} preview`" />
          </div>
        </div>
        <div
          v-else
          class="w-full h-full text-base-content"
          aria-hidden="true"
          v-html="placeholderSvg"
        />

        <!-- 箭头 + 帧计数 -->
        <template v-if="slideCount > 1">
          <button
            type="button"
            class="absolute left-1 top-1/2 -translate-y-1/2 btn btn-xs btn-circle bg-base-100/85 dark:bg-slate-800/85 border border-base-300 shadow-sm hover:bg-base-100 dark:hover:bg-slate-800 kawaru-text-68"
            :aria-label="$t('collections.card.prev')"
            @click.stop="goPrev"
          >
            <SvgIcon type="chevron_left" class="w-[1em] h-[1em]" />
          </button>
          <button
            type="button"
            class="absolute right-1 top-1/2 -translate-y-1/2 btn btn-xs btn-circle bg-base-100/85 dark:bg-slate-800/85 border border-base-300 shadow-sm hover:bg-base-100 dark:hover:bg-slate-800 kawaru-text-68"
            :aria-label="$t('collections.card.next')"
            @click.stop="goNext"
          >
            <SvgIcon type="chevron_right" class="w-[1em] h-[1em]" />
          </button>
          <span
            class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded kawaru-text-68 font-medium bg-base-100/85 dark:bg-slate-800/85 text-base-content/70 border border-base-300"
          >
            {{ scrollIndex + 1 }}/{{ slideCount }}
          </span>
        </template>
      </div>
    </div>

    <!-- 中：名称 + 两列元信息 -->
    <div class="flex flex-1 min-w-0 flex-col gap-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <div
          class="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <SvgIcon type="circle_stack" class="w-4.5 h-4.5" />
        </div>
        <h3
          class="flex-1 min-w-0 truncate font-bold kawaru-text-112 leading-snug text-base-content"
          :title="collection.name"
        >
          {{ collection.name }}
        </h3>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 min-w-0">
        <!-- 左列：Title / DOI / Access / Journal（无值统一显示 —，卡片高度对齐） -->
        <div class="flex flex-col gap-2.5 min-w-0">
          <div class="min-w-0">
            <div class="kawaru-text-75 font-medium text-base-content/45">
              {{ $t('collections.meta.title') }}
            </div>
            <p
              v-if="collection.title"
              class="mt-1 kawaru-text-95 font-medium text-base-content/85 leading-snug line-clamp-2"
              :title="collection.title"
            >
              {{ collection.title }}
            </p>
            <p v-else class="mt-1 kawaru-text-95 text-base-content/40">—</p>
          </div>

          <div class="min-w-0">
            <div class="kawaru-text-75 font-medium text-base-content/45">
              {{ $t('collections.meta.doi') }}
            </div>
            <div v-if="collection.doi.length" class="mt-1 flex flex-col gap-0.5">
              <a
                v-for="doi in collection.doi"
                :key="doi"
                :href="doiHref(doi)"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-1.5 min-w-0 kawaru-text-87 text-primary hover:underline"
                :title="doi"
                @click.stop
              >
                <SvgIcon type="link" class="w-[1em] h-[1em] shrink-0" />
                <span class="truncate">{{ doi }}</span>
              </a>
            </div>
            <p v-else class="mt-1 kawaru-text-95 text-base-content/40">—</p>
          </div>

          <!-- 后端 access 字段原样透传，可能是 URL 也可能是标签文本 -->
          <div class="min-w-0">
            <div class="kawaru-text-75 font-medium text-base-content/45">
              {{ $t('collections.meta.access') }}
            </div>
            <div v-if="collection.access" class="mt-1">
              <a
                :href="isUrl(collection.access) ? collection.access : undefined"
                :target="isUrl(collection.access) ? '_blank' : undefined"
                :rel="isUrl(collection.access) ? 'noopener noreferrer' : undefined"
                class="flex items-center gap-1.5 min-w-0 kawaru-text-87"
                :class="
                  isUrl(collection.access)
                    ? 'text-primary hover:underline'
                    : 'cursor-default text-base-content/70'
                "
                :title="collection.access"
                @click.stop
              >
                <SvgIcon type="link" class="w-[1em] h-[1em] shrink-0" />
                <span class="truncate">{{ collection.access }}</span>
              </a>
            </div>
            <p v-else class="mt-1 kawaru-text-95 text-base-content/40">—</p>
          </div>

          <div class="min-w-0">
            <div class="kawaru-text-75 font-medium text-base-content/45">
              {{ $t('collections.meta.journal') }}
            </div>
            <p
              v-if="collection.journalName"
              class="mt-1 kawaru-text-95 text-base-content/80 italic truncate"
              :title="collection.journalName"
            >
              {{ collection.journalName }}
            </p>
            <p v-else class="mt-1 kawaru-text-95 text-base-content/40">—</p>
          </div>
        </div>

        <!-- 右列：Organism / Organism Part / Ionisation Source 三个字段名恒显示，
             每个字段最多列 2 个值，超出的值收进 More 悬浮窗
             （卡片高度不随展开变化） -->
        <div class="flex flex-col gap-2.5 min-w-0">
          <div v-for="field in basicFields" :key="field.label" class="min-w-0">
            <div class="kawaru-text-75 font-medium text-base-content/45">{{ field.label }}</div>
            <div v-if="field.values.length" class="flex flex-wrap gap-1.5 mt-1">
              <span
                v-for="value in field.visibleValues"
                :key="value"
                class="inline-flex items-center rounded-full px-2.5 py-0.5 kawaru-text-75 font-medium bg-base-200/80 text-base-content/70 border border-base-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
              >
                {{ vocabLabel(value) }}
              </span>
            </div>
            <div v-else class="kawaru-text-87 text-base-content/40 mt-1">—</div>
          </div>

          <!-- More：daisyUI 5 的 popover 形态，内容进 top layer，点外部 / Esc 关闭；
               [position-try-fallbacks] 让下方放不下时自动上翻 -->
          <div v-if="overflowFields.length" class="shrink-0">
            <button
              type="button"
              :popovertarget="morePopoverId"
              :style="{ anchorName: moreAnchorName }"
              class="inline-flex items-center gap-1 kawaru-text-81 font-medium rounded text-primary hover:underline"
              :aria-label="$t('collections.card.moreAria', { name: collection.name })"
              @click.stop
            >
              {{ $t('collections.card.more', { count: hiddenValueCount }) }}
              <SvgIcon type="chevron_down" class="w-[0.9em] h-[0.9em] shrink-0" />
            </button>
            <div
              :id="morePopoverId"
              popover
              role="dialog"
              :style="{ positionAnchor: moreAnchorName }"
              class="dropdown dropdown-end dropdown-bottom w-[16em] rounded-box p-3 bg-base-100 dark:bg-slate-800 border border-base-300 shadow-lg [position-try-fallbacks:flip-block]"
              @click.stop
            >
              <div v-for="field in overflowFields" :key="field.label" class="min-w-0 [&+&]:mt-3">
                <div class="kawaru-text-75 font-medium text-base-content/45">{{ field.label }}</div>
                <div class="flex flex-wrap gap-1.5 mt-1">
                  <span
                    v-for="value in field.hiddenValues"
                    :key="value"
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 kawaru-text-75 font-medium bg-base-200/80 text-base-content/70 border border-base-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
                  >
                    {{ vocabLabel(value) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Owner / 更新时间 -->
      <div
        class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 kawaru-text-81 text-base-content/60"
      >
        <span
          class="inline-flex items-center gap-1 min-w-0"
          :title="$t('collections.card.owner', { name: collection.ownerUsername })"
        >
          <SvgIcon type="user" class="w-[1.05em] h-[1.05em] shrink-0" />
          <span class="truncate">{{ collection.ownerUsername }}</span>
        </span>
        <span class="whitespace-nowrap">{{
          $t('collections.card.updated', { date: formattedDate })
        }}</span>
      </div>
    </div>

    <!-- 右：操作列（Access 已移入中栏左列，这里不再重复）。
         列宽 10em 而非死宽 200px：本容器自挂 kawaru-text-100 钉住字号，
         10em 恒等于「档位 × 10」，换档时同步跟上。最宽条目 "View Collection"
         需单行放下，各项另加 nowrap 兜底。 -->
    <div
      class="cursor-default kawaru-text-100 flex flex-row flex-wrap gap-2 items-center justify-evenly w-full border-t border-base-300 pt-3 lg:w-[10em] lg:flex-col lg:items-start lg:self-stretch lg:border-l lg:border-t-0 lg:pt-0 lg:pl-4"
      @click.stop
    >
      <!-- 成员总数 -->
      <div
        class="flex items-center gap-2 kawaru-text-100 font-medium p-1 rounded text-base-content/80"
        :title="$t('collections.card.memberCountTitle', collection.memberCount)"
      >
        <SvgIcon type="queue_list" class="w-[1.1em] h-[1.1em]" />
        <span
          ><span class="font-semibold">{{ collection.memberCount }}</span> {{ unitLabel }}</span
        >
      </div>

      <button
        class="flex items-center gap-2 kawaru-text-100 font-medium p-1 rounded text-primary hover:text-primary-focus transition-colors"
        @click.stop="$emit('view', collection.id)"
      >
        <SvgIcon type="circle_stack" class="w-[1.1em] h-[1.1em] shrink-0" />
        <span class="whitespace-nowrap">{{ $t('collections.card.viewCollection') }}</span>
      </button>

      <!-- 列表含他人集合：仅 owner/admin 可删除 -->
      <button
        v-if="canEdit"
        class="flex items-center gap-2 kawaru-text-100 font-medium p-1 rounded text-base-content/80 hover:text-error transition-colors"
        :title="$t('collections.card.deleteTitle')"
        @click.stop="$emit('delete', collection.id)"
      >
        <SvgIcon type="trash" class="w-[1.1em] h-[1.1em] shrink-0" />
        <span class="whitespace-nowrap">{{ $t('common.action.delete') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CollectionSummary } from '@/features/collections/types/collection'
import DatasetThumb from '@/features/collections/components/DatasetThumb.vue'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'
import { formatDate } from '@/shared/utils/format'
import { vocabLabel } from '@/features/datasets/constants/vocabLabels'
import { t } from '@/i18n'

const props = defineProps<{
  collection: CollectionSummary
  /** 当前用户是 owner 或 admin（控制 Delete 显隐） */
  canEdit?: boolean
  /** 该集合成员的 imagePath（由 useCollectionCovers 逐卡补齐），决定封面轮播；只取前 5 个 */
  imagePaths?: (string | null)[]
  /** 封面成员仍在拉取（拉取期间显示骨架而非占位图） */
  coverLoading?: boolean
}>()

defineEmits<{
  (e: 'view', id: number): void
  (e: 'delete', id: number): void
}>()

// 占位图只生成一次（随机配色，与数据集页回退同策略）
const placeholderSvg = getDatasetPlaceholderSvg({ showGuides: true })

// ---- 封面轮播：一卡一帧，箭头切到下一个成员 ----
// 只挂前 5 帧：列表页预览够用，同时封顶一次加载的图片请求数
const MAX_FRAMES = 5
const slides = computed(() => (props.imagePaths ?? []).slice(0, MAX_FRAMES))
const slideCount = computed(() => slides.value.length)

// 帧常驻 DOM，游标由实际滚动位置驱动（手动滑动也同步）
const carouselEl = ref<HTMLElement | null>(null)
const scrollIndex = ref(0)

function goPrev() {
  step(-1)
}
function goNext() {
  step(1)
}
function step(delta: number) {
  if (slideCount.value < 2) return
  scrollToSlide(scrollIndex.value + delta)
}

// 翻到目标帧（负数/越界自动回绕）。inline:'start' 与 carousel-item 的
// snap-align:start 对齐；block:'nearest' 防止联动滚动整页（卡片已在视口内）
function scrollToSlide(target: number) {
  const el = carouselEl.value
  if (!el) return
  const i = ((target % slideCount.value) + slideCount.value) % slideCount.value
  scrollIndex.value = i // 计数即时反馈；回绕动画会掠过中间帧（官方 demo 同款行为）
  el.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
}

// 手动滑动（触摸/触控板）后同步计数；箭头触发的平滑滚动结束时也收敛到同一值
function onCoverScroll() {
  const el = carouselEl.value
  if (!el || !el.clientWidth) return
  const i = Math.round(el.scrollLeft / el.clientWidth)
  if (i >= 0 && i < slideCount.value) scrollIndex.value = i
}

// 列表刷新/换页后成员列表变化：把滚动位置与游标归零
watch(slides, () => {
  scrollIndex.value = 0
  carouselEl.value?.scrollTo({ left: 0 })
})

// ---- 中栏右列：三个字段名恒显示，每个字段最多列 2 个值，超出的进 More ----
/** 每个字段常显的值数量上限 */
const VISIBLE_VALUE_COUNT = 2

const basicFields = computed(() =>
  [
    { label: t('common.meta.organism'), values: props.collection.organism },
    { label: t('common.meta.organismPart'), values: props.collection.organismPart },
    { label: t('common.meta.ionisationSource'), values: props.collection.ionisationSource },
  ].map((field) => ({
    label: field.label,
    values: field.values,
    visibleValues: field.values.slice(0, VISIBLE_VALUE_COUNT),
  })),
)

/** 有值被折叠的字段（每个带上被折叠的值，供悬浮窗渲染） */
const overflowFields = computed(() =>
  basicFields.value
    .filter((field) => field.values.length > VISIBLE_VALUE_COUNT)
    .map((field) => ({
      label: field.label,
      hiddenValues: field.values.slice(VISIBLE_VALUE_COUNT),
    })),
)

/** 被折叠的值总数，显示在 More 按钮上 */
const hiddenValueCount = computed(() =>
  overflowFields.value.reduce((sum, field) => sum + field.hiddenValues.length, 0),
)

// popover 靠 id 关联触发按钮，一页多卡时需唯一
const morePopoverId = computed(() => `collection-${props.collection.id}-more-metadata`)

// 显式锚点（同样需唯一）。daisyUI 的 popover 靠浏览器的「隐式锚点」（=popovertarget
// 按钮）定位，但 :popover-open 一翻 false 隐式锚点就没了 —— 而 daisyUI 为了淡出动画
// 会在关闭后继续渲染 ~250ms，那段时间 position-area 失效，面板会掉到视口左上角
// 闪一下内容。显式 anchor-name / position-anchor 不随 open 状态丢失，位置全程不动。
const moreAnchorName = computed(() => `--collection-${props.collection.id}-more-anchor`)

// ---- DOI / Access 链接 ----
function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}
function doiHref(doi: string): string {
  const value = doi.trim().replace(
    /^(?:(?:https?:\/\/)?(?:dx\.|www\.)?doi\.org\/|doi:\s*)/i,
    '',
  )
  return isUrl(value) ? value : `https://doi.org/${value}`
}

const unitLabel = computed(() => t('collections.unit.dataset', props.collection.memberCount))

const formattedDate = computed(() => formatDate(props.collection.updatedAt))
</script>
