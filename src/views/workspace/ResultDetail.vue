<template>
  <div class="flex flex-col h-screen max-h-screen overflow-hidden bg-base-100">
    <!-- Main visualization area -->
    <div class="flex-1 min-h-0 flex flex-col overflow-hidden max-w-[1440px] mx-auto w-full">
      <!-- Top bar: dataset name + status -->
      <div class="shrink-0 flex items-center gap-3 px-6 py-2 border-b border-base-200 text-sm">
        <span class="font-semibold text-base">{{ meta.datasetName }}</span>
        <span class="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">{{ meta.status }}</span>
      </div>

      <div class="flex-1 min-h-0 flex gap-4 p-4 overflow-hidden">
        <!-- Left: Ion Image + Spectrum stacked -->
        <div class="flex-1 min-h-0 min-w-0 flex flex-col gap-4">
          <!-- Ion Image row: card + gradient strip -->
          <div class="flex-1 min-h-0 flex gap-2">
            <div class="flex-1 card bg-base-100 border border-base-200 rounded-xl p-4 flex flex-col">
              <IonImageViewer
                :selected-mz="selectedMz"
                :mz-tolerance="mzTolerance"
                :colormap="colormap"
                :intensity-scale="intensityScale"
                :display-min="displayMin"
                :display-max="displayMax"
                :matrix="ionMatrix"
                :meta-info="{ analyzer: meta.analyzer, ionSource: meta.ionSource, pixelSize: meta.pixelSize }"
                @update:mz-tolerance="mzTolerance = $event"
                @update:colormap="colormap = $event"
                @update:intensity-scale="intensityScale = $event"
                @reset="resetControls"
              />
            </div>
            <!-- Gradient strip -->
            <div class="shrink-0 flex flex-col items-center w-8">
              <span class="text-[10px] font-mono text-base-content/60 leading-none mb-1">{{ formatVal(displayMax) }}</span>
              <div ref="stripRef" class="flex-1 w-5 rounded-sm border border-base-300 relative cursor-pointer" @mousedown.prevent>
                <div class="absolute inset-0 rounded-sm" :style="{ background: gradientCSS }"></div>
                <div class="absolute left-[-3px] right-[-3px] cursor-ns-resize" :style="{ top: (100 - stripMaxPct) + '%', transform: 'translateY(-50%)' }"
                  @mousedown.prevent.stop="startStripDrag('max', $event)">
                  <div class="h-0.5 bg-white rounded shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"></div>
                </div>
                <div class="absolute left-[-3px] right-[-3px] cursor-ns-resize" :style="{ top: (100 - stripMinPct) + '%', transform: 'translateY(-50%)' }"
                  @mousedown.prevent.stop="startStripDrag('min', $event)">
                  <div class="h-0.5 bg-white rounded shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"></div>
                </div>
              </div>
              <span class="text-[10px] font-mono text-base-content/60 leading-none mt-1">{{ formatVal(displayMin) }}</span>
            </div>
          </div>

          <!-- Spectrum -->
          <div class="shrink-0 h-48 card bg-base-100 border border-base-200 rounded-xl p-4 flex flex-row gap-4">
            <div class="flex-1 min-w-0">
              <SpectrumViewer
                :selected-mz="selectedMz"
                :peaks="spectrumPeaks"
                @select="onSpectrumSelect"
              />
            </div>
            <div class="flex flex-col justify-center gap-2 shrink-0">
              <button class="btn btn-sm bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 rounded-lg">TIC</button>
              <button class="btn btn-sm bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 rounded-lg">PCA</button>
              <button class="btn btn-sm bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-200 rounded-lg">UMAP</button>
            </div>
          </div>

          <!-- Footer stats -->
          <div class="shrink-0 flex flex-wrap gap-4 text-sm text-base-content/60 px-1">
            <span>Peaks: <strong class="text-base-content">{{ spectrumStats.totalPeaks }}</strong></span>
            <span>Intensity: <strong class="text-base-content">{{ spectrumStats.intensityRange }}</strong></span>
            <span>Selected: <strong class="text-base-content font-mono">{{ selectedMz.toFixed(4) }}</strong></span>
            <span>Tolerance: <strong class="text-base-content font-mono">&plusmn;{{ mzTolerance }}</strong></span>
          </div>
        </div>

        <!-- Right: Color Bar -->
        <ColorBar
          class="shrink-0 py-4"
          :style="{ width: '280px' }"
          :colormap="colormap"
          :global-min="globalMin"
          :global-max="globalMax"
          :display-min="displayMin"
          :display-max="displayMax"
          :histogram="intensityHistogram"
          :info="imageInfo"
          :methods="methods"
          @update:display-min="onDisplayMinChange"
          @update:display-max="onDisplayMaxChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import IonImageViewer from '@/components/workspace/visuals/IonImageViewer.vue'
import ColorBar from '@/components/workspace/visuals/ColorBar.vue'
import SpectrumViewer from '@/components/workspace/visuals/SpectrumViewer.vue'
import type { SpectrumPeak } from '@/components/workspace/visuals/SpectrumViewer.vue'

// ─── Gradient strip (between ion image and right panel) ───
const GRADIENT_STOPS: Record<string, string[]> = {
  viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#fee825'],
  inferno: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#f9d71c'],
  plasma: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fdb42f'],
  gray: ['#000000', '#ffffff'],
}
const gradientCSS = computed(() => {
  const s = (GRADIENT_STOPS[colormap.value] ?? GRADIENT_STOPS.viridis)!
  return `linear-gradient(to bottom, ${s.map((c, i) => `${c} ${(i / (s.length - 1)) * 100}%`).join(', ')})`
})
const stripRange = computed(() => globalMax.value - globalMin.value || 1)
const stripMaxPct = computed(() => ((displayMax.value - globalMin.value) / stripRange.value) * 100)
const stripMinPct = computed(() => ((displayMin.value - globalMin.value) / stripRange.value) * 100)

function formatVal(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'e6'
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'e3'
  return v.toFixed(1)
}

const stripRef = ref<HTMLElement | null>(null)
let stripDragDir: 'min' | 'max' | null = null
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
    if (stripDragDir === 'min') displayMin.value = Math.min(val, displayMax.value)
    else displayMax.value = Math.max(val, displayMin.value)
  }
  const onUp = () => { stripDragDir = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const meta = reactive({
  datasetName: 'S-2406-001483_3_S3_SM_Neg_20260406_AQ',
  analyzer: 'Orbitrap',
  ionSource: 'MALDI',
  pixelSize: '20 × 20 µm',
  status: 'Completed',
})

const methods = ref(['TIC Normalization', 'Gaussian Smoothing', 'Peak Picking'])

const selectedMz = ref(885.549)
const mzTolerance = ref(0.01)
const colormap = ref('viridis')
const intensityScale = ref('linear')

const globalMin = ref(0)
const globalMax = ref(1.2e6)
const displayMin = ref(0 + (1.2e6 - 0) * 0.01)
const displayMax = ref(1.2e6 - (1.2e6 - 0) * 0.01)

function onDisplayMinChange(v: number) { displayMin.value = v }
function onDisplayMaxChange(v: number) { displayMax.value = v }

function resetControls() {
  selectedMz.value = 885.549
  mzTolerance.value = 0.01
  colormap.value = 'viridis'
  intensityScale.value = 'linear'
  displayMin.value = globalMin.value + (globalMax.value - globalMin.value) * 0.01
  displayMax.value = globalMax.value - (globalMax.value - globalMin.value) * 0.01
}

const ionMatrix = ref<number[][] | null>(null)

const intensityHistogram = computed(() => {
  const bins = 48
  const hist: number[] = new Array(bins).fill(0)
  const gMin = globalMin.value, gMax = globalMax.value
  for (let r = 0; r < 300; r += 4) {
    for (let c = 0; c < 400; c += 4) {
      const nx = (c - 200) / 168, ny = (r - 138) / 132
      const d = Math.sqrt(nx * nx + ny * ny)
      const mask = 1 / (1 + Math.exp((d - 0.92) * 20))
      const rim = Math.max(0, Math.exp(-((1 - d - 0.22) ** 2) / 0.008))
      const val = (rim * 0.9 + 0.1) * mask * 1.2e6 + Math.random() * 8e3
      const idx = Math.min(bins - 1, Math.max(0, Math.floor(((val - gMin) / (gMax - gMin)) * bins)))
      hist[idx] = (hist[idx] ?? 0) + 1
    }
  }
  return hist
})

const imageInfo = computed(() => ({
  pixels: '600 × 800',
  nonZero: '53.2%',
  totalIon: '2.1e10',
  polarity: 'Negative',
}))

const spectrumPeaks = ref<SpectrumPeak[] | null>(null)

const spectrumStats = computed(() => {
  const peaks = spectrumPeaks.value
  if (!peaks || !peaks.length) return { totalPeaks: '~1,000', intensityRange: '0 – 1.2e6' }
  const maxInt = Math.max(...peaks.map(p => p.intensity))
  return { totalPeaks: peaks.length.toLocaleString(), intensityRange: `0 – ${maxInt.toExponential(1)}` }
})

function onSpectrumSelect(mz: number) { selectedMz.value = mz }
</script>
