<template>
  <!-- 集合卡片：整行三栏 —— 左封面轮播 / 中两列元信息 / 右操作列。
       封面图统一取成员文件的 OSS 预览图（目录来自后端 image_path），
       后端已按数据类型返回对应的那张（processed → TIC，continuous → UMAP），
       前端不做判断；成员超过 1 个时用左右箭头切换。封面下方不带缩略图条。
       轮播用 daisyUI carousel（帧常驻 DOM + scrollIntoView 翻页），
       只挂前 5 个成员的帧，封顶图片请求数。

       中栏左侧：上半（名称 + 右上角归属徽标 + Creator/Created/Updated 行）
       不带框；下半 Title/DOI/Access/Journal 是独立的浅背景圆角框（标签左置，
       空值占位「—」），mt-auto 沉底让框底边与左侧封面底边对齐、空隙留在
       Creator 行与框之间。description 不展示。
       中栏右侧：Organism / Organism Part / Ionisation Source chips（不展示
       关键词），整列套圆角框。每个字段恒一行：最多常显 3 个值（nowrap，放不下
       由 chip 内省略号截断、title 悬停看全称），行尾「…」圆钮点开 popover
       悬浮窗看剩余值（top layer，不占卡片高度）——chips 列高度恒定，各卡片
       高度不随值的多少变化。
       卡片右侧多留一截空白（lg:pr-10），让操作列不贴边。

       字号一律走 kawaru-text-* 档位（style.css），不用 text-[Nem] ——
       本组件嵌在列表页的任意深度，em 会随层级叠乘，档位才是绝对像素。 -->
  <div
    class="flex flex-col lg:flex-row p-4 lg:pr-10 gap-x-5 gap-y-4 h-full bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-base-300 cursor-pointer"
    @click="$emit('view', collection.id)"
  >
    <!-- 左：封面轮播（尺寸与框体同一个元素，不再套一层纯尺寸壳）。
         lg:self-start：明确不参与拉伸，保持 4:3 的固定高度
         （lg 宽 400px → 高 300px，px 写死不受字号影响）。
         点击封面不进入 overview：翻看轮播时容易误触整卡跳转，
         入口收归 View Collection 按钮；cursor-default 覆盖整卡的 pointer -->
    <div
      class="shrink-0 w-full sm:w-[340px] lg:w-[400px] lg:self-start aspect-[4/3] relative rounded-lg overflow-hidden border border-base-300 bg-base-200 cursor-default"
      @click.stop
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

      <!-- 箭头 + 帧计数。箭头为半透明深色圆钮（黑底白箭头）：
           浅色 TIC / 深色 UMAP 封面上都稳定可见 -->
      <template v-if="slideCount > 1">
        <button
          type="button"
          class="absolute left-1 top-1/2 -translate-y-1/2 btn btn-xs btn-circle bg-black/50 hover:bg-black/70 text-white border-none shadow-sm kawaru-text-68"
          :aria-label="$t('collections.card.prev')"
          @click.stop="goPrev"
        >
          <SvgIcon type="chevron_left" class="w-[1em] h-[1em]" />
        </button>
        <button
          type="button"
          class="absolute right-1 top-1/2 -translate-y-1/2 btn btn-xs btn-circle bg-black/50 hover:bg-black/70 text-white border-none shadow-sm kawaru-text-68"
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

    <!-- 中：左信息容器 + 右 chips 列（xl 起并排，更窄时上下堆叠）。
         默认 stretch 撑满卡片内容高（卡片高度 = 封面 300px / 中左内容 /
         chips 列三者的最大者），中左下半框才能沉底与封面底边对齐 -->
    <div class="flex flex-1 min-w-0 flex-col gap-4 xl:flex-row">
      <!-- 中左：上半（名称 + 右上角归属徽标 + Creator 行）不带框；下半
           （Title/DOI/Access/Journal 标签左置行）是独立的浅背景圆角框，
           靠边框与背景色区分。
           下半 mt-auto：随列 stretch 沉到列底，框贴合内容高度，框底边与
           左侧封面（lg 高 300px）底边对齐；空隙留在 Creator 行与框之间。
           中右列 xl:self-start 不参与拉伸，保持自己的内容高度。 -->
      <div class="flex-1 min-w-0 flex flex-col">
        <!-- 上：名称 + 归属徽标（右上角）+ Creator / Created / Updated，无框无背景。
             列表接口没有集合级公开标记，「公开」即「非本人所有」 -->
        <div class="pb-3 min-w-0 flex flex-col gap-3">
          <div class="flex items-start justify-between gap-2.5 min-w-0">
            <h3
              class="flex-1 min-w-0 truncate font-bold kawaru-text-187 leading-snug text-base-content"
              :title="collection.name"
            >
              {{ collection.name }}
            </h3>
            <span
              class="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 kawaru-text-75 font-medium border"
              :class="ownershipBadge.class"
            >
              <SvgIcon type="circle_stack" class="w-[0.95em] h-[0.95em]" />
              {{ ownershipBadge.label }}
            </span>
          </div>

          <div
            class="flex flex-wrap items-center gap-x-4 gap-y-1 kawaru-text-81 text-base-content/75"
          >
            <span
              class="inline-flex items-center gap-1 min-w-0"
              :title="$t('collections.card.owner', { name: collection.ownerUsername })"
            >
              <span class="text-base-content/45">{{ $t('collections.card.label.creator') }}</span>
              <SvgIcon type="user" class="w-[1.05em] h-[1.05em] shrink-0 text-base-content/60" />
              <span class="truncate font-medium">{{ collection.ownerUsername }}</span>
            </span>
            <span class="whitespace-nowrap">
              <span class="text-base-content/45">{{ $t('collections.card.label.created') }}</span>
              {{ formattedCreated }}
            </span>
            <span class="whitespace-nowrap">
              <span class="text-base-content/45">{{ $t('collections.card.label.updated') }}</span>
              {{ formattedUpdated }}
            </span>
          </div>
        </div>

        <!-- 下：Title / DOI / Access / Journal 标签左置行，独立的浅背景圆角框
             （与上半的无框内容区分开）。mt-auto：框贴合内容高度、整体沉到列底，
             框底边与左侧封面（lg 高 300px）底边对齐；空隙出现在 Creator 行与
             框之间，而不是框内底部 -->
        <div
          class="mt-auto rounded-lg border border-base-300 bg-base-200/40 dark:bg-slate-700/40 p-3 flex flex-col gap-3"
        >
          <div class="flex items-baseline gap-2 min-w-0">
            <span class="w-[5.5em] shrink-0 kawaru-text-81 font-medium text-base-content/45">{{
              $t('collections.meta.title')
            }}</span>
            <p
              v-if="collection.title"
              class="flex-1 min-w-0 truncate kawaru-text-95 text-base-content/80"
              :title="collection.title"
            >
              {{ collection.title }}
            </p>
            <span v-else class="kawaru-text-95 text-base-content/40">—</span>
          </div>

          <div class="flex items-baseline gap-2 min-w-0">
            <span class="w-[5.5em] shrink-0 kawaru-text-81 font-medium text-base-content/45">{{
              $t('collections.meta.doi')
            }}</span>
            <div v-if="collection.doi.length" class="flex-1 min-w-0 flex flex-col gap-0.5">
              <a
                v-for="doi in collection.doi"
                :key="doi"
                :href="doiHref(doi)"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-1.5 min-w-0 kawaru-text-95 text-primary hover:underline"
                :title="doi"
                @click.stop
              >
                <SvgIcon type="link" class="w-[1em] h-[1em] shrink-0" />
                <span class="truncate">{{ doi }}</span>
              </a>
            </div>
            <span v-else class="kawaru-text-95 text-base-content/40">—</span>
          </div>

          <!-- 后端 access 字段原样透传，可能是 URL 也可能是标签文本（单值文本字段） -->
          <div class="flex items-baseline gap-2 min-w-0">
            <span class="w-[5.5em] shrink-0 kawaru-text-81 font-medium text-base-content/45">{{
              $t('collections.meta.access')
            }}</span>
            <a
              v-if="collection.access"
              :href="isUrl(collection.access) ? collection.access : undefined"
              :target="isUrl(collection.access) ? '_blank' : undefined"
              :rel="isUrl(collection.access) ? 'noopener noreferrer' : undefined"
              class="flex-1 min-w-0 items-center gap-1.5 kawaru-text-95"
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
            <span v-else class="kawaru-text-95 text-base-content/40">—</span>
          </div>

          <div class="flex items-baseline gap-2 min-w-0">
            <span class="w-[5.5em] shrink-0 kawaru-text-81 font-medium text-base-content/45">{{
              $t('collections.meta.journal')
            }}</span>
            <!-- 期刊名斜体加粗：Poppins 只下载了 italic 400 字面（无 700 斜体），
                 全局 font-synthesis:none 会吃掉合成粗体导致看不出加粗，
                 这里单独放开 weight 合成（与 zh-CN 全局放开的做法一致） -->
            <p
              v-if="collection.journalName"
              class="flex-1 min-w-0 truncate kawaru-text-95 text-base-content/80 italic font-bold [font-synthesis:weight]"
              :title="collection.journalName"
            >
              {{ collection.journalName }}
            </p>
            <span v-else class="kawaru-text-95 text-base-content/40">—</span>
          </div>

          <!-- 发表时间：跟在 Journal 行下，框多占一行，Creator 行与框之间的
               弹性空隙（mt-auto）随之收窄；label 列宽与上面各行对齐 -->
          <div class="flex items-baseline gap-2 min-w-0">
            <span class="w-[5.5em] shrink-0 kawaru-text-81 font-medium text-base-content/45">{{
              $t('collections.meta.publishTime')
            }}</span>
            <p
              v-if="collection.publishTime"
              class="flex-1 min-w-0 truncate kawaru-text-95 text-base-content/80"
              :title="formattedPublishTime"
            >
              {{ formattedPublishTime }}
            </p>
            <span v-else class="kawaru-text-95 text-base-content/40">—</span>
          </div>
        </div>
      </div>

      <!-- 中右：Organism / Organism Part / Ionisation Source 三个字段名恒显示（不含关键词），
           每个字段恒一行：最多常显 3 个值（nowrap，放不下由 chip 内省略号截断、
           title 悬停看全称），还有剩余时行尾跟「…」圆钮，点开 popover 悬浮窗看
           剩余值（top layer，不占卡片高度）——chips 列高度恒定，各卡片不随值
           多少变化。整列套圆角框；xl:self-start 保持内容高度，不参与拉伸对齐 -->
      <div
        class="xl:w-[17em] shrink-0 flex flex-col gap-2.5 min-w-0 rounded-lg border border-base-300 p-3 xl:self-start"
      >
        <div v-for="field in basicFields" :key="field.key" class="min-w-0">
          <div class="kawaru-text-81 font-medium text-base-content/45">{{ field.label }}</div>
          <div
            v-if="field.values.length"
            class="flex flex-nowrap items-center gap-1.5 mt-1 min-w-0"
          >
            <span
              v-for="value in field.visibleValues"
              :key="value"
              class="min-w-0 inline-flex items-center rounded-full px-2.5 py-0.5 kawaru-text-81 font-medium bg-base-200/80 text-base-content/70 border border-base-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
              :title="vocabLabel(value)"
            >
              <span class="truncate">{{ vocabLabel(value) }}</span>
            </span>

            <!-- 行尾「…」：该字段还有未常显的值，点开下方悬浮窗查看。
                 shrink-0 让它在与截断 chip 挤一行时始终留在可视区末尾 -->
            <button
              v-if="field.hiddenValues.length"
              type="button"
              :popovertarget="field.popoverId"
              :style="{ anchorName: field.anchorName }"
              class="shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 kawaru-text-81 font-medium bg-base-200/80 text-base-content/70 border border-base-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 hover:border-primary/40 hover:text-primary"
              :title="$t('collections.card.more', { count: field.hiddenValues.length })"
              :aria-label="$t('collections.card.moreAria', { name: collection.name })"
              @click.stop
            >
              …
            </button>

            <!-- 剩余值悬浮窗：daisyUI 5 的 popover 形态，内容进 top layer，
                 点外部 / Esc 关闭；[position-try-fallbacks] 让下方放不下时自动上翻。
                 与「…」圆钮同条件渲染，没有剩余值就不挂空面板 -->
            <div
              v-if="field.hiddenValues.length"
              :id="field.popoverId"
              popover
              role="dialog"
              :style="{ positionAnchor: field.anchorName }"
              class="dropdown dropdown-end dropdown-bottom w-[16em] rounded-box p-3 bg-base-100 dark:bg-slate-800 border border-base-300 shadow-lg [position-try-fallbacks:flip-block]"
              @click.stop
            >
              <div class="kawaru-text-81 font-medium text-base-content/45">{{ field.label }}</div>
              <div class="flex flex-wrap gap-1.5 mt-1">
                <span
                  v-for="value in field.hiddenValues"
                  :key="value"
                  class="max-w-full inline-flex items-center rounded-full px-2.5 py-0.5 kawaru-text-81 font-medium bg-base-200/80 text-base-content/70 border border-base-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
                  :title="vocabLabel(value)"
                >
                  <span class="truncate">{{ vocabLabel(value) }}</span>
                </span>
              </div>
            </div>
          </div>
          <div v-else class="kawaru-text-81 text-base-content/40 mt-1">—</div>
        </div>
      </div>
    </div>

    <!-- 右：Share / View / Delete 按钮组 + 成员数（Share 需 publicId，Delete 仅
         owner/admin）。lg 下列内容整体垂直居中（justify-center），成员数在按钮
     组下方。容器自挂 kawaru-text-100 钉住字号，lg:w-[11.5em] 恒等于
     「档位 × 11.5」，换档时同步跟上；最宽条目 "View Collection" 需单行放下。 -->
    <div
      class="cursor-default kawaru-text-100 flex flex-row flex-wrap gap-4 items-center w-full border-t border-base-300 pt-3 lg:w-[11.5em] lg:flex-col lg:items-stretch lg:self-stretch lg:justify-center lg:border-l lg:border-t-0 lg:pt-0 lg:pl-4"
      @click.stop
    >
      <!-- 操作按钮组：Share 在前、View 在后（与最初的 View / Share 对调过） -->
      <div class="flex flex-row flex-wrap items-center gap-3 w-full lg:flex-col lg:items-stretch">
        <!-- 分享：复制免登录公开链接（与 overview 页同一方案），无 publicId 时隐藏 -->
        <button
          v-if="collection.publicId"
          class="btn btn-outline border-base-300 kawaru-text-95 h-[2.3em] min-h-[2.3em] grow lg:grow-0 lg:w-full"
          :title="$t('collections.card.copyShareLink')"
          @click.stop="copyShareLink"
        >
          <SvgIcon type="share" class="w-[1em] h-[1em] shrink-0" />
          <span class="whitespace-nowrap">{{ $t('common.action.share') }}</span>
        </button>

        <button
          class="btn btn-primary kawaru-text-95 h-[2.3em] min-h-[2.3em] grow lg:grow-0 lg:w-full"
          @click.stop="$emit('view', collection.id)"
        >
          <span class="whitespace-nowrap">{{ $t('collections.card.viewCollection') }}</span>
          <SvgIcon type="chevron_right" class="w-[1em] h-[1em] shrink-0" />
        </button>

        <!-- 删除：默认浅粉底，hover 加深一档即可 -->
        <button
          v-if="canEdit"
          class="btn btn-outline border-error/30 bg-error/15 text-error hover:bg-error/30 hover:border-error/50 kawaru-text-95 h-[2.3em] min-h-[2.3em] grow lg:grow-0 lg:w-full"
          :title="$t('collections.card.deleteTitle')"
          @click.stop="$emit('delete', collection.id)"
        >
          <SvgIcon type="trash" class="w-[1em] h-[1em] shrink-0" />
          <span class="whitespace-nowrap">{{ $t('common.action.delete') }}</span>
        </button>
      </div>

      <!-- 成员总数（按钮组下方，lg 下在列内水平居中） -->
      <div
        class="flex items-center justify-center gap-2 px-1 text-base-content/70 lg:w-full"
        :title="$t('collections.card.memberCountTitle', collection.memberCount)"
      >
        <SvgIcon type="queue_list" class="w-[1.5em] h-[1.5em] shrink-0" />
        <span class="kawaru-text-187 font-bold leading-none text-primary">{{
          collection.memberCount
        }}</span>
        <span class="kawaru-text-100">{{ unitLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CollectionSummary } from '@/features/collections/types/collection'
import DatasetThumb from '@/features/collections/components/DatasetThumb.vue'
import { getDatasetPlaceholderSvg } from '@/features/datasets/utils/datasetPlaceholder'
import { vocabLabel } from '@/features/datasets/constants/vocabLabels'
import { formatDate } from '@/shared/utils/format'
import { useToast } from '@/shared/composables/useToast'
import { t } from '@/i18n'

const props = defineProps<{
  collection: CollectionSummary
  /** 当前用户是 owner 或 admin（控制 Delete 显隐） */
  canEdit?: boolean
  /** 集合属于当前登录用户（控制归属徽标显隐） */
  isMine?: boolean
  /** 该集合成员的 imagePath（由 useCollectionCovers 逐卡补齐），决定封面轮播；只取前 5 个 */
  imagePaths?: (string | null)[]
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

// ---- 归属徽标：本人集合 → My Collection，他人集合 → Public Collection ----
// 注意「公开」是「非本人所有」的表述 —— 列表接口没有集合级公开标记，
// 数据本身来自 /collections/list_all（全库，任意登录用户可见）。
const ownershipBadge = computed(() =>
  props.isMine
    ? {
        label: t('collections.card.mineBadge'),
        class: 'bg-primary/10 dark:bg-primary/20 text-primary border-primary/20',
      }
    : {
        label: t('collections.public.badge'),
        class:
          'bg-base-200/80 text-base-content/60 border-base-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
      },
)

// ---- 中右 chips 列：三个字段名恒显示，每个字段恒一行 —— 最多常显 3 个值，
// 还有剩余时行尾「…」圆钮点开 per-field 悬浮窗看 ----
/** 每个字段常显的值数量上限 */
const VISIBLE_VALUE_COUNT = 3

const basicFields = computed(() =>
  [
    { key: 'organism', label: t('common.meta.organism'), values: props.collection.organism },
    {
      key: 'organismPart',
      label: t('common.meta.organismPart'),
      values: props.collection.organismPart,
    },
    {
      key: 'ionisationSource',
      label: t('common.meta.ionisationSource'),
      values: props.collection.ionisationSource,
    },
  ].map((field) => ({
    ...field,
    visibleValues: field.values.slice(0, VISIBLE_VALUE_COUNT),
    hiddenValues: field.values.slice(VISIBLE_VALUE_COUNT),
    // popover 靠 id 关联触发按钮，一页多卡 × 每卡三个字段都需唯一
    popoverId: `collection-${props.collection.id}-more-${field.key}`,
    // 显式锚点（同样需唯一）。daisyUI 的 popover 靠浏览器的「隐式锚点」（=popovertarget
    // 按钮）定位，但 :popover-open 一翻 false 隐式锚点就没了 —— 而 daisyUI 为了淡出动画
    // 会在关闭后继续渲染 ~250ms，那段时间 position-area 失效，面板会掉到视口左上角
    // 闪一下内容。显式 anchor-name / position-anchor 不随 open 状态丢失，位置全程不动。
    anchorName: `--collection-${props.collection.id}-more-${field.key}`,
  })),
)

// ---- DOI / Access：值是裸 doi 时补 https://doi.org 前缀，已是 URL 就原样用 ----
function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}
function doiHref(doi: string): string {
  // 先剥 doi:/doi.org 前缀再拼，避免 "doi:10.x" 变成 "https://doi.org/doi:10.x"
  const value = doi.trim().replace(/^(?:(?:https?:\/\/)?(?:dx\.|www\.)?doi\.org\/|doi:\s*)/i, '')
  return isUrl(value) ? value : `https://doi.org/${value}`
}

// ---- 分享链接：复制免登录公开页 URL（与 overview 页 copyShareLink 同一方案）----
async function copyShareLink() {
  if (!props.collection.publicId) return
  const url = `${location.origin}/collections/${props.collection.publicId}`
  try {
    await navigator.clipboard.writeText(url)
    showToast(t('common.feedback.copied'), 'success')
  } catch {
    showToast(t('collections.overview.shareLink', { url }), 'info')
  }
}

const unitLabel = computed(() => t('collections.unit.dataset', props.collection.memberCount))

// formatDate 空值返回 ''，这里统一补「—」（与其他元数据行的占位一致）
const formattedCreated = computed(() => formatDate(props.collection.createdAt) || '—')
const formattedUpdated = computed(() => formatDate(props.collection.updatedAt) || '—')
// 发表时间：模板里 v-if 已挡空值，这里只负责格式化（title 悬停同款文本）
const formattedPublishTime = computed(() => formatDate(props.collection.publishTime))
</script>
