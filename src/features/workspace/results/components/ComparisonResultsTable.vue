<script setup lang="ts">
/**
 * Comparison results table (bottom panel, collapsible).
 *
 * Shows the per-ion comparison results from useRegionComparison. The user can
 * filter by category, sort by various fields, and click a row to jump to that
 * ion image (with the two regions overlaid as semi-transparent red/blue).
 */
import { ref, computed, watch, nextTick } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import type { IconType } from '@/shared/components/svgIcons'
import type { IonComparison, ComparisonCategory } from '@/features/workspace/results/composables/useRegionComparison'
import { scrollIntoContainer } from '@/features/workspace/results/utils/scrollIntoContainer'

const props = defineProps<{
  results: IonComparison[]
  selectedMzIndex: number
  filterStats: { total: number; kept: number; filtered: number }
  /** Identity colors for the selected A/B regions. */
  regionAColor?: string
  regionBColor?: string
  /** Shared expand state - opening either panel opens both. */
  expanded: boolean
}>()

const emit = defineEmits<{
  (e: 'select-mz', ionIndex: number): void
  (e: 'update:expanded', v: boolean): void
}>()

function toggle() {
  emit('update:expanded', !props.expanded)
}

const categoryFilter = ref<ComparisonCategory | 'all'>('all')
const sortKey = ref<'ratio' | 'meanA' | 'meanB' | 'mz' | 'detA' | 'detB'>('ratio')
const sortDir = ref<'desc' | 'asc'>('desc')
const page = ref(0)
const PAGE_SIZE = 30

// ---------- category meta ----------

const CATEGORY_META: Record<ComparisonCategory, { label: string; badge: string }> = {
  'a-only': { label: 'A only', badge: 'badge-success badge-outline' },
  'b-only': { label: 'B only', badge: 'badge-info badge-outline' },
  'a-enriched': { label: 'A ↑', badge: 'badge-success' },
  'b-enriched': { label: 'B ↑', badge: 'badge-info' },
  shared: { label: 'Shared', badge: 'badge-ghost' },
}

const FILTER_OPTIONS: { value: ComparisonCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'a-only', label: 'A only' },
  { value: 'b-only', label: 'B only' },
  { value: 'a-enriched', label: 'A enriched' },
  { value: 'b-enriched', label: 'B enriched' },
  { value: 'shared', label: 'Shared' },
]

// ---------- counts per category ----------

const categoryCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const r of props.results) {
    counts[r.category] = (counts[r.category] ?? 0) + 1
  }
  return counts
})

// ---------- filtering + sorting + pagination ----------

const filteredResults = computed(() => {
  let list = props.results
  if (categoryFilter.value !== 'all') {
    list = list.filter((r) => r.category === categoryFilter.value)
  }
  return list
})

const sortedResults = computed(() => {
  const list = [...filteredResults.value]
  const dir = sortDir.value === 'desc' ? -1 : 1
  list.sort((a, b) => {
    let cmp = 0
    switch (sortKey.value) {
      case 'ratio': {
        const logA = a.ratio === Infinity ? Infinity : a.ratio === 0 ? -Infinity : Math.log2(a.ratio)
        const logB = b.ratio === Infinity ? Infinity : b.ratio === 0 ? -Infinity : Math.log2(b.ratio)
        cmp = Math.abs(logA) - Math.abs(logB)
        break
      }
      case 'meanA':
        cmp = a.meanA - b.meanA
        break
      case 'meanB':
        cmp = a.meanB - b.meanB
        break
      case 'detA':
        cmp = a.detA - b.detA
        break
      case 'detB':
        cmp = a.detB - b.detB
        break
      case 'mz':
        cmp = a.mz - b.mz
        break
    }
    return cmp * dir
  })
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(sortedResults.value.length / PAGE_SIZE)))

const pagedResults = computed(() => {
  const start = page.value * PAGE_SIZE
  return sortedResults.value.slice(start, start + PAGE_SIZE)
})

// Keep the table panel open when a comparison finishes so the newly computed
// results are immediately visible.
watch(() => props.results.length, (length) => {
  page.value = 0
  if (length > 0) emit('update:expanded', true)
})

// ---------- shared cell classes ----------

/** Numeric body cells: m/z, means, ratio, detection rates. */
const TD_NUM = 'text-center font-mono whitespace-nowrap'
/** Sortable column headers. The Category header is not sortable. */
const TH_SORT = 'text-center cursor-pointer hover:text-base-content whitespace-nowrap'

// ---------- formatters ----------

function formatMean(v: number): string {
  if (v === 0) return '0'
  if (!Number.isFinite(v)) return '-'
  if (Math.abs(v) >= 1e4) return v.toExponential(2)
  if (Math.abs(v) >= 1) return v.toFixed(1)
  if (Math.abs(v) < 0.01) return v.toExponential(2)
  return v.toFixed(3)
}

function formatRatio(v: number): string {
  if (v === Infinity) return '∞'
  if (v === 0) return '0'
  if (v >= 100) return '>100×'
  if (v >= 1) return v.toFixed(2) + '×'
  return v.toFixed(2) + '×'
}

function formatDet(v: number): string {
  return (v * 100).toFixed(0) + '%'
}

/** Keep category badges tied to the selected region identities rather than
 * the old fixed green (A) / blue (B) semantic colors. */
function categoryStyle(category: ComparisonCategory): Record<string, string> {
  if (category === 'a-only' || category === 'a-enriched') {
    const color = props.regionAColor
    if (!color) return {}
    return category === 'a-only'
      ? { color, borderColor: color, backgroundColor: 'transparent' }
      : { color: '#fff', borderColor: color, backgroundColor: color }
  }
  if (category === 'b-only' || category === 'b-enriched') {
    const color = props.regionBColor
    if (!color) return {}
    return category === 'b-only'
      ? { color, borderColor: color, backgroundColor: 'transparent' }
      : { color: '#fff', borderColor: color, backgroundColor: color }
  }
  return {}
}

// ---------- sorting ----------

function setSort(key: typeof sortKey.value) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'mz' ? 'asc' : 'desc'
  }
  page.value = 0
}

function sortIcon(key: typeof sortKey.value): IconType | undefined {
  if (sortKey.value !== key) return undefined
  return sortDir.value === 'desc' ? 'chevron_down' : 'chevron_up'
}

// ---------- pagination ----------

function prevPage() {
  if (page.value > 0) page.value--
}
function nextPage() {
  if (page.value < totalPages.value - 1) page.value++
}

// Reset page when filter changes
function onFilterChange(e: Event) {
  categoryFilter.value = (e.target as HTMLSelectElement).value as ComparisonCategory | 'all'
  page.value = 0
}

// ---- Cross-table sync: jump to the page + row of the externally selected m/z ----
// This table and AnnotationPanel share `selectedMzIndex` (the average-spectrum
// axis index). When a row is clicked there, we switch to the page containing
// the matching `ionIndex` and scroll it into view. Rows hidden by the current
// category filter are left alone (no scroll), respecting the user's view.
const tableBodyRef = ref<HTMLElement | null>(null)
const tableScrollRef = ref<HTMLElement | null>(null)

watch(
  () => props.selectedMzIndex,
  async (idx) => {
    if (idx == null || idx < 0) return
    const pos = sortedResults.value.findIndex((r) => r.ionIndex === idx)
    if (pos < 0) return
    const targetPage = Math.floor(pos / PAGE_SIZE)
    if (targetPage !== page.value) {
      page.value = targetPage
      await nextTick()
    }
    const tr = tableBodyRef.value?.querySelector<HTMLElement>(`tr[data-ion-index="${idx}"]`)
    if (tr && tableScrollRef.value) scrollIntoContainer(tr, tableScrollRef.value, 'center')
  },
)
</script>

<template>
  <div class="w-full rounded-xl border-2 border-base-content/30 bg-base-100 overflow-hidden flex flex-col self-stretch min-h-0"
    :class="expanded ? 'h-full' : 'h-auto self-start'">
    <!-- Collapsible header bar -->
    <div
      class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-base-200/60 select-none"
      @click.stop="toggle"
    >
      <SvgIcon
        :type="expanded ? 'chevron_down' : 'chevron_right'"
        class="text-base-content/60"
      />
      <span class="font-semibold text-base-content whitespace-nowrap shrink-0 text-[1.2em]">
         Comparison results
      </span>
      <span class="text-[1.125em] text-base-content whitespace-nowrap shrink-0">
        {{ results.length }} ions
      </span>
      <span v-if="filterStats.filtered > 0" class="text-[1.125em] text-base-content whitespace-nowrap overflow-hidden text-ellipsis min-w-0" :title="`(${filterStats.filtered} filtered from ${filterStats.total})`">
        ({{ filterStats.filtered }} filtered from {{ filterStats.total }})
      </span>
    </div>

    <!-- Expanded content -->
    <div v-if="expanded" class="border-t border-base-300 px-3 py-3 flex flex-1 min-h-0 flex-col">
      <template v-if="results.length">
        <!-- Filter + sort controls -->
        <div class="flex items-center gap-3 flex-wrap mb-3">
        <!-- Category filter -->
        <div class="flex items-center gap-1.5">
          <span class="text-base-content">Filter</span>
          <select
            :value="categoryFilter"
            class="select select-bordered select-sm text-[1em]"
            @change="onFilterChange"
          >
            <option v-for="opt in FILTER_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}{{ opt.value !== 'all' ? ` (${categoryCounts[opt.value] ?? 0})` : '' }}
            </option>
          </select>
        </div>

        <span class="text-base-content">
          Showing {{ filteredResults.length }} of {{ results.length }}
        </span>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="ml-auto flex items-center gap-1">
          <button class="btn btn-sm btn-square btn-ghost" :disabled="page === 0" @click="prevPage"><SvgIcon type="chevron_left" /></button>
          <span class="text-[1.125em] text-base-content font-mono">{{ page + 1 }}/{{ totalPages }}</span>
          <button class="btn btn-sm btn-square btn-ghost" :disabled="page >= totalPages - 1" @click="nextPage"><SvgIcon type="chevron_right" /></button>
        </div>
      </div>

      <!-- Table -->
      <div ref="tableScrollRef" class="min-h-0 flex-1 overflow-auto rounded-lg border border-base-300">
        <table class="table table-sm text-center">
           <!-- Table  head part -->
          <thead class="sticky top-0 z-10 bg-base-200 text-base-content/70">
            <tr class="text-[1.2em]">
              <th :class="TH_SORT" @click="setSort('mz')">
                <i>m/z</i><SvgIcon v-if="sortIcon('mz')" :type="sortDir === 'desc' ? 'chevron_down' : 'chevron_up'" class="inline text-base-content/40" />
              </th>
              <th :class="TH_SORT" @click="setSort('meanA')">
                <span class="inline-flex items-center gap-1 whitespace-nowrap"><span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ backgroundColor: regionAColor ?? 'currentColor' }"></span>Mean A</span><SvgIcon v-if="sortIcon('meanA')" :type="sortDir === 'desc' ? 'chevron_down' : 'chevron_up'" class="inline text-base-content/40" />
              </th>
              <th :class="TH_SORT" @click="setSort('meanB')">
                <span class="inline-flex items-center gap-1 whitespace-nowrap"><span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ backgroundColor: regionBColor ?? 'currentColor' }"></span>Mean B</span><SvgIcon v-if="sortIcon('meanB')" :type="sortDir === 'desc' ? 'chevron_down' : 'chevron_up'" class="inline text-base-content/40" />
              </th>
              <th :class="TH_SORT" @click="setSort('ratio')">
                A/B<SvgIcon v-if="sortIcon('ratio')" :type="sortDir === 'desc' ? 'chevron_down' : 'chevron_up'" class="inline text-base-content/40" />
              </th>
              <th :class="TH_SORT" @click="setSort('detA')">
                Det A<SvgIcon v-if="sortIcon('detA')" :type="sortDir === 'desc' ? 'chevron_down' : 'chevron_up'" class="inline text-base-content/40" />
              </th>
              <th :class="TH_SORT" @click="setSort('detB')">
                Det B<SvgIcon v-if="sortIcon('detB')" :type="sortDir === 'desc' ? 'chevron_down' : 'chevron_up'" class="inline text-base-content/40" />
              </th>
              <th class="whitespace-nowrap">Category</th>
            </tr>
          </thead>
          <tbody ref="tableBodyRef">
            <tr
              v-for="row in pagedResults"
              :key="row.ionIndex"
              :data-ion-index="row.ionIndex"
              class="hover:bg-base-200/70 cursor-pointer text-[1.2em]"
              :class="{ 'bg-primary/15': row.ionIndex === selectedMzIndex }"
              @click="emit('select-mz', row.ionIndex)"
            >
              <td :class="TD_NUM">{{ row.mz.toFixed(6) }}</td>
              <td :class="TD_NUM">{{ formatMean(row.meanA) }}</td>
              <td :class="TD_NUM">{{ formatMean(row.meanB) }}</td>
              <td :class="TD_NUM" :style="{ color: row.ratio > 1 ? (regionAColor ?? undefined) : row.ratio < 1 && row.ratio > 0 ? (regionBColor ?? undefined) : undefined }">
                <span v-if="row.ratio === Infinity" class="text-[1.2em] font-bold leading-none align-middle">∞</span>
                <template v-else>{{ formatRatio(row.ratio) }}</template>
              </td>
              <td :class="TD_NUM">{{ formatDet(row.detA) }}</td>
              <td :class="TD_NUM">{{ formatDet(row.detB) }}</td>
              <td class="text-center whitespace-nowrap">
                <span class="badge badge-sm whitespace-nowrap text-[1em]" :class="CATEGORY_META[row.category].badge" :style="categoryStyle(row.category)">
                  {{ CATEGORY_META[row.category].label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </template>
    </div>
  </div>
</template>
