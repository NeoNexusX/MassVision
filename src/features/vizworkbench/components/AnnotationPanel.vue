<script setup lang="ts">
/**
 * Collapsible left-side annotation panel.
 *
 * Imports an external metabolite/lipid annotation CSV, matches each row's
 * experimental m/z against the current average spectrum, and lets the user
 * jump to a matched m/z (refreshing the ion image + highlighting the spectrum
 * peak) by reusing the result page's existing m/z-selection entry point.
 *
 * Layout: on desktop it is a flex-flow column (width animates between a thin
 * rail and 340 px); on small screens it becomes a fixed overlay drawer with a
 * backdrop + a floating open button, so the ion image is never squeezed.
 *
 * Table keeps only two compact columns (Annotation + Exp. m/z).  The detailed
 * fields (matched m/z, mass error, intensity, status) and a PubChem lookup
 * button live in the hover card so the table never needs horizontal scroll.
 * Sorting is driven from a "Sort by" control in the toolbar, not the headers.
 */
import { computed, nextTick, ref, watch, onUnmounted } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import SearchInput from '@/shared/components/SearchInput.vue'
import {
  useAnnotationMatch,
  type AnnotationSortKey,
} from '@/features/vizworkbench/composables/useAnnotationMatch'
import {
  formatMassError,
  formatIntensity,
  findClosestIndex,
  type MatchedAnnotationRow,
} from '@/features/vizworkbench/utils/csvAnnotation'
import PubChemDialog from '@/features/vizworkbench/components/PubChemDialog.vue'
import { scrollIntoContainer } from '@/features/vizworkbench/utils/scrollIntoContainer'
import { useAnnotationSpatialScoring } from '@/features/vizworkbench/composables/useAnnotationSpatialScoring'
import { ADDUCT_CORR_MIN, type SpatialScore } from '@/features/vizworkbench/utils/spatialScore'
import { isotopeEnvelope, chargeFromIonType } from '@/features/vizworkbench/utils/isotope'
import { mzAxisRef } from '@/features/vizworkbench/composables/useZarrIonImage'
import { useToast } from '@/shared/composables/useToast'
import MzText from '@/shared/components/MzText.vue'
import { t } from '@/i18n'
import {
  registerContextProviders,
  unregisterContextProviders,
} from '@/features/assistant/providers/analysisContext'

const props = defineProps<{
  /** Panel expanded state (v-model:expanded). */
  expanded: boolean
  /** The result page's m/z-selection entry point. */
  selectMzIndex: (idx: number) => void | Promise<void>
  /** Currently selected m/z axis index (drives active-row highlight). */
  selectedMzIndex: number
  /** Current spectrum mode; annotations require continuous centroid data. */
  spectrumMode?: string
}>()

const emit = defineEmits<{
  (e: 'update:expanded', value: boolean): void
}>()

const {
  fileName,
  parseError,
  isImporting,
  tolMode,
  tolValue,
  spectrumAvailable,
  counts,
  coarseFiltered,
  search,
  filter,
  filterLevel4,
  filterAdduct,
  filterFormula,
  adductOptions,
  formulaOptions,
  sortKey,
  sortDir,
  filteredRows,
  matchedRows,
  importFile,
  clear,
  selectRow,
  exportMatchedCsv,
} = useAnnotationMatch((idx) => props.selectMzIndex(idx))

// ---- Tier-2 空间证据（chaos + M+1 共定位，Top-K 渐进） ----
// 结果按 row id 存放在本 composable，渲染时合并——不改写 worker 拥有的
// 行对象，也不参与综合分（worker 排序所有权 + 渐进值不导致行跳动）。
const { spatialByRowId, spatialPending, spatialProgress, bumpPriority } =
  useAnnotationSpatialScoring(matchedRows, { tolMode, tolValue })

// ---- AI 助手上下文注册（annotations） ----
// 把匹配好的注释行以惰性 getter 注册给 assistant 分析上下文；卸载时只删自己的键
// （不能清全部——本面板注册不了其他组件的 provider）。
registerContextProviders({
  annotations: () => {
    const rows = matchedRows.value
    if (!rows || rows.length === 0) return null
    return { matchedRows: rows, spatial: spatialByRowId.value }
  },
})
onUnmounted(() => unregisterContextProviders(['annotations']))

const fileInput = ref<HTMLInputElement | null>(null)

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await importFile(file)
  input.value = '' // allow re-importing the same file
}

function expand() {
  emit('update:expanded', true)
}
function collapse() {
  emit('update:expanded', false)
}

const hasData = computed(() => fileName.value !== null)

// 上游筛选（状态 badge / 搜索框）可能把已选中的加合物/分子式从下拉选项里
// 挤掉——此时回退到 All，避免表格被一个不可见的值滤成空表。
watch(adductOptions, (opts) => {
  if (filterAdduct.value && !opts.includes(filterAdduct.value)) filterAdduct.value = ''
})
watch(formulaOptions, (opts) => {
  if (filterFormula.value && !opts.includes(filterFormula.value)) filterFormula.value = ''
})
const isAnnotationAvailable = computed(
  () => props.spectrumMode === 'centroid' && spectrumAvailable.value,
)

function isActive(row: { matchedIndex: number | null }): boolean {
  return row.matchedIndex != null && row.matchedIndex === props.selectedMzIndex
}

// ---- 证据分格式化（悬停卡） ----

/** 0..1 分值显示：null = '-'（未打分/不适用） */
function fmtScore(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? v.toFixed(3) : '-'
}

/** q 值以百分数显示（<0.1% 显示 <0.1%） */
function fmtFdr(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '-'
  const pct = v * 100
  return pct < 0.1 ? '<0.1%' : `${pct.toFixed(1)}%`
}

/** 综合分着色：高分为成功色，帮助扫读 */
function compositeClassOf(row: MatchedAnnotationRow): string {
  if (row.compositeScore == null) return ''
  if (row.level === 4) return 'text-success/80'
  if (row.compositeScore >= 0.5) return ''
  return 'text-base-content/40'
}

/** 悬停卡期望峰数（isotopeExpCount 缺省时退回 obsCount 上限展示） */
function isotopeExpectedOf(row: MatchedAnnotationRow): number {
  return row.isotopeExpCount ?? row.isotopeObsCount ?? 0
}

/** 等级徽章文案（script 侧拼串，绕开模板 raw-text lint） */
function levelBadge(level: 4 | 5 | null | undefined): string {
  return level != null ? `L${level}` : '-'
}

/** 多加合物组徽章文案（同上：M×n = 该分子以 n 种加合离子被观测） */
function adductGroupBadge(peers: number): string {
  return `M×${peers + 1}`
}

/** 组内共定位相关文案（"r=0.83"） */
function fmtCorr(v: number): string {
  return `r=${v.toFixed(2)}`
}

/** 空间/MSM 着色：高分成功色 */
function corrClassOf(v: number | null | undefined): string {
  if (v == null) return ''
  if (v >= 0.5) return 'text-success/80'
  return ''
}

/** 悬停行的空间分（visibleRows 已按 id 合并；tooltipRow 可能来自合并前，
 *  兜底直接查 Map）。 */
const tooltipSpatial = computed<SpatialScore | null | undefined>(() =>
  tooltipRow.value
    ? ((tooltipRow.value as MatchedAnnotationRow & { spatial?: SpatialScore | null }).spatial ??
      spatialByRowId.value.get(tooltipRow.value.id) ??
      null)
    : null,
)

// ---- 同位素峰跳转 + 同分子加合物组（悬停卡） ----

/** 悬停卡的同位素峰列表：理论包络（M..M+3）锚定在本行匹配峰位；轴上
 *  容差窗口内有采样点 → 可点击跳转（走页面既有的 selectMzIndex 入口，
 *  离子图 + 谱图红线一起联动）。 */
interface IsotopePeakItem {
  label: string
  mz: number
  rel: number
  /** 轴上下标（null = 该位置无峰，按钮禁用） */
  jumpIndex: number | null
}

const tooltipIsotopePeaks = computed<IsotopePeakItem[] | null>(() => {
  const row = tooltipRow.value
  if (!row || row.matchStatus !== 'matched' || !row.formulaIon) return null
  const z = chargeFromIonType(row.ionType)
  const env = isotopeEnvelope(row.formulaIon, z)
  if (!env) return null
  const axis = mzAxisRef.value
  const anchor = row.matchedMz ?? row.expMz
  return env.map((p) => {
    const mz = anchor + p.dm
    let jumpIndex: number | null = null
    if (axis && axis.length > 0) {
      const tolDa =
        tolMode.value === 'ppm' ? Math.abs(mz) * tolValue.value * 1e-6 : tolValue.value
      const i = findClosestIndex(axis, mz)
      if (i >= 0 && Math.abs(axis[i]! - mz) <= tolDa) jumpIndex = i
    }
    // 包络已被剪枝（<1% 的峰不返回），编号按间距反推而非数组下标
    const k = Math.round((p.dm * z) / 1.0033548)
    return { label: k <= 0 ? 'M' : `M+${k}`, mz, rel: p.rel, jumpIndex }
  })
})

function jumpToIsotope(item: IsotopePeakItem): void {
  if (item.jumpIndex == null) return
  props.selectMzIndex(item.jumpIndex)
}

/** 同分子加合物组：peer 行对象（按 id 从 matchedRows 找回，供点击跳转；
 *  corr 为该 peer 行的组内共定位 Pearson，≥0.7 绿色确认）。 */
const tooltipAdductPeers = computed(() => {
  const row = tooltipRow.value
  if (!row || row.adductPeerIds.length === 0) return []
  const byId = new Map(matchedRows.value.map((r) => [r.id, r] as const))
  return row.adductPeerIds
    .map((id) => byId.get(id) ?? null)
    .filter((r): r is MatchedAnnotationRow => r != null)
    .map((r) => ({ row: r, corr: spatialByRowId.value.get(r.id)?.adductCorr ?? null }))
})

/** 本行加合物组的空间确认（Tier-2 渐进；undefined = 组不在 Top-K/未算到）。 */
const tooltipAdductCorr = computed<number | null | undefined>(() => {
  if (!tooltipRow.value || tooltipRow.value.adductPeerIds.length === 0) return undefined
  return tooltipSpatial.value?.adductCorr ?? null
})

/** 模板里可用的确认阈值常量 */
const adductCorrMin = ADDUCT_CORR_MIN

function rowClass(row: { matchStatus: string; matchedIndex: number | null }): string {
  const active = isActive(row)
  if (row.matchStatus === 'matched') {
    return active ? 'bg-primary/20 cursor-pointer' : 'hover:bg-base-200/70 cursor-pointer'
  }
  return active ? 'bg-primary/10' : 'opacity-60'
}

/** Step for the tolerance <input>, finer in Da mode so high-resolution masses
 *  (e.g. 0.05 Da) can be tuned precisely. */
const tolStep = computed(() => (tolMode.value === 'ppm' ? 0.1 : 0.0001))

// ---- Sort control (moved from table headers into the toolbar) ----

/** CSV 列名是文件格式约定，各语言下都照原样显示 */
const CSV_COLUMNS = ['Exp. m/z', 'Candidate_1..5', 'formula_ion', 'Ion type']

// label 写成 getter：常量表只求值一次，模板里调用才会随语言切换刷新
const SORT_OPTIONS: { value: AnnotationSortKey; label: () => string }[] = [
  { value: 'name', label: () => t('common.field.name') },
  { value: 'expMz', label: () => t('vizworkbench.annotation.target') },
  { value: 'massError', label: () => t('vizworkbench.annotation.massDifference') },
  { value: 'avgIntensity', label: () => t('vizworkbench.spectrum.intensity') },
  { value: 'compositeScore', label: () => t('vizworkbench.annotation.compositeScore') },
  { value: 'fdr', label: () => t('vizworkbench.annotation.fdr') },
  { value: 'adductScore', label: () => t('vizworkbench.annotation.adductScore') },
]

/** 这些排序键的天然方向是"好值在前"：综合分高者优先，切换字段时直接落到
 *  降序（fdr 是升序——q 值越小越可信，维持 asc 重置即可）。 */
const DESC_DEFAULT = new Set<AnnotationSortKey>(['compositeScore', 'adductScore'])

function onSortKeyChange(e: Event) {
  const key = (e.target as HTMLSelectElement).value as AnnotationSortKey
  sortKey.value = key
  sortDir.value = DESC_DEFAULT.has(key) ? 'desc' : 'asc'
}

function toggleSortDir() {
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
}

// ---- Drag & drop CSV import ----
// The whole expanded panel is a drop target. dragenter/dragleave fire once per
// child element, so we track nesting depth instead of toggling on each event -
// otherwise the overlay would flicker when moving across rows.
const { showToast } = useToast()
const dragActive = ref(false)
let dragDepth = 0

function hasFilePayload(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

function onDragEnter(e: DragEvent) {
  if (!hasFilePayload(e)) return
  e.preventDefault()
  dragDepth++
  dragActive.value = true
}

function onDragOver(e: DragEvent) {
  if (!hasFilePayload(e)) return
  e.preventDefault() // required, otherwise the browser blocks the drop
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onDragLeave(e: DragEvent) {
  if (!hasFilePayload(e)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragActive.value = false
}

async function onDrop(e: DragEvent) {
  if (!hasFilePayload(e)) return
  e.preventDefault()
  dragDepth = 0
  dragActive.value = false
  const file = Array.from(e.dataTransfer?.files ?? []).find(
    (f) => f.name.toLowerCase().endsWith('.csv') || f.type === 'text/csv',
  )
  if (file) {
    await importFile(file)
  } else {
    showToast(t('vizworkbench.annotation.dropCsvOnly'), 'error')
  }
}

// ---- Virtual scrolling -------------------------------------------------
// A full annotation CSV can hold hundreds of thousands of rows; rendering
// them all crashes the tab (OOM). Instead we render only the rows inside
// the visible window (plus an overscan buffer) and pad the tbody with
// fixed-height spacer rows so the scrollbar maps to the full list.

/** Fallback row height (px) until the first real row is measured. */
const FALLBACK_ROW_H = 53
/** Extra rows rendered above/below the viewport to avoid pop-in. */
const OVERSCAN = 8

const tableScrollEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportH = ref(400)
/** Measured on-screen height of a data row; themes/fonts make this differ
 *  from any constant we could hard-code, so we read it from the DOM. */
const rowH = ref(FALLBACK_ROW_H)

/** 滚动时把可见窗口的行提到空间打分高优先级道（节流 300ms）。 */
let scrollBumpTimer: ReturnType<typeof setTimeout> | null = null
function bumpVisible() {
  if (scrollBumpTimer) return
  scrollBumpTimer = setTimeout(() => {
    scrollBumpTimer = null
    bumpPriority(filteredRows.value.slice(visibleStart.value, visibleEnd.value).map((r) => r.id))
  }, 300)
}

function onTableScroll(e: Event) {
  const el = e.target as HTMLElement
  scrollTop.value = el.scrollTop
  viewportH.value = el.clientHeight
  // Rows scrolled out of the window never fire mouseleave, so dismiss the
  // hover card here or it lingers at stale coordinates.
  dismissTooltip()
  bumpVisible()
}

/** Measure a rendered data row so the spacer math matches reality. */
function measureRowHeight() {
  const row = tableScrollEl.value?.querySelector('tbody tr[data-row]')
  const h = row?.getBoundingClientRect().height
  if (h && h > 0) rowH.value = h
}

/** Reset the virtual window when the list changes (import, filter, sort).
 *  Also dismiss the hover card: the rematch replaced every row object, so the
 *  card would otherwise linger over a stale snapshot (v-for patches the hovered
 *  node in place by key - no mouseleave ever fires). */
watch(
  filteredRows,
  async () => {
    dismissTooltip()
    scrollTop.value = 0
    await nextTick()
    const el = tableScrollEl.value
    if (el) {
      el.scrollTop = 0
      viewportH.value = el.clientHeight
      measureRowHeight()
    }
  },
  { flush: 'post' },
)

// tolMode changes the unit every stored massError was computed in; until the
// debounced rematch lands, the card would print the old number with the new
// unit (formatMassError picks decimals from the mode, it does not convert).
watch(tolMode, dismissTooltip)

/** Keep viewportH/rowH in sync with the container: the table only scrolls
 *  once data exists, so its size changes on expand/collapse, window resize
 *  and theme switches - none of which fire a scroll event. Observed once
 *  when the v-if mounts the container; cleaned up on unmount. */
watch(
  tableScrollEl,
  (el, _prev, onCleanup) => {
    if (!el) return
    viewportH.value = el.clientHeight
    measureRowHeight()
    const ro = new ResizeObserver(() => {
      viewportH.value = el.clientHeight
      measureRowHeight()
    })
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  },
  { flush: 'post' },
)

const totalRowCount = computed(() => filteredRows.value.length)

const visibleStart = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / rowH.value) - OVERSCAN),
)
const visibleEnd = computed(() =>
  Math.min(
    totalRowCount.value,
    Math.ceil((scrollTop.value + viewportH.value) / rowH.value) + OVERSCAN,
  ),
)
/** 渲染窗口内的行 + 合并的 Tier-2 空间分（按 id 查 Map，不改写行对象）。 */
const visibleRows = computed(() =>
  filteredRows.value.slice(visibleStart.value, visibleEnd.value).map((r) => ({
    ...r,
    spatial: spatialByRowId.value.get(r.id) ?? null,
  })),
)
/** Padding heights that keep the scrollbar proportional to the full list. */
const topPadH = computed(() => visibleStart.value * rowH.value)
const bottomPadH = computed(() =>
  Math.max(0, (totalRowCount.value - visibleEnd.value) * rowH.value),
)

// ---- Copyable candidates tooltip ----
// A native title="" tooltip vanishes too fast to select/copy text. Instead we
// show a fixed-position panel on hover that the user can move the mouse into
// and stay, so candidate names are selectable. A short grace timer on leave
// bridges the gap between the name cell and the tooltip.
const tooltipRow = ref<MatchedAnnotationRow | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)
let tooltipTimer = 0

const TOOLTIP_W = 280
const TOOLTIP_H = 320
const GAP = 8

function onNameEnter(row: MatchedAnnotationRow, e: MouseEvent) {
  if (tooltipTimer) {
    clearTimeout(tooltipTimer)
    tooltipTimer = 0
  }
  tooltipRow.value = row
  // 悬停的行优先补算空间证据（如果它还在队列里）
  bumpPriority([row.id])
  const cell = e.currentTarget as HTMLElement
  const rect = cell.getBoundingClientRect()
  // Prefer placing the tooltip to the RIGHT of the annotation panel so it
  // opens into the empty content area instead of covering the table. Fall
  // back to the left only when there isn't enough room on the right.
  const panelEl = cell.closest('aside')
  const panelRect = panelEl?.getBoundingClientRect() ?? rect
  const spaceRight = window.innerWidth - panelRect.right
  const spaceLeft = panelRect.left
  if (spaceRight >= TOOLTIP_W + GAP) {
    tooltipX.value = panelRect.right + GAP
  } else if (spaceLeft >= TOOLTIP_W + GAP) {
    tooltipX.value = panelRect.left - TOOLTIP_W - GAP
  } else {
    // Neither side fits - just clamp into the viewport on the wider side.
    if (spaceRight >= spaceLeft) {
      tooltipX.value = Math.min(panelRect.right + GAP, window.innerWidth - TOOLTIP_W - GAP)
    } else {
      tooltipX.value = Math.max(GAP, panelRect.left - TOOLTIP_W - GAP)
    }
  }
  // Vertically align with the hovered row, clamped so the tooltip stays
  // within the viewport.
  tooltipY.value = Math.max(GAP, Math.min(rect.top, window.innerHeight - TOOLTIP_H - GAP))
}

function onCellLeave() {
  tooltipTimer = window.setTimeout(() => {
    tooltipRow.value = null
  }, 250)
}

/** Immediately close the hover card and cancel its grace timer. */
function dismissTooltip() {
  if (tooltipTimer) {
    clearTimeout(tooltipTimer)
    tooltipTimer = 0
  }
  tooltipRow.value = null
}

function onTooltipEnter() {
  if (tooltipTimer) {
    clearTimeout(tooltipTimer)
    tooltipTimer = 0
  }
}

function onTooltipLeave() {
  tooltipRow.value = null
}

// ---- PubChem lookup dialog ----
const pubchemOpen = ref(false)
const pubchemQuery = ref('')

function searchPubChem(name: string) {
  pubchemQuery.value = name
  pubchemOpen.value = true
}

function copyName(name: string) {
  navigator.clipboard?.writeText(name).catch(() => {})
}

/** 点击同分子加合物 chip → 选中该 peer 行（复用行点击入口：跳离子图 +
 *  谱图高亮 + 表格滚动同步）。 */
function jumpToAdductPeer(peer: MatchedAnnotationRow): void {
  selectRow(peer)
}

// ---- Cross-table sync: scroll to the row matching the externally selected m/z ----
// Both this table and ComparisonResultsTable share `selectedMzIndex` (the
// average-spectrum axis index). When a row is clicked in either table, the
// other should scroll its matching row into view so the linkage is visible.
// If the target row is filtered out by the current search/filter, we respect
// the user's view and do nothing (no scroll, no highlight).
const tableBodyRef = ref<HTMLElement | null>(null)
const tableScrollRef = ref<HTMLElement | null>(null)

watch(
  () => props.selectedMzIndex,
  async (idx) => {
    if (idx == null || idx < 0) return
    const target = filteredRows.value.find((r) => r.matchedIndex === idx)
    if (!target) return
    await nextTick()
    const tr = tableBodyRef.value?.querySelector<HTMLElement>(`tr[data-mz-index="${idx}"]`)
    if (tr && tableScrollRef.value) scrollIntoContainer(tr, tableScrollRef.value, 'center')
  },
)
</script>

<template>
  <!-- Mobile participates in the page's vertical flow; desktop keeps the collapsible side rail. -->
  <aside
    :class="[
      'static flex w-full flex-col overflow-hidden rounded-xl border-2 border-base-content/30 bg-base-100 shadow-sm lg:h-full lg:max-w-none lg:shrink-0 lg:transition-[width] lg:duration-200 lg:ease-out',
      expanded ? 'lg:w-full' : 'lg:w-11 lg:min-w-11',
    ]"
  >
    <!-- Mobile collapsed bar: stays in normal flow instead of becoming a floating button. -->
    <button
      v-show="!expanded"
      class="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-base-200/60 lg:hidden"
      :title="$t('vizworkbench.annotation.expand')"
      @click="expand"
    >
      <span class="kawaru-text-87 font-semibold">{{ $t('vizworkbench.annotation.title') }}</span>
      <SvgIcon type="chevron_down" />
    </button>

    <!-- Collapsed rail (desktop only): click to expand -->
    <div
      v-show="!expanded"
      class="hidden h-full w-full cursor-pointer flex-col items-center justify-center gap-2 py-3 hover:bg-base-200/60 lg:flex"
      :title="$t('vizworkbench.annotation.expand')"
      @click="expand"
    >
      <SvgIcon type="chevron_right" />
      <span class="[writing-mode:vertical-rl] kawaru-text-81 font-medium tracking-wide">
        {{ $t('vizworkbench.annotation.title') }}
      </span>
    </div>

    <!-- Expanded content -->
    <div
      v-show="expanded"
      class="flex h-auto min-h-0 flex-col gap-2 p-3 lg:h-full"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <!-- Header -->
      <div class="flex items-center justify-between gap-2 shrink-0">
        <div class="min-w-0">
          <h3 class="kawaru-text-81 font-semibold text-base-content leading-tight">
            {{ $t('vizworkbench.annotation.title') }}
          </h3>
          <p v-if="fileName" class="kawaru-text-68 text-base-content/50 truncate" :title="fileName">
            {{ fileName }}
          </p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            v-if="hasData"
            class="btn btn-ghost btn-xs btn-square kawaru-text-68"
            :class="{ 'btn-disabled opacity-40': !counts.matched }"
            :title="$t('vizworkbench.annotation.exportHint')"
            :disabled="!counts.matched"
            @click="exportMatchedCsv(spatialByRowId)"
          >
            <SvgIcon type="download" />
          </button>
          <button
            v-if="hasData"
            class="btn btn-ghost btn-xs btn-square kawaru-text-68"
            :title="$t('vizworkbench.annotation.clearHint')"
            @click="clear"
          >
            <SvgIcon type="trash" />
          </button>
          <button
            class="btn btn-ghost btn-xs btn-square kawaru-text-68"
            :title="$t('vizworkbench.annotation.collapse')"
            @click="collapse"
          >
            <SvgIcon type="chevron_right" class="rotate-180" />
          </button>
        </div>
      </div>

      <!-- Import + tolerance + sort + search -->
      <div class="space-y-2 shrink-0">
        <input
          ref="fileInput"
          type="file"
          accept=".csv,text/csv"
          class="hidden"
          @change="onFileChange"
        />
        <!-- Import button -->
        <button
          class="btn btn-sm btn-primary w-full gap-2 kawaru-text-75"
          :disabled="isImporting"
          @click="fileInput?.click()"
        >
          <span v-if="isImporting" class="loading loading-spinner loading-xs" aria-hidden="true"></span>
          <SvgIcon v-else type="upload" class="w-4 h-4" />
          {{
            isImporting
              ? $t('vizworkbench.annotation.importing')
              : $t('vizworkbench.annotation.import')
          }}
        </button>

        <div v-if="spectrumMode !== 'centroid'" class="text-warning flex items-start gap-1.5">
          <SvgIcon type="warning" class="shrink-0 mt-0.5" />
          <span>{{ $t('vizworkbench.annotation.centroidOnly') }}</span>
        </div>
        <div v-else-if="!spectrumAvailable" class="text-warning flex items-start gap-1.5">
          <SvgIcon type="warning" class="shrink-0 mt-0.5" />
          <MzText :text="$t('vizworkbench.annotation.spectrumNotLoaded')" />
        </div>
        <div v-if="parseError" class="text-error flex items-start gap-1.5">
          <SvgIcon type="error" class="shrink-0 mt-0.5" />
          <span>{{ parseError }}</span>
        </div>

        <!-- Tolerance controls -->
        <div class="flex items-center gap-2">
          <span class="shrink-0 kawaru-text-75">{{ $t('vizworkbench.spectrum.tolerance') }}</span>
          <input
            v-model.number="tolValue"
            type="number"
            min="0"
            :step="tolStep"
            class="input input-bordered input-sm w-24 kawaru-text-75"
          />
          <select v-model="tolMode" class="select select-bordered select-sm ml-auto kawaru-text-75">
            <option value="ppm">ppm</option>
            <option value="Da">Da</option>
          </select>
        </div>

        <!-- Sort by -->
        <div class="flex items-center gap-2">
          <span class="shrink-0 kawaru-text-75">{{ $t('vizworkbench.annotation.sortBy') }}</span>
          <select
            :value="sortKey"
            class="select select-bordered select-sm flex-1 kawaru-text-75"
            @change="onSortKeyChange"
          >
            <option v-for="opt in SORT_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label() }}
            </option>
          </select>
          <button
            class="btn btn-outline btn-sm btn-square kawaru-text-75"
            :title="
              sortDir === 'asc'
                ? $t('vizworkbench.annotation.ascending')
                : $t('vizworkbench.annotation.descending')
            "
            @click="toggleSortDir"
          >
            <SvgIcon :type="sortDir === 'asc' ? 'chevron_up' : 'chevron_down'" />
          </button>
        </div>

        <!-- Search -->
        <!-- fluid=false: this panel has its own compact type scale, so don't
             apply the global fluid search font-size here. -->
        <SearchInput
          v-model="search"
          size="sm"
          :fluid="false"
          :placeholder="$t('vizworkbench.annotation.searchPlaceholder')"
        />
      </div>

      <!-- Counts + filter chips -->
      <div v-if="hasData" class="flex items-center justify-center gap-1.5 flex-wrap shrink-0">
        <button
          class="badge badge-sm kawaru-text-68 cursor-pointer transition-colors"
          :class="filter === 'all' ? 'badge-primary' : 'badge-ghost'"
          @click="filter = 'all'"
        >
          {{ $t('vizworkbench.annotation.countAll', { count: counts.total }) }}
        </button>
        <button
          class="badge badge-sm kawaru-text-68 cursor-pointer transition-colors"
          :class="filter === 'matched' ? 'badge-success badge-outline' : 'badge-ghost'"
          @click="filter = 'matched'"
        >
          {{ $t('vizworkbench.annotation.countMatched', { count: counts.matched }) }}
        </button>
        <button
          class="badge badge-sm kawaru-text-68 cursor-pointer transition-colors"
          :class="filter === 'unmatched' ? 'badge-warning badge-outline' : 'badge-ghost'"
          @click="filter = 'unmatched'"
        >
          {{
            $t('vizworkbench.annotation.countUnmatched', {
              count: counts.unmatched + counts.invalid,
            })
          }}
        </button>
        <!-- Level 4 开关：与状态/搜索过滤相交，只保留有同位素支持的匹配行 -->
        <button
          v-if="counts.level4 > 0"
          class="badge badge-sm kawaru-text-68 cursor-pointer transition-colors"
          :class="filterLevel4 ? 'badge-secondary' : 'badge-ghost'"
          :title="$t('vizworkbench.annotation.levelHint')"
          @click="filterLevel4 = !filterLevel4"
        >
          {{ $t('vizworkbench.annotation.level4Only', { count: counts.level4 }) }}
        </button>
      </div>

      <!-- Adduct / formula dropdown filters: intersect with status + search, so
           the user can multi-condition on candidate metadata (not just keyword
           search). Adduct sits on the first row, formula below it. -->
      <!-- Adduct + formula dropdown filters (one row); coarse-filter note below -->
      <div v-if="hasData" class="shrink-0 space-y-1">
        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-0.5 kawaru-text-75 min-w-0">
            <span class="text-base-content/60">{{ $t('vizworkbench.annotation.adduct') }}</span>
            <select
              v-model="filterAdduct"
              class="select select-bordered select-sm w-full kawaru-text-75"
            >
              <option value="">{{ $t('common.input.all') }}</option>
              <option v-for="opt in adductOptions" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-0.5 kawaru-text-75 min-w-0">
            <span class="text-base-content/60">{{ $t('vizworkbench.annotation.formula') }}</span>
            <select
              v-model="filterFormula"
              class="select select-bordered select-sm w-full kawaru-text-75"
            >
              <option value="">{{ $t('common.input.all') }}</option>
              <option v-for="opt in formulaOptions" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </label>
        </div>
        <!-- 匹配后粗筛掉的（极性 / m/z 范围），放到下拉筛选下方 -->
        <span
          v-if="coarseFiltered > 0"
          class="kawaru-text-68 text-base-content/50"
          :title="$t('vizworkbench.annotation.coarseHint')"
        >
          <MzText :text="$t('vizworkbench.annotation.coarseFiltered', { count: coarseFiltered })" />
        </span>
      </div>

      <!-- Loading state: parsing/matching a huge CSV blocks for seconds,
           so show a spinner instead of a blank panel. -->
      <div
        v-if="isImporting"
        class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 rounded-lg border border-base-300 bg-base-100"
      >
        <span class="loading loading-spinner loading-lg text-primary" aria-hidden="true"></span>
        <p class="kawaru-text-68 text-base-content/50">
          {{ $t('vizworkbench.annotation.parsing') }}
        </p>
      </div>

      <!-- Table: only Annotation + Exp. m/z (details on hover card).
           Virtual-scrolled: only the visible window is rendered so huge
           CSVs (hundreds of thousands of rows) don't OOM the tab.
           max-h-[60dvh] is load-bearing on small screens: the expanded panel is
           height-unbounded (h-auto), and without an explicit cap the spacer rows
           stretch the page to millions of px, the "viewport" becomes the full
           list and every row renders at once - the OOM this exists to prevent.
           On desktop the lg:h-full ancestors bound it, so it just fills the
           panel's flex column instead. -->
      <div
        v-else-if="hasData"
        ref="tableScrollEl"
        class="max-h-[60dvh] overflow-auto rounded-lg border border-base-300 bg-base-100 lg:max-h-none lg:flex-1 lg:min-h-0"
        @scroll.passive="onTableScroll"
      >
        <table class="table table-sm w-full table-fixed">
          <thead class="sticky top-0 z-10 bg-base-200 text-base-content/70">
            <tr>
              <th>{{ $t('vizworkbench.annotation.annotation') }}</th>
              <th class="text-right w-[120px]" :title="$t('vizworkbench.annotation.targetHint')">
                <MzText :text="$t('vizworkbench.annotation.target')" />
              </th>
            </tr>
          </thead>
          <tbody ref="tableBodyRef">
            <!-- Top spacer: keeps scrollbar proportional to the full list.
                 Height goes on an inner div: td height is content-box and not
                 reliably honored, a block child always is. -->
            <tr v-if="topPadH > 0" aria-hidden="true">
              <td colspan="2" :style="{ padding: 0, border: 0 }">
                <div :style="{ height: topPadH + 'px' }"></div>
              </td>
            </tr>
            <tr
              v-for="row in visibleRows"
              :key="row.id"
              data-row
              :data-mz-index="row.matchedIndex ?? undefined"
              :class="rowClass(row)"
              @click="selectRow(row)"
            >
              <td
                class="min-w-0 overflow-hidden"
                @mouseenter="onNameEnter(row, $event)"
                @mouseleave="onCellLeave"
              >
                <div class="flex items-center gap-1 min-w-0">
                  <div class="font-medium kawaru-text-95 text-base-content truncate flex-1">
                    {{ row.name }}
                  </div>
                  <!-- 置信等级徽章：4 = 精确质量 + 同位素支持；5 = 仅精确质量。
                       shrink-0 + 单行 flex 与 +N candidates 同模式，不破坏虚拟
                       滚动的统一行高。 -->
                  <span
                    v-if="row.level != null"
                    class="shrink-0 badge badge-xs badge-sm kawaru-text-68 font-mono"
                    :class="row.level === 4 ? 'badge-success' : 'badge-ghost'"
                    :title="$t('vizworkbench.annotation.levelHint')"
                    >{{ levelBadge(row.level) }}</span
                  >
                  <!-- 多加合物组徽章：M×n = 该分子以 n 种加合离子被观测，
                       悬停卡里可逐个跳转；Tier-2 空间反证（组内不共定位）
                       后转警告色并撤销加分。 -->
                  <span
                    v-if="row.adductPeerIds.length > 0"
                    class="shrink-0 badge badge-xs badge-sm kawaru-text-68 font-mono badge-outline"
                    :class="row.adductUnconfirmed ? 'badge-warning' : 'badge-accent'"
                    :title="
                      row.adductUnconfirmed
                        ? $t('vizworkbench.annotation.adductUnconfirmedHint')
                        : $t('vizworkbench.annotation.adductGroupHint', {
                            count: row.adductPeerIds.length + 1,
                          })
                    "
                    >{{ adductGroupBadge(row.adductPeerIds.length) }}</span
                  >
                </div>
                <!-- min-h-4 keeps one line box even when all three spans are
                     v-if'd out: the virtual scroll assumes a uniform row
                     height, and an empty subtitle would make this row ~20px
                     shorter than the measured rowH. -->
                <div class="min-h-4 kawaru-text-81 text-base-content/50 truncate">
                  <span v-if="row.formulaIon" class="font-mono">{{ row.formulaIon }}</span>
                  <span v-if="row.ionType" class="text-base-content/40"
                    >&nbsp;{{ row.ionType }}</span
                  >
                  <span v-if="row.candidates.length > 1" class="text-primary/50">
                    &#183; +{{ row.candidates.length - 1 }}</span
                  >
                </div>
              </td>
              <td
                class="text-right font-mono whitespace-nowrap kawaru-text-95"
                @mouseenter="onNameEnter(row, $event)"
                @mouseleave="onCellLeave"
              >
                {{ row.valid ? row.expMz.toFixed(6) : '-' }}
              </td>
            </tr>
            <!-- Bottom spacer (same block-height trick as the top one) -->
            <tr v-if="bottomPadH > 0" aria-hidden="true">
              <td colspan="2" :style="{ padding: 0, border: 0 }">
                <div :style="{ height: bottomPadH + 'px' }"></div>
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="!filteredRows.length"
          class="p-4 text-center kawaru-text-68 text-base-content/50"
        >
          <!-- counts.total === 0 means the coarse polarity / m/z-range
               pre-filter discarded the whole file at import, not the user's
               filter/search - say so instead of blaming the wrong control. -->
          <template v-if="counts.total === 0">
            <MzText :text="$t('vizworkbench.annotation.noUsableRows')" />
          </template>
          <template v-else>{{ $t('vizworkbench.annotation.noRowsMatch') }}</template>
        </div>
      </div>

      <!-- Empty state: nothing imported -->
      <div
        v-else
        class="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-center px-4"
      >
        <SvgIcon type="upload" class="w-8 h-8 text-base-content/30" />
        <p class="text-base-content/60">
          {{ $t('vizworkbench.annotation.emptyHint') }}
        </p>
        <p class="kawaru-text-68 text-base-content/40">
          {{ $t('vizworkbench.annotation.columns') }}
          <template v-for="(col, i) in CSV_COLUMNS" :key="col"
            >{{ i ? ', ' : ' ' }}<span class="font-mono"><MzText :text="col" /></span
          ></template>
        </p>
      </div>

      <!-- Drop overlay: visible while a file is dragged over the panel.
           pointer-events-none so dragleave isn't re-triggered by the overlay itself. -->
      <div
        v-if="dragActive"
        class="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-primary/15"
      >
        <SvgIcon type="upload" class="w-8 h-8 text-primary" />
        <p class="kawaru-text-81 font-medium text-primary">
          {{ $t('vizworkbench.annotation.dropHint') }}
        </p>
      </div>
    </div>
  </aside>

  <!-- Copyable hover card: name + PubChem (top-right), details below, candidates list.
       Fixed so not clipped by table overflow; placed to the right of the panel. -->
  <div
    v-if="tooltipRow"
    class="fixed z-[60] overflow-auto rounded-lg border border-base-300 bg-base-100 shadow-xl p-3 select-text kawaru-text-75"
    :style="{
      left: tooltipX + 'px',
      top: tooltipY + 'px',
      width: TOOLTIP_W + 'px',
      maxHeight: TOOLTIP_H + 'px',
    }"
    @mouseenter="onTooltipEnter"
    @mouseleave="onTooltipLeave"
  >
    <!-- Header: name on one line (truncate) + tiny copy icon at line end;
         PubChem is the tooltip's single primary action below. -->
    <div class="mb-1">
      <div class="flex items-center gap-0.5 min-w-0">
        <div
          class="min-w-0 flex-1 truncate font-semibold text-base-content"
          :title="tooltipRow.name"
        >
          {{ tooltipRow.name }}
        </div>
        <button
          class="shrink-0 p-0.5 text-base-content/40 hover:text-primary transition-colors"
          :title="$t('vizworkbench.annotation.copyName')"
          @click.stop="copyName(tooltipRow.name)"
        >
          <SvgIcon type="duplicate" />
        </button>
      </div>
      <!-- 加合离子在上、分子式在下 -->
      <div v-if="tooltipRow.ionType" class="font-mono text-base-content/60">
        {{ tooltipRow.ionType }}
      </div>
      <div v-if="tooltipRow.formulaIon" class="font-mono text-base-content/60">
        {{ tooltipRow.formulaIon }}
      </div>
      <button
        class="btn btn-sm btn-outline btn-primary gap-1 w-full justify-center mt-1.5 kawaru-text-75"
        :title="$t('vizworkbench.annotation.searchPubchem')"
        @click.stop="searchPubChem(tooltipRow.name)"
      >
        <SvgIcon type="search" />
        PubChem
      </button>
    </div>

    <!-- Detail fields moved from the table -->
    <div class="border-t border-base-content/15 pt-1.5 mt-1.5 space-y-1">
      <div class="flex items-center justify-between">
        <MzText class="text-base-content/50" :text="$t('vizworkbench.annotation.matched')" />
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block w-2 h-2 rounded-full"
            :class="
              tooltipRow.matchStatus === 'matched'
                ? 'bg-success'
                : tooltipRow.matchStatus === 'invalid'
                  ? 'bg-error'
                  : 'bg-base-300'
            "
          ></span>
          <span
            class="font-mono"
            :class="tooltipRow.matchedMz != null ? 'text-success/80' : 'text-base-content/30'"
            >{{ tooltipRow.matchedMz != null ? tooltipRow.matchedMz.toFixed(6) : '-' }}</span
          >
        </span>
      </div>
      <div class="flex items-center justify-between gap-2">
        <span class="text-base-content/50 shrink-0">{{
          $t('vizworkbench.annotation.massDifference')
        }}</span>
        <span
          class="font-mono truncate min-w-0 text-right"
          :title="`${formatMassError(tooltipRow.massError, tolMode)} ${tooltipRow.massError != null ? tolMode : ''}`"
          >{{ formatMassError(tooltipRow.massError, tolMode) }}
          {{ tooltipRow.massError != null ? tolMode : '' }}</span
        >
      </div>
      <div class="flex items-center justify-between">
        <span class="text-base-content/50">{{ $t('vizworkbench.spectrum.intensity') }}</span>
        <span class="font-mono">{{ formatIntensity(tooltipRow.avgIntensity) }}</span>
      </div>
      <!-- 评分（精简主区）：综合 / 等级 / FDR / MSM 是决策四件套，其余单项
           证据分折叠进"详细评分"；Tier-2 由 useAnnotationSpatialScoring 渐进
           填充（见 tooltipSpatial）。 -->
      <template v-if="tooltipRow.matchStatus === 'matched'">
        <div class="flex items-center justify-between">
          <span class="text-base-content/50">{{
            $t('vizworkbench.annotation.compositeScore')
          }}</span>
          <span class="font-mono font-semibold" :class="compositeClassOf(tooltipRow)">{{
            fmtScore(tooltipRow.compositeScore)
          }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-base-content/50">{{ $t('vizworkbench.annotation.level') }}</span>
          <span class="font-mono">{{
            tooltipRow.level != null ? `Level ${tooltipRow.level}` : '-'
          }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-base-content/50">{{ $t('vizworkbench.annotation.fdr') }}</span>
          <span class="font-mono">{{ fmtFdr(tooltipRow.fdr) }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-base-content/50">{{ $t('vizworkbench.annotation.msm') }}</span>
          <span
            v-if="tooltipSpatial"
            class="font-mono font-semibold"
            :class="corrClassOf(tooltipSpatial.msm)"
            >{{ fmtScore(tooltipSpatial.msm) }}</span
          >
          <span
            v-else-if="spatialPending"
            class="font-mono kawaru-text-68 text-base-content/40"
            :title="$t('vizworkbench.annotation.spatialPending')"
          >
            {{ spatialProgress.done }}/{{ spatialProgress.total }}
          </span>
          <span v-else class="font-mono text-base-content/30">-</span>
        </div>

        <!-- 同位素峰跳转：理论包络锚定在本行匹配峰；可点击的峰（轴上容差
             窗口内有采样点）走页面既有 selectMzIndex 入口联动离子图+谱图。 -->
        <div v-if="tooltipIsotopePeaks && tooltipIsotopePeaks.length > 0" class="pt-1">
          <div
            class="text-base-content/50 mb-1"
            :title="$t('vizworkbench.annotation.isotopeJumpHint')"
          >
            {{ $t('vizworkbench.annotation.isotopePeaks') }}
          </div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="(p, i) in tooltipIsotopePeaks"
              :key="i"
              type="button"
              class="btn btn-xs btn-ghost font-mono kawaru-text-68"
              :class="p.jumpIndex == null ? 'opacity-40 pointer-events-none' : 'hover:text-primary'"
              :title="`${p.mz.toFixed(4)} · ${(p.rel * 100).toFixed(1)}%`"
              @click.stop="jumpToIsotope(p)"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <!-- 同分子加合物组：chips 点击跳到 peer 行；r = 组内图像共定位
             （≥ 0.7 绿色确认，低于阈值警告色提示加分存疑）。 -->
        <div v-if="tooltipRow.adductPeerIds.length > 0" class="pt-1">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span
              class="text-base-content/50 truncate"
              :title="
                $t('vizworkbench.annotation.adductGroupHint', {
                  count: tooltipRow.adductPeerIds.length + 1,
                })
              "
              >{{ $t('vizworkbench.annotation.adductGroup') }}</span
            >
            <span
              v-if="tooltipAdductCorr != null"
              class="font-mono kawaru-text-68 shrink-0"
              :class="tooltipAdductCorr >= adductCorrMin ? 'text-success/80' : 'text-warning'"
              :title="$t('vizworkbench.annotation.adductCorrHint')"
              >{{ fmtCorr(tooltipAdductCorr) }}</span
            >
          </div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="peer in tooltipAdductPeers"
              :key="peer.row.id"
              type="button"
              class="btn btn-xs btn-outline font-mono kawaru-text-68 gap-1"
              :title="(peer.row.matchedMz ?? peer.row.expMz).toFixed(4)"
              @click.stop="jumpToAdductPeer(peer.row)"
            >
              {{ peer.row.ionType ?? peer.row.formulaIon ?? peer.row.name }}
              <span
                v-if="peer.corr != null"
                class="font-mono"
                :class="peer.corr >= adductCorrMin ? 'text-success/80' : 'text-warning'"
                >{{ peer.corr.toFixed(2) }}</span
              >
            </button>
          </div>
        </div>

        <!-- 详细评分（默认折叠）：单项证据分 -->
        <details class="group pt-1">
          <summary
            class="cursor-pointer select-none text-base-content/50 kawaru-text-68 list-none [&::-webkit-details-marker]:hidden flex items-center gap-1"
          >
            <SvgIcon
              type="chevron_down"
              class="w-3 h-3 transition-transform group-open:rotate-180"
            />
            {{ $t('vizworkbench.annotation.detailScores') }}
          </summary>
          <div class="space-y-1 pt-1">
            <div class="flex items-center justify-between">
              <span class="text-base-content/50">{{
                $t('vizworkbench.annotation.massScore')
              }}</span>
              <span class="font-mono">{{ fmtScore(tooltipRow.massScore) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-base-content/50">{{
                $t('vizworkbench.annotation.isotopeScore')
              }}</span>
              <span class="flex items-center gap-1.5 min-w-0">
                <span
                  v-if="tooltipRow.isotopeObsCount != null"
                  class="kawaru-text-68 text-base-content/40"
                  >{{
                    $t('vizworkbench.annotation.isotopeObs', {
                      obs: tooltipRow.isotopeObsCount,
                      exp: isotopeExpectedOf(tooltipRow),
                    })
                  }}</span
                >
                <span class="font-mono">{{ fmtScore(tooltipRow.isotopeScore) }}</span>
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span
                class="text-base-content/50"
                :title="$t('vizworkbench.annotation.adductScoreHint')"
                >{{ $t('vizworkbench.annotation.adductScore') }}</span
              >
              <span class="font-mono" :class="corrClassOf(tooltipRow.adductScore)">{{
                fmtScore(tooltipRow.adductScore)
              }}</span>
            </div>
            <template v-if="tooltipSpatial">
              <div class="flex items-center justify-between">
                <span class="text-base-content/50">{{ $t('vizworkbench.annotation.chaos') }}</span>
                <span class="font-mono">{{ fmtScore(tooltipSpatial.chaos) }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-base-content/50">{{
                  $t('vizworkbench.annotation.spatialScore')
                }}</span>
                <span class="font-mono" :class="corrClassOf(tooltipSpatial.spatial)">{{
                  fmtScore(tooltipSpatial.spatial)
                }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-base-content/50">{{
                  $t('vizworkbench.annotation.spectralScore')
                }}</span>
                <span class="font-mono">{{ fmtScore(tooltipSpatial.spectral) }}</span>
              </div>
            </template>
          </div>
        </details>
      </template>
      <div
        v-if="tooltipRow.isotopeScore == null && tooltipRow.matchStatus === 'matched'"
        class="kawaru-text-68 text-base-content/40"
      >
        {{ $t('vizworkbench.annotation.isotopeUnavailable') }}
      </div>
    </div>

    <!-- Candidates list with per-candidate PubChem lookup -->
    <div v-if="tooltipRow.candidates.length" class="border-t border-base-content/15 pt-1.5 mt-1.5">
      <div class="text-base-content/50 mb-1">
        {{ $t('vizworkbench.annotation.candidates', { count: tooltipRow.candidates.length }) }}
      </div>
      <ul class="space-y-0.5">
        <li
          v-for="(c, i) in tooltipRow.candidates"
          :key="i"
          class="text-base-content flex items-center justify-between gap-1"
        >
          <span class="truncate select-text kawaru-text-87">{{ c }}</span>
          <button
            class="btn btn-ghost btn-xs shrink-0 btn-square text-base-content/40 hover:text-primary hover:bg-primary/10 kawaru-text-68"
            :title="$t('vizworkbench.annotation.searchPubchem')"
            @click.stop="searchPubChem(c)"
          >
            <SvgIcon type="search" class="text-primary" />
          </button>
        </li>
      </ul>
    </div>
  </div>

  <!-- PubChem result dialog -->
  <PubChemDialog :open="pubchemOpen" :query="pubchemQuery" @close="pubchemOpen = false" />
</template>
