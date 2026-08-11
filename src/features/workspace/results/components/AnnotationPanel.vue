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
import { useAnnotationMatch, type AnnotationSortKey } from '@/features/workspace/results/composables/useAnnotationMatch'
import { formatMassError, formatIntensity, type MatchedAnnotationRow } from '@/features/workspace/results/utils/csvAnnotation'
import PubChemDialog from '@/features/workspace/results/components/PubChemDialog.vue'
import { scrollIntoContainer } from '@/features/workspace/results/utils/scrollIntoContainer'
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
  importedRows,
  fileName,
  parseError,
  tolMode,
  tolValue,
  spectrumAvailable,
  counts,
  search,
  filter,
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

const hasData = computed(() => importedRows.value.length > 0)

function isActive(row: { matchedIndex: number | null }): boolean {
  return row.matchedIndex != null && row.matchedIndex === props.selectedMzIndex
}

function rowClass(row: {
  matchStatus: string
  matchedIndex: number | null
}): string {
  const active = isActive(row)
  if (row.matchStatus === 'matched') {
    return active
      ? 'bg-primary/20 cursor-pointer'
      : 'hover:bg-base-200/70 cursor-pointer'
  }
  return active ? 'bg-primary/10' : 'opacity-60'
}

/** Step for the tolerance <input>, finer in Da mode. */
const tolStep = computed(() => (tolMode.value === 'ppm' ? 0.5 : 0.001))

// ---- Sort control (moved from table headers into the toolbar) ----

const SORT_OPTIONS: { value: AnnotationSortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'expMz', label: 'Tar. m/z' },
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

function onCellEnter(row: MatchedAnnotationRow, e: MouseEvent) {
  if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = 0 }
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

function onTooltipEnter() {
  if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = 0 }
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
  <!-- Mobile floating open button (only when collapsed, small screens) -->
  <button
    v-show="!expanded"
    class="lg:hidden fixed left-3 bottom-6 z-40 btn btn-circle btn-primary shadow-lg"
    title="Open annotation panel"
    @click="expand"
  >
    <SvgIcon type="bars3" class="w-5 h-5" />
  </button>

  <!-- The panel: mobile = fixed drawer, desktop = flex column w/ width transition -->
  <aside
    class="flex flex-col bg-base-100 border border-base-300 rounded-xl shadow-sm overflow-hidden
           fixed top-2 bottom-2 left-2 z-50 w-[86vw] max-w-[340px]
           transition-transform duration-200 ease-out
           lg:static lg:z-auto lg:top-auto lg:bottom-auto lg:left-auto
           lg:max-w-none lg:h-full lg:translate-x-0 lg:shrink-0 lg:transition-[width]"
    :class="expanded ? 'translate-x-0 lg:w-[340px]' : '-translate-x-[105%] lg:w-11'"
  >
    <!-- Collapsed rail (desktop only): click to expand -->
    <div
      v-show="!expanded"
      class="hidden lg:flex h-full w-full flex-col items-center justify-center gap-2 py-3 cursor-pointer hover:bg-base-200/60"
      title="Expand annotation panel"
      @click="expand"
    >
      <SvgIcon type="chevron_right" class="w-5 h-5 text-base-content/70" />
      <span class="[writing-mode:vertical-rl] text-base text-base-content/70 font-medium tracking-wide">Annotations</span>
    </div>

    <!-- Expanded content (also a CSV drop target) -->
    <div
      v-show="expanded"
      class="relative flex flex-col h-full min-h-0 p-3 gap-2"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <!-- Header -->
      <div class="flex items-center justify-between gap-2 shrink-0">
        <div class="min-w-0">
          <h3 class="text-xl font-semibold text-base-content leading-tight">Annotations</h3>
          <p v-if="fileName" class="text-base text-base-content/50 truncate" :title="fileName">{{ fileName }}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            v-if="hasData"
            class="btn btn-ghost btn-xs btn-square"
            :class="{ 'btn-disabled opacity-40': !counts.matched }"
            title="Export matched annotations (name, tar. m/z, matched m/z, mass difference) as CSV"
            :disabled="!counts.matched"
            @click="exportMatchedCsv"
          >
            <SvgIcon type="download" class="w-4 h-4" />
          </button>
          <button
            v-if="hasData"
            class="btn btn-ghost btn-xs btn-square"
            title="Clear imported annotations"
            @click="clear"
          >
            <SvgIcon type="trash" class="w-4 h-4" />
          </button>
          <button class="btn btn-ghost btn-xs btn-square" title="Collapse" @click="collapse">
            <SvgIcon type="chevron_right" class="w-4 h-4 rotate-180" />
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
        <button
          class="btn btn-sm btn-primary w-full gap-2 text-base"
          @click="fileInput?.click()"
        >
          <SvgIcon type="upload" class="w-4 h-4" />
          Import CSV
        </button>
        <p class="text-center text-base text-base-content/40">or drag &amp; drop a CSV anywhere on this panel</p>

        <div v-if="spectrumMode !== 'centroid'" class="text-base text-warning flex items-start gap-1.5">
          <SvgIcon type="warning" class="w-4 h-4 shrink-0 mt-0.5" />
          <span>Annotation is only available for continuous centroid data.</span>
        </div>
        <div v-else-if="!spectrumAvailable" class="text-base text-warning flex items-start gap-1.5">
          <SvgIcon type="warning" class="w-4 h-4 shrink-0 mt-0.5" />
          <span>Average spectrum not loaded - <i>m/z</i> matching unavailable for this result.</span>
        </div>
        <div v-if="parseError" class="text-base text-error flex items-start gap-1.5">
          <SvgIcon type="error" class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ parseError }}</span>
        </div>

        <!-- Tolerance controls -->
        <div class="flex items-center gap-2">
          <span class="text-base text-base-content/60 shrink-0">Tolerance</span>
          <input
            v-model.number="tolValue"
            type="number"
            min="0"
            :step="tolStep"
            class="input input-bordered input-sm w-20 text-base"
          />
          <select v-model="tolMode" class="select select-bordered select-sm ml-auto text-base">
            <option value="ppm">ppm</option>
            <option value="Da">Da</option>
          </select>
        </div>

        <!-- Sort by -->
        <div class="flex items-center gap-2">
          <span class="text-base text-base-content/60 shrink-0">Sort by</span>
          <select
            :value="sortKey"
            class="select select-bordered select-sm flex-1 text-base"
            @change="onSortKeyChange"
          >
            <option v-for="opt in SORT_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <button
            class="btn btn-outline btn-sm btn-square shrink-0"
            :title="sortDir === 'asc' ? 'Ascending (click for descending)' : 'Descending (click for ascending)'"
            @click="toggleSortDir"
          >
            <SvgIcon :type="sortDir === 'asc' ? 'chevron_up' : 'chevron_down'" class="w-4 h-4" />
          </button>
        </div>

        <!-- Search -->
        <div class="relative">
          <SvgIcon
            type="search"
            class="w-4 h-4 text-base-content/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            v-model="search"
            type="text"
            placeholder="Search name / formula / m/z"
            class="input input-bordered input-sm w-full pl-8 text-base"
          />
        </div>
      </div>

      <!-- Counts + filter chips -->
      <div v-if="hasData" class="flex items-center justify-center gap-1.5 flex-wrap shrink-0">
        <button
          class="badge badge-sm text-sm cursor-pointer transition-colors"
          :class="filter === 'all' ? 'badge-primary' : 'badge-ghost'"
          @click="filter = 'all'"
        >
          All {{ counts.total }}
        </button>
        <button
          class="badge badge-sm text-sm cursor-pointer transition-colors"
          :class="filter === 'matched' ? 'badge-success badge-outline' : 'badge-ghost'"
          @click="filter = 'matched'"
        >
          Matched {{ counts.matched }}
        </button>
        <button
          class="badge badge-sm text-sm cursor-pointer transition-colors"
          :class="filter === 'unmatched' ? 'badge-warning badge-outline' : 'badge-ghost'"
          @click="filter = 'unmatched'"
        >
          Unmatched {{ counts.unmatched + counts.invalid }}
        </button>
      </div>

      <!-- Table: only Annotation + Exp. m/z (details on hover card) -->
      <div
        v-if="hasData"
        ref="tableScrollRef"
        class="flex-1 min-h-0 overflow-auto rounded-lg border border-base-300 bg-base-100"
      >
        <table class="table table-sm">
          <thead class="sticky top-0 z-10 bg-base-200 text-base-content/70">
            <tr>
              <th>Annotation</th>
              <th class="text-right" title="Target m/z from the CSV">Tar. <i>m/z</i></th>
            </tr>
          </thead>
          <tbody ref="tableBodyRef">
            <tr
              v-for="row in filteredRows"
              :key="row.id"
              :data-mz-index="row.matchedIndex ?? undefined"
              :class="rowClass(row)"
              @click="selectRow(row)"
            >
              <td
                class="min-w-0 max-w-[200px]"
                @mouseenter="onCellEnter(row, $event)"
                @mouseleave="onCellLeave"
              >
                <div class="font-medium text-base text-base-content truncate">{{ row.name }}</div>
                <div class="text-base text-base-content/50 truncate">
                  <span v-if="row.formulaIon" class="font-mono">{{ row.formulaIon }}</span>
                  <span v-if="row.ionType" class="text-base-content/40"> &#183; {{ row.ionType }}</span>
                  <span v-if="row.candidates.length > 1" class="text-primary/50"> &#183; +{{ row.candidates.length - 1 }}</span>
                </div>
              </td>
              <td
                class="text-right font-mono whitespace-nowrap text-base"
                @mouseenter="onCellEnter(row, $event)"
                @mouseleave="onCellLeave"
              >
                {{ row.valid ? row.expMz.toFixed(4) : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!filteredRows.length" class="p-4 text-center text-base text-base-content/50">
          No rows match the current filter / search.
        </div>
      </div>

      <!-- Empty state: nothing imported -->
      <div
        v-else
        class="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-center px-4"
      >
        <SvgIcon type="upload" class="w-8 h-8 text-base-content/30" />
        <p class="text-lg text-base-content/60">Import an annotation CSV to match against the average spectrum.</p>
        <p class="text-base text-base-content/40">You can also drag &amp; drop the file anywhere on this panel.</p>
        <p class="text-base text-base-content/40">
          Columns: <span class="font-mono">Tar. <i>m/z</i></span>, <span class="font-mono">Candidate_1..5</span>,
          <span class="font-mono">formula_ion</span>, <span class="font-mono">Ion type</span>
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
        <p class="text-lg font-medium text-primary">Drop CSV to import annotations</p>
      </div>
    </div>
  </aside>

  <!-- Copyable hover card: name + PubChem (top-right), details below, candidates list.
       Fixed so not clipped by table overflow; placed to the right of the panel. -->
  <div
    v-if="tooltipRow"
    class="fixed z-[60] overflow-auto rounded-lg border border-base-300 bg-base-100 shadow-xl p-3 text-base select-text"
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
    <div class="flex items-start justify-between gap-2 mb-1">
      <div class="min-w-0 flex-1">
        <div class="font-semibold text-base-content break-words">{{ tooltipRow.name }}</div>
        <div v-if="tooltipRow.formulaIon" class="text-base font-mono text-base-content/60">
          {{ tooltipRow.formulaIon }}
          <span v-if="tooltipRow.ionType"> &#183; {{ tooltipRow.ionType }}</span>
        </div>
        <button
          class="btn btn-ghost btn-xs shrink-0 btn-square opacity-60 hover:opacity-100 mt-0.5"
          title="Copy name"
          @click.stop="copyName(tooltipRow.name)"
        >
          <SvgIcon type="duplicate" class="w-3.5 h-3.5" />
        </button>
      </div>
      <button
        class="btn btn-sm btn-outline btn-primary gap-1 shrink-0 text-base"
        title="Search PubChem"
        @click.stop="searchPubChem(tooltipRow.name)"
      >
        <SvgIcon type="search" class="w-3.5 h-3.5" />
        PubChem
      </button>
    </div>

    <!-- Detail fields moved from the table -->
    <div class="border-t border-base-content/15 pt-1.5 mt-1.5 space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-base-content/50">Matched <i>m/z</i></span>
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block w-2 h-2 rounded-full"
            :class="tooltipRow.matchStatus === 'matched' ? 'bg-success' : tooltipRow.matchStatus === 'invalid' ? 'bg-error' : 'bg-base-300'"
          ></span>
          <span
            class="font-mono"
            :class="tooltipRow.matchedMz != null ? 'text-success/80' : 'text-base-content/30'"
          >{{ tooltipRow.matchedMz != null ? tooltipRow.matchedMz.toFixed(4) : '-' }}</span>
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-base-content/50">Mass Difference</span>
        <span class="font-mono">{{ formatMassError(tooltipRow.massError, tolMode) }} {{ tooltipRow.massError != null ? tolMode : '' }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-base-content/50">Intensity</span>
        <span class="font-mono">{{ formatIntensity(tooltipRow.avgIntensity) }}</span>
      </div>
    </div>

    <!-- Candidates list with per-candidate PubChem lookup -->
    <div v-if="tooltipRow.candidates.length" class="border-t border-base-content/15 pt-1.5 mt-1.5">
      <div class="text-base text-base-content/50 mb-1">
        Candidates ({{ tooltipRow.candidates.length }})
      </div>
      <ul class="space-y-0.5">
        <li
          v-for="(c, i) in tooltipRow.candidates"
          :key="i"
          class="text-base text-base-content flex items-center justify-between gap-1 group"
        >
          <span class="truncate select-text">{{ c }}</span>
          <button
            class="btn btn-ghost btn-xs shrink-0 btn-square opacity-0 group-hover:opacity-100 transition-opacity"
            title="Search PubChem"
            @click.stop="searchPubChem(c)"
          >
            <SvgIcon type="search" class="w-3.5 h-3.5 text-primary" />
          </button>
        </li>
      </ul>
    </div>
  </div>

  <!-- PubChem result dialog -->
  <PubChemDialog
    :open="pubchemOpen"
    :query="pubchemQuery"
    @close="pubchemOpen = false"
  />

  <!-- Mobile backdrop -->
  <div
    v-if="expanded"
    class="lg:hidden fixed inset-0 bg-black/40 z-40"
    @click="collapse"
  />
</template>
