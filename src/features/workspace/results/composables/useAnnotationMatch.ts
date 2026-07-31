/**
 * Annotation CSV import + m/z matching composable.
 *
 * Wires {@link ../utils/csvAnnotation} (pure parsing/matching) to the live
 * result state: the shared m/z axis and raw mean spectrum exported by
 * {@link ./useZarrIonImage}. Matching re-runs reactively whenever the imported
 * rows, the spectrum, or the tolerance change.
 *
 * Selecting a matched row calls the injected `selectMzIndex(idx)` - the same
 * code path as clicking a spectrum peak - so the ion image refreshes and the
 * average-spectrum highlight moves automatically.
 */

import { computed, ref, watch } from 'vue'
import {
  mzAxisRef,
  meanSpectrumRef,
  dataModeRef,
} from '@/features/workspace/results/composables/useZarrIonImage'
import {
  parseAnnotationCsv,
  matchAnnotations,
  CsvParseError,
  type AnnotationRow,
  type MatchedAnnotationRow,
  type ToleranceMode,
} from '@/features/workspace/results/utils/csvAnnotation'
import { useToast } from '@/shared/composables/useToast'

export type AnnotationFilter = 'all' | 'matched' | 'unmatched'
export type AnnotationSortKey = 'name' | 'expMz' | 'massError' | 'avgIntensity'
export type SortDir = 'asc' | 'desc'

export interface AnnotationCounts {
  total: number
  matched: number
  unmatched: number
  invalid: number
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsText(file, 'utf-8')
  })
}

/**
 * @param selectMzIndex The result page's m/z-selection entry point (e.g.
 *   `onSpectrumClickByIndex` from useZarrIonImage). Invoked when the user
 *   clicks a matched annotation row.
 */
export function useAnnotationMatch(
  selectMzIndex: (idx: number) => void | Promise<void>,
) {
  const { showToast } = useToast()

  // ---- imported data ----
  const importedRows = ref<AnnotationRow[]>([])
  const fileName = ref<string | null>(null)
  const parseError = ref<string | null>(null)

  // ---- matching controls ----
  const tolMode = ref<ToleranceMode>('ppm')
  const tolValue = ref<number>(10)

  // When the tolerance mode switches, snap the value to a sensible default
  // for the new unit (10 ppm <-> 0.05 Da) so the user doesn't end up with
  // "10 Da" (impossibly wide) or "0.05 ppm" (impossibly tight).
  watch(tolMode, (mode, prev) => {
    if (mode === prev) return
    if (mode === 'ppm' && tolValue.value <= 1) tolValue.value = 10
    if (mode === 'Da' && tolValue.value > 1) tolValue.value = 0.05
  })

  // ---- table controls ----
  const search = ref('')
  const filter = ref<AnnotationFilter>('all')
  const sortKey = ref<AnnotationSortKey>('massError')
  const sortDir = ref<SortDir>('asc')

  /** True when an average spectrum (continuous-mode m/z axis) is available. */
  const spectrumAvailable = computed(() => {
    const axis = mzAxisRef.value
    return !!axis && axis.length > 0 && dataModeRef.value === 'continuous'
  })

  /** All rows matched against the live spectrum. Re-runs when the spectrum or
   *  tolerance changes (computed depends on mzAxisRef/meanSpectrumRef). */
  const matchedRows = computed<MatchedAnnotationRow[]>(() => {
    if (!importedRows.value.length) return []
    return matchAnnotations(
      importedRows.value,
      mzAxisRef.value,
      meanSpectrumRef.value,
      tolValue.value,
      tolMode.value,
    )
  })

  const counts = computed<AnnotationCounts>(() => {
    const c: AnnotationCounts = { total: 0, matched: 0, unmatched: 0, invalid: 0 }
    for (const r of matchedRows.value) {
      c.total++
      c[r.matchStatus]++
    }
    return c
  })

  const filteredRows = computed<MatchedAnnotationRow[]>(() => {
    let rows = matchedRows.value
    if (filter.value !== 'all') {
      rows = rows.filter((r) => r.matchStatus === filter.value)
    }
    const q = search.value.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.candidates.some((c) => c.toLowerCase().includes(q)) ||
          (r.formulaIon ?? '').toLowerCase().includes(q) ||
          (r.ionType ?? '').toLowerCase().includes(q) ||
          (Number.isFinite(r.expMz) ? r.expMz.toString() : '').includes(q),
      )
    }
    return sortRows(rows, sortKey.value, sortDir.value)
  })

  async function importFile(file: File): Promise<void> {
    parseError.value = null
    try {
      const text = await readFileAsText(file)
      const parsed = parseAnnotationCsv(text)
      importedRows.value = parsed.rows
      fileName.value = file.name
      if (spectrumAvailable.value) {
        const m = matchAnnotations(
          parsed.rows,
          mzAxisRef.value,
          meanSpectrumRef.value,
          tolValue.value,
          tolMode.value,
        )
        const matched = m.filter((r) => r.matchStatus === 'matched').length
        showToast(
          `Imported ${parsed.rows.length} rows from "${file.name}" (${parsed.mzColumn}) - ${matched} matched.`,
          'success',
        )
      } else {
        showToast(
          `Imported ${parsed.rows.length} rows. Matching will run once the average spectrum is loaded.`,
          'info',
        )
      }
    } catch (e) {
      importedRows.value = []
      fileName.value = null
      const msg =
        e instanceof CsvParseError
          ? e.message
          : `Failed to read CSV: ${e instanceof Error ? e.message : String(e)}`
      parseError.value = msg
      showToast(msg, 'error')
    }
  }

  function clear(): void {
    importedRows.value = []
    fileName.value = null
    parseError.value = null
  }

  /** Click a table row: only matched rows select an m/z. */
  function selectRow(row: MatchedAnnotationRow): void {
    if (row.matchStatus !== 'matched' || row.matchedIndex == null) return
    void selectMzIndex(row.matchedIndex)
  }

  function toggleSort(key: AnnotationSortKey): void {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDir.value = 'asc'
    }
  }

  return {
    // data
    importedRows,
    fileName,
    parseError,
    // matching controls
    tolMode,
    tolValue,
    spectrumAvailable,
    matchedRows,
    counts,
    // table controls
    search,
    filter,
    sortKey,
    sortDir,
    filteredRows,
    // actions
    importFile,
    clear,
    selectRow,
    toggleSort,
  }
}

// ---- sorting --------------------------------------------------------------

/** Comparator that keeps null/NaN numeric values pinned to the bottom of the
 *  list regardless of sort direction (so unmatched rows don't jump to the top
 *  when sorting by error/intensity). */
function sortRows(
  rows: MatchedAnnotationRow[],
  key: AnnotationSortKey,
  dir: SortDir,
): MatchedAnnotationRow[] {
  const sign = dir === 'asc' ? 1 : -1
  const arr = [...rows]
  arr.sort((a, b) => {
    if (key === 'name') {
      return a.name.localeCompare(b.name) * sign
    }
    const av = numericField(a, key)
    const bv = numericField(b, key)
    const aNull = av == null
    const bNull = bv == null
    if (aNull && bNull) return 0
    if (aNull) return 1 // always bottom
    if (bNull) return -1
    if (av! < bv!) return -1 * sign
    if (av! > bv!) return 1 * sign
    return 0
  })
  return arr
}

function numericField(
  r: MatchedAnnotationRow,
  key: 'expMz' | 'massError' | 'avgIntensity',
): number | null {
  const v = r[key]
  return v == null || !Number.isFinite(v) ? null : v
}
