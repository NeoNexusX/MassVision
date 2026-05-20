<template>
  <div class="flex flex-col h-screen max-h-screen overflow-hidden bg-base-100">
    <!-- Main visualization area -->
    <div class="flex-1 min-h-0 flex flex-col overflow-hidden max-w-[1640px] mx-auto w-full">
      <!-- Top bar: dataset name + status -->
      <div class="shrink-0 flex items-center gap-3 px-6 py-2 border-b border-base-200 text-lg">
        <span class="font-semibold text-xl">{{ meta.datasetName }}</span>
        <span class="px-2 py-0.5 rounded text-base font-medium bg-green-100 text-green-700">{{ meta.status }}</span>
      </div>

      <div class="flex-1 min-h-0 flex gap-6 p-4 overflow-hidden">
        <!-- Left: Ion Image + Spectrum stacked -->
        <div class="flex-1 min-h-0 min-w-0 flex flex-col gap-4">
          <!-- Ion Image row: card + gradient strip -->
          <div class="flex-1 min-h-0 flex gap-2">
            <div class="flex-1 card bg-base-100 border border-base-200 rounded-xl p-4 flex flex-col">
              <div v-if="!ionMatrix" class="flex-1 flex items-center justify-center text-base-content/40 text-lg">
                Loading ion image...
              </div>
              <div v-else class="flex-1 min-h-0 relative">
                <IonImageViewer
                  :selected-mz="selectedMz"
                  :mz-tolerance="mzTolerance"
                  :colormap="colormap"
                  :intensity-scale="intensityScale"
                  :display-min="displayMin"
                  :display-max="displayMax"
                  :matrix="displayMatrix"
                  :meta-info="{ analyzer: meta.analyzer, ionSource: meta.ionSource, pixelSize: meta.pixelSize }"
                  :draw-mode="!!roiTool"
                  @update:mz-tolerance="mzTolerance = $event"
                  @update:colormap="colormap = $event"
                  @update:intensity-scale="intensityScale = $event"
                  @reset="resetControls"
                />
                <ROIOverlay
                  ref="roiOverlayRef"
                  :tool="roiTool"
                  :image-width="ionCols"
                  :image-height="ionRows"
                  @draft-updated="onDraftUpdated"
                  @draft-cleared="onDraftCleared"
                />
              </div>
            </div>
            <!-- Gradient strip -->
            <div class="shrink-0 flex flex-col items-center gap-1.5 w-12">
              <!-- Reset -->
              <button class="text-sm text-base-content/40 hover:text-base-content" title="Reset to auto range" @click="resetRange">↺</button>
              <!-- Max label (top) -->
              <span class="text-sm font-mono text-base-content/60 leading-none text-center whitespace-nowrap">{{ formatVal(dataMax) }}</span>
              <!-- Strip -->
              <div ref="stripRef" class="flex-1 w-5 rounded-sm border border-base-300 relative cursor-pointer bg-base-200"
                @mousedown.prevent="onStripMouseDown">
                <div class="absolute inset-0 rounded-sm" :style="{ background: gradientCSS }"></div>
                <!-- Max handle -->
                <div
                  class="absolute left-0 right-0 h-3 cursor-ns-resize z-10 flex items-center justify-center"
                  :style="{ top: clampPct(calcHandleTop(displayMax)) + '%', transform: 'translateY(-50%)' }"
                  @mousedown.prevent.stop="startStripDrag('max', $event)">
                  <div class="w-full h-[3px] bg-white rounded shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"></div>
                </div>
                <!-- Min handle -->
                <div
                  class="absolute left-0 right-0 h-3 cursor-ns-resize z-10 flex items-center justify-center"
                  :style="{ top: clampPct(calcHandleTop(displayMin)) + '%', transform: 'translateY(-50%)' }"
                  @mousedown.prevent.stop="startStripDrag('min', $event)">
                  <div class="w-full h-[3px] bg-white rounded shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"></div>
                </div>
              </div>
              <!-- Min label (bottom) -->
              <span class="text-sm font-mono text-base-content/60 leading-none text-center whitespace-nowrap">{{ formatVal(displayMin) }}</span>
            </div>
          </div>

          <!-- Spectrum -->
          <div class="shrink-0 h-80 card bg-base-100 border border-base-200 rounded-xl p-4">
            <AverageSpectrum :selected-mz="selectedMz" @select-mz="onSpectrumClick" />
          </div>

          <!-- Footer stats -->
          <div class="shrink-0 flex flex-wrap gap-4 text-lg text-base-content/60 px-1">
            <span>Peaks: <strong class="text-base-content">{{ spectrumStats.totalPeaks }}</strong></span>
            <span>Intensity: <strong class="text-base-content">{{ spectrumStats.intensityRange }}</strong></span>
            <span>Selected: <strong class="text-base-content font-mono">{{ selectedMz.toFixed(4) }}</strong></span>
            <span>Tolerance: <strong class="text-base-content font-mono">&plusmn;{{ mzTolerance }}</strong></span>
          </div>
        </div>

        <!-- Right: Color Bar -->
        <ColorBar
          class="shrink-0 py-4"
          :style="{ width: '300px' }"
          :colormap="colormap"
          :global-min="globalMin"
          :global-max="globalMax"
          :display-min="displayMin"
          :display-max="displayMax"
          :histogram="intensityHistogram"
          :info="imageInfo"
          :methods="methods"
          :sorted-values="sortedNonZero"
          @update:display-min="onDisplayMinChange"
          @update:display-max="onDisplayMaxChange"
        >
          <template #actions>
            <div class="flex gap-2 mt-3 pt-3 border-t border-base-200">
              <button class="btn btn-sm flex-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 rounded-lg">TIC</button>
              <button class="btn btn-sm flex-1 bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 rounded-lg">PCA</button>
              <button class="btn btn-sm flex-1 bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-200 rounded-lg">UMAP</button>
            </div>
            <div class="mt-3 pt-3 border-t border-base-200">
              <ROIPanel
                :selected-tool="roiTool"
                :draft-ready="draftReady"
                :show-reset="viewingROI"
                :rois="(confirmedROIs as any)"
                @update:selected-tool="(v: string | null) => roiSelectTool(v as ROIType | null)"
                @confirm="roiConfirm"
                @cancel="roiCancel"
                @delete="roiDelete"
                @clear-all="roiClearAll"
                @reset="roiReset"
              />
            </div>
          </template>
        </ColorBar>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { FetchStore, open, get } from 'zarrita'
import IonImageViewer from '@/components/workspace/visuals/IonImageViewer.vue'
import ColorBar from '@/components/workspace/visuals/ColorBar.vue'
import AverageSpectrum from '@/components/workspace/visuals/AverageSpectrum.vue'
import ROIOverlay from '@/components/workspace/visuals/ROIOverlay.vue'
import ROIPanel from '@/components/workspace/visuals/ROIPanel.vue'
import { useROI } from '@/composables/useROI'
import type { ROIType, DraftROI, ConfirmedROI } from '@/composables/useROI'

// ─── Zarr data ───
let _zarrIonArray: any = null
let _zarrMzData: Float64Array | null = null

async function initZarr() {
  const zarrUrl = new URL('/ion_image_output.zarr', window.location.origin).href
  const store = new FetchStore(zarrUrl)
  const root = await open(store, { kind: 'group' })
  _zarrIonArray = await open(root.resolve('ion_images'), { kind: 'array' })
  const mzArr = await open(root.resolve('mz_axis'), { kind: 'array' })
  const chunk = await get(mzArr)
  _zarrMzData = chunk.data as Float64Array
}

function findMzRangeIndices(target: number, tolerance: number): number[] {
  if (!_zarrMzData) return []
  const indices: number[] = []
  for (let i = 0; i < _zarrMzData.length; i++) {
    const mz = _zarrMzData[i]!
    if (mz >= target - tolerance && mz <= target + tolerance) indices.push(i)
    else if (mz > target + tolerance) break
  }
  return indices
}

async function loadIonSlice(index: number): Promise<number[][]> {
  const result = await get(_zarrIonArray, [index, null, null])
  const flat = result.data as Float32Array
  const height = result.shape[0]!
  const width = result.shape[1]!
  const matrix: number[][] = []
  for (let r = 0; r < height; r++) {
    const row = new Array<number>(width)
    const offset = r * width
    for (let c = 0; c < width; c++) row[c] = flat[offset + c]!
    matrix.push(row)
  }
  return matrix
}

async function loadIonSliceSum(indices: number[]): Promise<number[][]> {
  if (!indices.length) return []
  const first = await get(_zarrIonArray, [indices[0]!, null, null])
  const height = first.shape[0]!
  const width = first.shape[1]!
  const sum: number[][] = []
  for (let r = 0; r < height; r++) {
    const row = new Array<number>(width).fill(0)
    sum.push(row)
  }
  // Add first slice
  const flat0 = first.data as Float32Array
  for (let r = 0; r < height; r++) {
    const offset = r * width
    for (let c = 0; c < width; c++) sum[r]![c]! += flat0[offset + c]!
  }
  // Add remaining slices
  for (let i = 1; i < indices.length; i++) {
    const result = await get(_zarrIonArray, [indices[i]!, null, null])
    const flat = result.data as Float32Array
    for (let r = 0; r < height; r++) {
      const offset = r * width
      for (let c = 0; c < width; c++) sum[r]![c]! += flat[offset + c]!
    }
  }
  return sum
}

// ─── Gradient strip (between ion image and right panel) ───
const GRADIENT_STOPS: Record<string, string[]> = {
  viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#fee825'],
  inferno: ['#000004', '#280b54', '#65156e', '#9f2a63', '#d44842', '#f57d15', '#fac127', '#fcffa4'],
  plasma: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fdb42f'],
  gray: ['#000000', '#ffffff'],
}

const gradientCSS = computed(() => {
  const stops = (GRADIENT_STOPS[colormap.value] ?? GRADIENT_STOPS.inferno)!
  const darkest = stops[0]!
  const brightest = stops[stops.length - 1]!
  const r = stripRange.value
  const lo = ((displayMin.value - globalMin.value) / r) * 100  // min handle %
  const hi = ((displayMax.value - globalMin.value) / r) * 100  // max handle %
  // METASPACE-style: solid dark below displayMin, gradient between handles, solid bright above displayMax
  const inner = stops.map((c, i) => {
    const pct = lo + ((hi - lo) * i) / (stops.length - 1)
    return `${c} ${pct}%`
  }).join(', ')
  return `linear-gradient(to top, ${darkest} 0%, ${darkest} ${lo}%, ${inner}, ${brightest} ${hi}%, ${brightest} 100%)`
})

const stripRange = computed(() => globalMax.value - globalMin.value || 1)

function calcHandleTop(v: number): number {
  return ((globalMax.value - v) / stripRange.value) * 100
}

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, v))
}



function resetRange() {
  if (ionMatrix.value) applyRange(computeRange(ionMatrix.value))
}

function formatVal(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'e6'
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'e3'
  if (Math.abs(v) < 0.01) return v.toExponential(1)
  return v.toFixed(1)
}

function pctLabel(v: number): string {
  const arr = sortedNonZero.value
  if (!arr.length) return '0.0%'
  // Binary search: find how many values <= v
  let lo = 0, hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid]! <= v) lo = mid + 1; else hi = mid
  }
  return ((lo / arr.length) * 100).toFixed(1) + '%'
}

const stripRef = ref<HTMLElement | null>(null)
let stripDragDir: 'min' | 'max' | null = null

function onStripMouseDown(e: MouseEvent) {
  const el = stripRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const topPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
  const clickedValue = globalMax.value - (topPct / 100) * stripRange.value
  // Move closest handle
  const distMin = Math.abs(displayMin.value - clickedValue)
  const distMax = Math.abs(displayMax.value - clickedValue)
  if (distMin <= distMax) displayMin.value = clickedValue
  else displayMax.value = clickedValue
}

function startStripDrag(which: 'min' | 'max', e: MouseEvent) {
  const el = stripRef.value
  if (!el) return
  stripDragDir = which
  const rect = el.getBoundingClientRect()
  const h = rect.height
  const onMove = (ev: MouseEvent) => {
    if (!stripDragDir) return
    const topPct = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / h) * 100))
    const val = globalMax.value - (topPct / 100) * stripRange.value
    if (stripDragDir === 'min') {
      displayMin.value = Math.max(globalMin.value, Math.min(val, displayMax.value))
    } else {
      displayMax.value = Math.min(globalMax.value, Math.max(val, displayMin.value))
    }
  }
  const onUp = () => { stripDragDir = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const meta = reactive({
  datasetName: 'S-2406-001483_3_S3_SM_Neg_20260406_AQ',
  analyzer: 'Orbitrap',
  ionSource: 'MALDI',
  pixelSize: '25 × 25 µm',
  status: 'Completed',
})

const methods = ref(['Noise Reduction', 'Peak Picking', 'Peak Alignment'])

const selectedMz = ref(900.5)
const mzTolerance = ref(0.05)
const colormap = ref('inferno')
const intensityScale = ref('linear')

const globalMin = ref(0)
const globalMax = ref(1)
const dataMax = ref(1)
const sortedNonZero = ref<number[]>([])
const displayMin = ref(0)
const displayMax = ref(1)

function onDisplayMinChange(v: number) { displayMin.value = v }
function onDisplayMaxChange(v: number) { displayMax.value = v }

function resetControls() {
  mzTolerance.value = 0.01
  colormap.value = 'inferno'
  intensityScale.value = 'linear'
  if (ionMatrix.value) applyRange(computeRange(ionMatrix.value))
}

const ionMatrix = ref<number[][] | null>(null)
const ionCols = computed(() => ionMatrix.value?.[0]?.length ?? 0)
const ionRows = computed(() => ionMatrix.value?.length ?? 0)
const viewingROI = ref(false)

const displayMatrix = computed(() => {
  const m = ionMatrix.value
  if (!m || !viewingROI.value || !confirmedROIs.value.length) return m
  const h = m.length, w = m[0]?.length ?? 0
  const combined: boolean[][] = []
  for (let r = 0; r < h; r++) combined.push(new Array(w).fill(false))
  for (const roi of confirmedROIs.value) {
    const mask = roi.mask
    if (!mask || !mask.length) continue
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++)
        if (mask[r]?.[c]) combined[r]![c] = true
  }
  const filtered: number[][] = []
  for (let r = 0; r < h; r++) {
    const row = new Array<number>(w)
    for (let c = 0; c < w; c++)
      row[c] = combined[r]![c] ? (m[r]?.[c] ?? 0) : 0
    filtered.push(row)
  }
  return filtered
})

// ─── ROI ───
const roiOverlayRef = ref<InstanceType<typeof ROIOverlay> | null>(null)
const currentDraft = ref<DraftROI | null>(null)
const draftReady = computed(() => currentDraft.value !== null)

const {
  selectedTool: roiTool,
  confirmedROIs,
  selectTool: roiSelectTool,
  confirmROI: roiConfirmDraft,
  deleteROI: roiDelete,
  clearAllROIs,
} = useROI(ionCols, ionRows)

function onDraftUpdated(draft: DraftROI) {
  currentDraft.value = draft
}

function onDraftCleared() {
  currentDraft.value = null
}

function roiCancel() {
  roiOverlayRef.value?.clearAll()
  currentDraft.value = null
  roiSelectTool(null)
}

function roiConfirm() {
  if (!ionMatrix.value || !currentDraft.value) return
  roiConfirmDraft(ionMatrix.value, currentDraft.value)
  roiOverlayRef.value?.clearAll()
  currentDraft.value = null
  roiSelectTool(null)
  viewingROI.value = true
}

function roiClearAll() {
  clearAllROIs()
  currentDraft.value = null
  roiOverlayRef.value?.clearAll()
}

function roiReset() {
  currentDraft.value = null
  roiOverlayRef.value?.clearAll()
  roiSelectTool(null)
  viewingROI.value = false
}

// ─── Compute display range ───
function computeRange(matrix: number[][]) {
  const nonZero: number[] = []
  for (const row of matrix) for (const v of row) if (v > 0) nonZero.push(v)
  if (!nonZero.length) return { displayMin: 0, displayMax: 1, dataMax: 1, sorted: [] as number[] }
  nonZero.sort((a, b) => a - b)
  const p95 = nonZero[Math.floor(nonZero.length * 0.95)] ?? nonZero[nonZero.length - 1]!
  const dataMax = nonZero[nonZero.length - 1]!
  return { displayMin: 0, displayMax: p95, dataMax, sorted: nonZero }
}

function applyRange(r: ReturnType<typeof computeRange>) {
  if (!r) return
  globalMin.value = r.displayMin
  globalMax.value = r.dataMax
  dataMax.value = r.dataMax
  sortedNonZero.value = r.sorted
  displayMin.value = r.displayMin
  displayMax.value = r.displayMax
}

// ─── Spectrum click → load ion image ───
async function onSpectrumClick(mz: number) {
  if (!_zarrMzData) return
  selectedMz.value = mz
  const indices = findMzRangeIndices(mz, mzTolerance.value)
  ionMatrix.value = await loadIonSliceSum(indices)
  applyRange(computeRange(ionMatrix.value))
}

// ─── Computed stats from real data ───
const intensityHistogram = computed(() => {
  const bins = 10
  const hist: number[] = new Array(bins).fill(0)
  const m = ionMatrix.value
  if (!m) return hist
  const gMin = 0
  const gMax = dataMax.value || 1
  const range = gMax - gMin || 1
  for (const row of m) {
    for (const v of row) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor(((v - gMin) / range) * bins)))
      hist[idx] = (hist[idx] ?? 0) + 1
    }
  }
  console.log('[Histogram] bin[0]:', hist[0], 'total:', m.length * m[0]!.length)
  return hist
})

const imageInfo = computed(() => {
  const m = ionMatrix.value
  if (!m || !m.length) return { pixels: '--', nonZero: '--', totalIon: '--', polarity: 'Negative' }
  const rows = m.length, cols = m[0]!.length
  let nonZero = 0, total = 0
  for (const row of m) for (const v of row) { if (v > 0) nonZero++; total += v }
  return {
    pixels: `${cols} × ${rows}`,
    nonZero: ((nonZero / (rows * cols)) * 100).toFixed(1) + '%',
    totalIon: total.toExponential(2),
    polarity: 'Positive',
  }
})

const spectrumStats = computed(() => {
  const m = ionMatrix.value
  if (!m) return { totalPeaks: _zarrMzData ? _zarrMzData.length.toLocaleString() : '--', intensityRange: '--' }
  let minV = Infinity, maxV = -Infinity
  for (const row of m) for (const v of row) {
    if (Number.isFinite(v)) { if (v < minV) minV = v; if (v > maxV) maxV = v }
  }
  return {
    totalPeaks: _zarrMzData ? _zarrMzData.length.toLocaleString() : '--',
    intensityRange: `${formatVal(minV === Infinity ? 0 : minV)} – ${formatVal(maxV === -Infinity ? 0 : maxV)}`,
  }
})

// ─── Init ───
onMounted(async () => {
  await initZarr()
  if (_zarrMzData) {
    // Find closest m/z to 900.5 as the display target
    let bestIdx = 0, bestDist = Infinity
    for (let i = 0; i < _zarrMzData.length; i++) {
      const dist = Math.abs(_zarrMzData[i]! - 900.5)
      if (dist < bestDist) { bestDist = dist; bestIdx = i }
      else if (_zarrMzData[i]! > 900.5 + bestDist) break
    }
    selectedMz.value = _zarrMzData[bestIdx]!
    const indices = findMzRangeIndices(selectedMz.value, mzTolerance.value)
    ionMatrix.value = await loadIonSliceSum(indices)
    applyRange(computeRange(ionMatrix.value))
  }
})
</script>
