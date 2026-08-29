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
import { computed, nextTick, ref, watch } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import {
  useAnnotationMatch,
  type AnnotationSortKey,
} from '@/features/vizworkbench/composables/useAnnotationMatch'
import {
  formatMassError,
  formatIntensity,
  type MatchedAnnotationRow,
} from '@/features/vizworkbench/utils/csvAnnotation'
import PubChemDialog from '@/features/vizworkbench/components/PubChemDialog.vue'
import { scrollIntoContainer } from '@/features/vizworkbench/utils/scrollIntoContainer'
import { useToast } from '@/shared/composables/useToast'

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
  filterAdduct,
  filterFormula,
  adductOptions,
  formulaOptions,
  sortKey,
  sortDir,
  filteredRows,
  importFile,
  clear,
  selectRow,
  exportMatchedCsv,
} = useAnnotationMatch((idx) => props.selectMzIndex(idx))

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
const isAnnotationAvailable = computed(
  () => props.spectrumMode === 'centroid' && spectrumAvailable.value,
)

function isActive(row: { matchedIndex: number | null }): boolean {
  return row.matchedIndex != null && row.matchedIndex === props.selectedMzIndex
}

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

const SORT_OPTIONS: { value: AnnotationSortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'expMz', label: 'Target m/z' },
  { value: 'massError', label: 'Mass Difference' },
  { value: 'avgIntensity', label: 'Intensity' },
]

function onSortKeyChange(e: Event) {
  sortKey.value = (e.target as HTMLSelectElement).value as AnnotationSortKey
  sortDir.value = 'asc' // reset to ascending on field change
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
    showToast('Please drop a .csv annotation file.', 'error')
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

function onTableScroll(e: Event) {
  const el = e.target as HTMLElement
  scrollTop.value = el.scrollTop
  viewportH.value = el.clientHeight
  // Rows scrolled out of the window never fire mouseleave, so dismiss the
  // hover card here or it lingers at stale coordinates.
  dismissTooltip()
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
const visibleRows = computed(() => filteredRows.value.slice(visibleStart.value, visibleEnd.value))
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
      title="Expand annotation panel"
      @click="expand"
    >
      <span class="text-[1.2em] font-semibold">Annotations</span>
      <SvgIcon type="chevron_down" />
    </button>

    <!-- Collapsed rail (desktop only): click to expand -->
    <div
      v-show="!expanded"
      class="hidden h-full w-full cursor-pointer flex-col items-center justify-center gap-2 py-3 hover:bg-base-200/60 lg:flex"
      title="Expand annotation panel"
      @click="expand"
    >
      <SvgIcon type="chevron_right" />
      <span class="[writing-mode:vertical-rl] text-[1.1em] font-medium tracking-wide">
        Annotations
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
          <h3 class="text-[1.125em] font-semibold text-base-content leading-tight">Annotations</h3>
          <p v-if="fileName" class="text-[0.875em] text-base-content/50 truncate" :title="fileName">
            {{ fileName }}
          </p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            v-if="hasData"
            class="btn btn-ghost btn-xs btn-square"
            :class="{ 'btn-disabled opacity-40': !counts.matched }"
            title="Export matched annotations (name, target m/z, matched m/z, mass difference) as CSV"
            :disabled="!counts.matched"
            @click="exportMatchedCsv"
          >
            <SvgIcon type="download" />
          </button>
          <button
            v-if="hasData"
            class="btn btn-ghost btn-xs btn-square"
            title="Clear imported annotations"
            @click="clear"
          >
            <SvgIcon type="trash" />
          </button>
          <button class="btn btn-ghost btn-xs btn-square" title="Collapse" @click="collapse">
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
          class="btn btn-sm btn-primary w-full gap-2 text-[1em]"
          :disabled="isImporting"
          @click="fileInput?.click()"
        >
          <span
            v-if="isImporting"
            class="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent will-change-transform"
            aria-hidden="true"
          ></span>
          <SvgIcon v-else type="upload" class="w-4 h-4" />
          {{ isImporting ? 'Importing…' : 'Import CSV' }}
        </button>

        <div v-if="spectrumMode !== 'centroid'" class="text-warning flex items-start gap-1.5">
          <SvgIcon type="warning" class="shrink-0 mt-0.5" />
          <span>Annotation is only available for continuous centroid data.</span>
        </div>
        <div v-else-if="!spectrumAvailable" class="text-warning flex items-start gap-1.5">
          <SvgIcon type="warning" class="shrink-0 mt-0.5" />
          <span>Average spectrum not loaded - <i>m/z</i> matching unavailable for this result.</span>
        </div>
        <div v-if="parseError" class="text-error flex items-start gap-1.5">
          <SvgIcon type="error" class="shrink-0 mt-0.5" />
          <span>{{ parseError }}</span>
        </div>

        <!-- Tolerance controls -->
        <div class="flex items-center gap-2">
          <span class="shrink-0 text-[1em]">Tolerance</span>
          <input
            v-model.number="tolValue"
            type="number"
            min="0"
            :step="tolStep"
            class="input input-bordered input-sm w-24 text-[1em]"
          />
          <select v-model="tolMode" class="select select-bordered select-sm ml-auto text-[1em]">
            <option value="ppm">ppm</option>
            <option value="Da">Da</option>
          </select>
        </div>

        <!-- Sort by -->
        <div class="flex items-center gap-2">
          <span class="shrink-0 text-[1em]">Sort by</span>
          <select
            :value="sortKey"
            class="select select-bordered select-sm flex-1 text-[1em]"
            @change="onSortKeyChange"
          >
            <option v-for="opt in SORT_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <button
            class="btn btn-outline btn-sm btn-square"
            :title="
              sortDir === 'asc'
                ? 'Ascending (click for descending)'
                : 'Descending (click for ascending)'
            "
            @click="toggleSortDir"
          >
            <SvgIcon :type="sortDir === 'asc' ? 'chevron_up' : 'chevron_down'" />
          </button>
        </div>

        <!-- Search -->
        <div class="relative">
          <SvgIcon
            type="search"
            class="text-base-content/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            v-model="search"
            type="text"
            placeholder="Search name / formula / m/z"
            class="input input-bordered input-sm w-full pl-8 text-[1em]"
          />
        </div>
      </div>

      <!-- Counts + filter chips -->
      <div v-if="hasData" class="flex items-center justify-center gap-1.5 flex-wrap shrink-0">
        <button
          class="badge badge-sm text-[0.875em] cursor-pointer transition-colors"
          :class="filter === 'all' ? 'badge-primary' : 'badge-ghost'"
          @click="filter = 'all'"
        >
          All {{ counts.total }}
        </button>
        <button
          class="badge badge-sm text-[0.875em] cursor-pointer transition-colors"
          :class="filter === 'matched' ? 'badge-success badge-outline' : 'badge-ghost'"
          @click="filter = 'matched'"
        >
          Matched {{ counts.matched }}
        </button>
        <button
          class="badge badge-sm text-[0.875em] cursor-pointer transition-colors"
          :class="filter === 'unmatched' ? 'badge-warning badge-outline' : 'badge-ghost'"
          @click="filter = 'unmatched'"
        >
          Unmatched {{ counts.unmatched + counts.invalid }}
        </button>
      </div>

      <!-- Adduct / formula dropdown filters: intersect with status + search, so
           the user can multi-condition on candidate metadata (not just keyword
           search). Adduct sits on the first row, formula below it. -->
      <!-- Adduct + formula dropdown filters (one row); coarse-filter note below -->
      <div v-if="hasData" class="shrink-0 space-y-1">
        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-0.5 text-[1em] min-w-0">
            <span class="text-base-content/60">Adduct</span>
            <select v-model="filterAdduct" class="select select-bordered select-sm w-full text-[1em]">
              <option value="">All</option>
              <option v-for="opt in adductOptions" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-0.5 text-[1em] min-w-0">
            <span class="text-base-content/60">Formula</span>
            <select v-model="filterFormula" class="select select-bordered select-sm w-full text-[1em]">
              <option value="">All</option>
              <option v-for="opt in formulaOptions" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </label>
        </div>
        <!-- 匹配后粗筛掉的（极性 / m/z 范围），放到下拉筛选下方 -->
        <span
          v-if="coarseFiltered > 0"
          class="text-[0.875em] text-base-content/50"
          title="Rows dropped before matching because their adduct/formula implies the opposite polarity, or their m/z lies outside the spectrum's range"
        >
          {{ coarseFiltered }} filtered by polarity / m/z range
        </span>
      </div>

      <!-- Loading state: parsing/matching a huge CSV blocks for seconds,
           so show a spinner instead of a blank panel. -->
      <div
        v-if="isImporting"
        class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 rounded-lg border border-base-300 bg-base-100"
      >
        <span
          class="inline-block size-9 animate-spin rounded-full border-4 border-current border-t-transparent text-primary will-change-transform"
          aria-hidden="true"
        ></span>
        <p class="text-[0.875em] text-base-content/50">Parsing and matching annotations…</p>
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
              <th>Annotation</th>
              <th class="text-right w-[120px]" title="Target m/z from the CSV">Target <i>m/z</i></th>
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
                <div class="font-medium text-[1.25em] text-base-content truncate">{{ row.name }}</div>
                <!-- min-h-4 keeps one line box even when all three spans are
                     v-if'd out: the virtual scroll assumes a uniform row
                     height, and an empty subtitle would make this row ~20px
                     shorter than the measured rowH. -->
                <div class="min-h-4 text-[1.125em] text-base-content/50 truncate">
                  <span v-if="row.formulaIon" class="font-mono">{{ row.formulaIon }}</span>
                  <span v-if="row.ionType" class="text-base-content/40">&nbsp;{{ row.ionType }}</span>
                  <span v-if="row.candidates.length > 1" class="text-primary/50">
                    &#183; +{{ row.candidates.length - 1 }}</span
                  >
                </div>
              </td>
              <td
                class="text-right font-mono whitespace-nowrap text-[1.25em]"
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
        <div v-if="!filteredRows.length" class="p-4 text-center text-[0.875em] text-base-content/50">
          <!-- counts.total === 0 means the coarse polarity / m/z-range
               pre-filter discarded the whole file at import, not the user's
               filter/search - say so instead of blaming the wrong control. -->
          <template v-if="counts.total === 0">
            No usable rows: every row was filtered out by the result's polarity / m/z range.
          </template>
          <template v-else>No rows match the current filter / search.</template>
        </div>
      </div>

      <!-- Empty state: nothing imported -->
      <div
        v-else
        class="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-center px-4"
      >
        <SvgIcon type="upload" class="w-8 h-8 text-base-content/30" />
        <p class="text-base-content/60">
          Import an annotation CSV to match against the average spectrum.
        </p>
        <p class="text-[0.875em] text-base-content/40">
          Columns: <span class="font-mono">Exp. m/z</span>,
          <span class="font-mono">Candidate_1..5</span>, <span class="font-mono">formula_ion</span>,
          <span class="font-mono">Ion type</span>
        </p>
      </div>

      <!-- Drop overlay: visible while a file is dragged over the panel.
           pointer-events-none so dragleave isn't re-triggered by the overlay itself. -->
      <div
        v-if="dragActive"
        class="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center gap-2
               rounded-lg border-2 border-dashed border-primary bg-primary/15"
      >
        <SvgIcon type="upload" class="w-8 h-8 text-primary" />
        <p class="text-[1.125em] font-medium text-primary">Drop CSV to import annotations</p>
      </div>
    </div>
  </aside>

  <!-- Copyable hover card: name + PubChem (top-right), details below, candidates list.
       Fixed so not clipped by table overflow; placed to the right of the panel. -->
  <div
    v-if="tooltipRow"
    class="fixed z-[60] overflow-auto rounded-lg border border-base-300 bg-base-100 shadow-xl p-3 select-text text-[1em]"
    :style="{
      left: tooltipX + 'px',
      top: tooltipY + 'px',
      width: TOOLTIP_W + 'px',
      maxHeight: TOOLTIP_H + 'px',
    }"
    @mouseenter="onTooltipEnter"
    @mouseleave="onTooltipLeave"
  >
    <!-- Header: name (left) + copy/PubChem buttons (right) -->
    <div class="mb-1">
      <div
        class="font-semibold text-base-content truncate"
        :title="tooltipRow.name"
      >
        {{ tooltipRow.name }}
      </div>
      <!-- 加合离子在上、分子式在下 -->
      <div v-if="tooltipRow.ionType" class="font-mono text-base-content/60">
        {{ tooltipRow.ionType }}
      </div>
      <div v-if="tooltipRow.formulaIon" class="font-mono text-base-content/60">
        {{ tooltipRow.formulaIon }}
      </div>
      <!-- 复制 + PubChem 放在名字/内容下方（统一按钮尺寸/样式） -->
      <div class="mt-1.5 flex items-center gap-1.5">
        <button
          class="btn btn-sm btn-outline gap-1"
          title="Copy name"
          @click.stop="copyName(tooltipRow.name)"
        >
          <SvgIcon type="duplicate" class="" />
          Copy
        </button>
        <button
          class="btn btn-sm btn-outline btn-primary gap-1 text-[1em]"
          title="Search PubChem"
          @click.stop="searchPubChem(tooltipRow.name)"
        >
          <SvgIcon type="search" class="" />
          PubChem
        </button>
      </div>
    </div>

    <!-- Detail fields moved from the table -->
    <div class="border-t border-base-content/15 pt-1.5 mt-1.5 space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-base-content/50">Matched <i>m/z</i></span>
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
        <span class="text-base-content/50 shrink-0">Mass Difference</span>
        <span
          class="font-mono truncate min-w-0 text-right"
          :title="`${formatMassError(tooltipRow.massError, tolMode)} ${tooltipRow.massError != null ? tolMode : ''}`"
          >{{ formatMassError(tooltipRow.massError, tolMode) }}
          {{ tooltipRow.massError != null ? tolMode : '' }}</span
        >
      </div>
      <div class="flex items-center justify-between">
        <span class="text-base-content/50">Intensity</span>
        <span class="font-mono">{{ formatIntensity(tooltipRow.avgIntensity) }}</span>
      </div>
    </div>

    <!-- Candidates list with per-candidate PubChem lookup -->
    <div v-if="tooltipRow.candidates.length" class="border-t border-base-content/15 pt-1.5 mt-1.5">
      <div class="text-base-content/50 mb-1">
        Candidates ({{ tooltipRow.candidates.length }})
      </div>
      <ul class="space-y-0.5">
        <li
          v-for="(c, i) in tooltipRow.candidates"
          :key="i"
          class="text-base-content flex items-center justify-between gap-1"
        >
          <span class="truncate select-text">{{ c }}</span>
          <button
            class="btn btn-ghost btn-xs shrink-0 btn-square text-base-content/40 hover:text-primary hover:bg-primary/10"
            title="Search PubChem"
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
