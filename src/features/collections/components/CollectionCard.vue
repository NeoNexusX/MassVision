<template>
  <!-- 集合卡片：左封面轮播 / 中（左信息容器 + 右 chips 列）/ 右操作列。
       封面图统一取成员文件的 OSS 预览图（images/file_{id}/preview.jpg），
       后端已按数据类型返回对应的那张（processed → TIC，continuous → UMAP），
       前端不做判断；成员超过 1 个时用左右箭头切换。封面下方不带缩略图条。
       轮播用 daisyUI carousel（帧常驻 DOM + scrollIntoView 翻页），
       只挂前 5 个成员的帧，封顶图片请求数。

       中栏左侧：上下两个容器整体套一个面板容器 —— 上半无背景，为名称 +
       右上角归属徽标 + Creator/Created/Updated 行；下半带浅背景，为
       Title/DOI/Access/Journal（标签左置，空值占位「—」）。description 不展示。
       面板高度贴合内容（lg 起中栏 self-start，不被拉长），上下两块紧挨着。
       中栏右侧：Organism / Organism Part / Ionisation Source chips（不展示
       关键词）。每个字段最多常显 3 个值，超出的值点 More 用 popover 悬浮窗
       查看（top layer，不占卡片高度，也不会被祖先裁切）。
       卡片右侧多留一截空白（lg:pr-10），让操作列不贴边。 -->
  <div
    class="flex flex-col lg:flex-row p-4 lg:pr-10 gap-x-5 gap-y-4 h-full bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-base-300 cursor-pointer"
    @click="$emit('view', collection.id)"
  >
    <!-- 左：封面轮播（尺寸与框体同一个元素，不再套一层纯尺寸壳）。
         lg:self-start：明确不参与拉伸，保持 4:3 的固定高度
         （lg 宽 400px → 高 300px，px 写死不受字号影响） -->
    <div
      class="shrink-0 w-full sm:w-[340px] lg:w-[400px] lg:self-start aspect-[4/3] relative rounded-lg overflow-hidden border border-base-300 bg-base-200"
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
        :aria-label="`${collection.name} covers`"
        @scroll.passive="onCoverScroll"
      >
        <div v-for="fileId in slides" :key="fileId" class="carousel-item w-full h-full">
          <DatasetThumb :file-id="String(fileId)" :alt="`${collection.name} preview`" />
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
          class="absolute left-1 top-1/2 -translate-y-1/2 btn btn-xs btn-circle bg-base-100/85 dark:bg-slate-800/85 border border-base-300 shadow-sm hover:bg-base-100 dark:hover:bg-slate-800"
          aria-label="Previous dataset"
          @click.stop="goPrev"
        >
          <SvgIcon type="chevron_left" class="w-[1em] h-[1em]" />
        </button>
        <button
          type="button"
          class="absolute right-1 top-1/2 -translate-y-1/2 btn btn-xs btn-circle bg-base-100/85 dark:bg-slate-800/85 border border-base-300 shadow-sm hover:bg-base-100 dark:hover:bg-slate-800"
          aria-label="Next dataset"
          @click.stop="goNext"
        >
          <SvgIcon type="chevron_right" class="w-[1em] h-[1em]" />
        </button>
        <span
          class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[0.7em] font-medium bg-base-100/85 dark:bg-slate-800/85 text-base-content/70 border border-base-300"
        >
          {{ scrollIndex + 1 }}/{{ slideCount }}
        </span>
      </template>
    </div>

    <!-- 中：左信息容器 + 右 chips 列（xl 起并排，更窄时上下堆叠）。
         lg 起 self-start：中栏收缩到自身内容高度，不再被拉长去填满卡片，
         中左面板底部因此不留大片空白（低于 lg 时卡片是竖排，交叉轴为横向，
         不能用 self-start，否则宽度会被压掉） -->
    <div class="flex flex-1 min-w-0 flex-col gap-4 lg:self-start xl:flex-row">
      <!-- 中左：上下两个容器，整体套一个面板容器。上半无背景（名称 + 右上角归属
           徽标 + Creator 行），下半带浅背景（Title/DOI/Access/Journal 标签左置行），
           靠背景色与分隔线区分。
           xl:self-start：面板高度只跟自己的内容走 —— 中栏横排时容器高度取
           「面板 / chips 列」的较大者，若右侧 chips 换行更多，默认 stretch 会把
           面板拉到同高，底部凭空多出一段空白。self-start 后空白移出面板边框，
           落在面板与 chips 列之间的留白里，视觉上不再是一个空盒子。
           lg:min-h-[300px]：内容不足时补到 300px，与左侧封面（lg 宽 400px × 3/4
           = 300px）底边对齐；多出来的空白留在面板底部。 -->
      <div
        class="flex-1 min-w-0 flex flex-col rounded-lg border border-base-300 overflow-hidden lg:min-h-[300px] xl:self-start"
      >
        <!-- 上：名称 + 归属徽标（右上角）+ Creator / Created / Updated，无背景。
             列表接口没有集合级公开标记，「公开」即「非本人所有」 -->
        <div class="p-3 min-w-0 flex flex-col gap-3">
          <div class="flex items-start justify-between gap-2.5 min-w-0">
            <h3
              class="flex-1 min-w-0 truncate font-bold text-[1.4em] leading-snug text-base-content"
              :title="collection.name"
            >
              {{ collection.name }}
            </h3>
            <span
              class="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72em] font-medium border"
              :class="ownershipBadge.class"
            >
              <SvgIcon type="circle_stack" class="w-[0.95em] h-[0.95em]" />
              {{ ownershipBadge.label }}
            </span>
          </div>

          <div
            class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8em] text-base-content/75"
          >
            <span
              class="inline-flex items-center gap-1 min-w-0"
              :title="`Owner: ${collection.ownerUsername}`"
            >
              <span class="text-base-content/45">Creator</span>
              <SvgIcon type="user" class="w-[1.05em] h-[1.05em] shrink-0 text-base-content/60" />
              <span class="truncate font-medium">{{ collection.ownerUsername }}</span>
            </span>
            <span class="whitespace-nowrap">
              <span class="text-base-content/45">Created</span> {{ formattedCreated }}
            </span>
            <span class="whitespace-nowrap">
              <span class="text-base-content/45">Updated</span> {{ formattedDate }}
            </span>
          </div>
        </div>

        <!-- 下：Title / DOI / Access / Journal 标签左置行（浅背景，与上半区分开）。
             grow：吃掉面板补高后多出的空间，让底色一直铺到面板底边 -->
        <div
          class="grow border-t border-base-300 bg-base-200/40 dark:bg-slate-700/40 p-3 flex flex-col gap-3"
        >
          <div class="flex items-baseline gap-2 min-w-0">
            <span class="w-[4.6em] shrink-0 text-[0.78em] font-medium text-base-content/45"
              >Title</span
            >
            <p
              v-if="collection.title"
              class="flex-1 min-w-0 truncate text-[0.9em] text-base-content/80"
              :title="collection.title"
            >
              {{ collection.title }}
            </p>
            <span v-else class="text-[0.9em] text-base-content/40">—</span>
          </div>

          <div class="flex items-baseline gap-2 min-w-0">
            <span class="w-[4.6em] shrink-0 text-[0.78em] font-medium text-base-content/45"
              >DOI</span
            >
            <div v-if="collection.doi.length" class="flex-1 min-w-0 flex flex-col gap-0.5">
              <a
                v-for="doi in collection.doi"
                :key="doi"
                :href="doiHref(doi)"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-1.5 min-w-0 text-[0.9em] text-primary hover:underline"
                :title="doi"
                @click.stop
              >
                <SvgIcon type="link" class="w-[1em] h-[1em] shrink-0" />
                <span class="truncate">{{ doi }}</span>
              </a>
            </div>
            <span v-else class="text-[0.9em] text-base-content/40">—</span>
          </div>

          <!-- 后端 access 字段原样透传，可能是 URL 也可能是标签文本 -->
          <div class="flex items-baseline gap-2 min-w-0">
            <span class="w-[4.6em] shrink-0 text-[0.78em] font-medium text-base-content/45"
              >Access</span
            >
            <div v-if="collection.access.length" class="flex-1 min-w-0 flex flex-col gap-0.5">
              <a
                v-for="entry in collection.access"
                :key="entry"
                :href="isUrl(entry) ? entry : undefined"
                :target="isUrl(entry) ? '_blank' : undefined"
                :rel="isUrl(entry) ? 'noopener noreferrer' : undefined"
                class="flex items-center gap-1.5 min-w-0 text-[0.9em]"
                :class="
                  isUrl(entry)
                    ? 'text-primary hover:underline'
                    : 'cursor-default text-base-content/70'
                "
                :title="entry"
                @click.stop
              >
                <SvgIcon type="link" class="w-[1em] h-[1em] shrink-0" />
                <span class="truncate">{{ entry }}</span>
              </a>
            </div>
            <span v-else class="text-[0.9em] text-base-content/40">—</span>
          </div>

          <div class="flex items-baseline gap-2 min-w-0">
            <span class="w-[4.6em] shrink-0 text-[0.78em] font-medium text-base-content/45"
              >Journal</span
            >
            <p
              v-if="collection.journalName"
              class="flex-1 min-w-0 truncate text-[0.9em] text-base-content/80 italic"
              :title="collection.journalName"
            >
              {{ collection.journalName }}
            </p>
            <span v-else class="text-[0.9em] text-base-content/40">—</span>
          </div>
        </div>
      </div>

      <!-- 中右：Organism / Organism Part / Ionisation Source 三个字段名恒显示（不含关键词），
           每个字段最多列 3 个值，超出的值收进 More 悬浮窗（卡片高度不随展开变化） -->
      <div class="xl:w-[17em] shrink-0 flex flex-col gap-2.5 min-w-0">
        <div v-for="field in basicFields" :key="field.label" class="min-w-0">
          <div class="text-[0.78em] font-medium text-base-content/45">{{ field.label }}</div>
          <div v-if="field.values.length" class="flex flex-wrap gap-1.5 mt-1">
            <span
              v-for="value in field.visibleValues"
              :key="value"
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.78em] font-medium bg-base-200/80 text-base-content/70 border border-base-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
            >
              {{ value }}
            </span>
          </div>
          <div v-else class="text-[0.9em] text-base-content/40 mt-1">—</div>
        </div>

        <!-- More：daisyUI 5 的 popover 形态，内容进 top layer，点外部 / Esc 关闭；
             [position-try-fallbacks] 让下方放不下时自动上翻 -->
        <div v-if="overflowFields.length" class="shrink-0">
          <button
            type="button"
            :popovertarget="morePopoverId"
            :style="{ anchorName: moreAnchorName }"
            class="inline-flex items-center gap-1 text-[0.82em] font-medium rounded text-primary hover:underline"
            :aria-label="`More metadata for ${collection.name}`"
            @click.stop
          >
            More (+{{ hiddenValueCount }})
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
              <div class="text-[0.78em] font-medium text-base-content/45">{{ field.label }}</div>
              <div class="flex flex-wrap gap-1.5 mt-1">
                <span
                  v-for="value in field.hiddenValues"
                  :key="value"
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.78em] font-medium bg-base-200/80 text-base-content/70 border border-base-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
                >
                  {{ value }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右：成员数 + View / Share / Delete（Share 需 publicId，Delete 仅 owner/admin）。
         lg 固定 11.5em：最宽条目 "View Collection" 需要单行放下，em 随页面流式字号缩放。 -->
    <div
      class="cursor-default flex flex-row flex-wrap gap-2 items-center w-full border-t border-base-300 pt-3 lg:w-[11.5em] lg:flex-col lg:items-stretch lg:self-stretch lg:border-l lg:border-t-0 lg:pt-0 lg:pl-4"
      @click.stop
    >
      <!-- 成员总数（lg 下在列内居中，与小单位文字垂直居中） -->
      <div
        class="flex items-center justify-center gap-2 px-1 text-base-content/70 lg:w-full"
        :title="`${collection.memberCount} datasets in this collection`"
      >
        <SvgIcon type="queue_list" class="w-[1.6em] h-[1.6em] shrink-0" />
        <span class="text-[1.85em] font-bold leading-none text-primary">{{
          collection.memberCount
        }}</span>
        <span class="text-[1.1em]">{{ unitLabel }}</span>
      </div>

      <!-- 操作按钮组：lg 下 my-auto 在剩余空间里垂直居中（不贴底） -->
      <div
        class="flex flex-row flex-wrap items-center gap-2 w-full lg:my-auto lg:flex-col lg:items-stretch"
      >
        <button
          class="btn btn-primary text-[0.9em] h-[2.3em] min-h-[2.3em] grow lg:grow-0 lg:w-full"
          @click.stop="$emit('view', collection.id)"
        >
          <span class="whitespace-nowrap">View Collection</span>
          <SvgIcon type="chevron_right" class="w-[1em] h-[1em] shrink-0" />
        </button>

        <!-- 分享：复制免登录公开链接（与 overview 页同一方案），无 publicId 时隐藏 -->
        <button
          v-if="collection.publicId"
          class="btn btn-outline border-base-300 text-[0.9em] h-[2.3em] min-h-[2.3em] grow lg:grow-0 lg:w-full"
          title="Copy share link"
          @click.stop="copyShareLink"
        >
          <SvgIcon type="share" class="w-[1em] h-[1em] shrink-0" />
          <span class="whitespace-nowrap">Share</span>
        </button>

        <button
          v-if="canEdit"
          class="btn btn-outline border-base-300 text-error hover:bg-error/10 hover:border-error/40 text-[0.9em] h-[2.3em] min-h-[2.3em] grow lg:grow-0 lg:w-full"
          title="Delete collection"
          @click.stop="$emit('delete', collection.id)"
        >
          <SvgIcon type="trash" class="w-[1em] h-[1em] shrink-0" />
          <span class="whitespace-nowrap">Delete</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CollectionSummary } from '@/features/collections/types/collection'
import DatasetThumb from '@/features/collections/components/DatasetThumb.vue'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'
import { useToast } from '@/shared/composables/useToast'

const props = defineProps<{
  collection: CollectionSummary
  /** 当前用户是 owner 或 admin（控制 Delete 显隐） */
  canEdit?: boolean
  /** 集合属于当前登录用户（控制 My Collection 徽标显隐） */
  isMine?: boolean
  /** 该集合成员的 file_id（由 useCollectionCovers 逐卡补齐），决定封面轮播；只取前 5 个 */
  memberIds?: number[]
  /** 封面成员仍在拉取（拉取期间显示骨架而非占位图） */
  coverLoading?: boolean
}>()

defineEmits<{
  (e: 'view', id: number): void
  (e: 'delete', id: number): void
}>()

const { showToast } = useToast()

// 占位图只生成一次（随机配色，与数据集页回退同策略）
const placeholderSvg = getDatasetPlaceholderSvg({ showGuides: true })

// ---- 封面轮播：一卡一帧，箭头切到下一个成员 ----
// 只挂前 5 帧：列表页预览够用，同时封顶一次加载的图片请求数
const MAX_FRAMES = 5
const slides = computed(() => (props.memberIds ?? []).slice(0, MAX_FRAMES))
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

// ---- 归属徽标：本人集合 → My Collection，他人集合 → Public Collection ----
// 注意「公开」是「非本人所有」的表述 —— 列表接口没有集合级公开标记，
// 数据本身来自 /collections/all（全库，任意登录用户可见）。
const ownershipBadge = computed(() =>
  props.isMine
    ? {
        label: 'My Collection',
        class: 'bg-primary/10 dark:bg-primary/20 text-primary border-primary/20',
      }
    : {
        label: 'Public Collection',
        class:
          'bg-base-200/80 text-base-content/60 border-base-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
      },
)

// ---- 中右 chips 列：三个字段名恒显示，每个字段最多列 3 个值，超出的进 More ----
/** 每个字段常显的值数量上限 */
const VISIBLE_VALUE_COUNT = 3

const basicFields = computed(() =>
  [
    { label: 'Organism', values: props.collection.organism },
    { label: 'Organism Part', values: props.collection.organismPart },
    { label: 'Ionisation Source', values: props.collection.ionisationSource },
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

// ---- DOI / Access：值是裸 doi 时补 https://doi.org 前缀，已是 URL 就原样用 ----
function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}
function doiHref(doi: string): string {
  return isUrl(doi) ? doi : `https://doi.org/${doi}`
}

// ---- 分享链接：复制免登录公开页 URL（与 overview 页 copyShareLink 同一方案）----
async function copyShareLink() {
  if (!props.collection.publicId) return
  const url = `${location.origin}/collections/${props.collection.publicId}`
  try {
    await navigator.clipboard.writeText(url)
    showToast('Share link copied to clipboard', 'success')
  } catch {
    showToast(`Share link: ${url}`, 'info')
  }
}

const unitLabel = computed(() => (props.collection.memberCount === 1 ? 'dataset' : 'datasets'))

const formattedDate = computed(() =>
  props.collection.updatedAt ? new Date(props.collection.updatedAt).toLocaleDateString() : '—',
)

const formattedCreated = computed(() =>
  props.collection.createdAt ? new Date(props.collection.createdAt).toLocaleDateString() : '—',
)
</script>
