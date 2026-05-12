<template>
  <div class="flex flex-col h-screen max-h-screen overflow-hidden bg-base-100">
    <!-- Header -->
    <header class="shrink-0 border-b border-base-200 px-6 py-3">
      <ResultHeader
        :dataset-name="meta.datasetName"
        :analyzer="meta.analyzer"
        :ion-source="meta.ionSource"
        :pixel-size="meta.pixelSize"
        :status="meta.status"
        :methods="methods"
      />
    </header>

    <!-- Main visualization area -->
    <div class="flex-1 min-h-0 flex flex-col p-4 gap-4 overflow-hidden">
      <!-- Top: Ion Image + Color Bar -->
      <div class="flex gap-4 min-h-0 flex-1">
        <!-- Ion Image (primary) -->
        <div class="flex-1 min-h-0 min-w-0 card bg-base-100 border border-base-200 rounded-xl p-4 flex flex-col">
          <IonImageViewer
            :selected-mz="selectedMz"
            :mz-tolerance="mzTolerance"
            :colormap="colormap"
            :intensity-scale="intensityScale"
            :display-min="displayMin"
            :display-max="displayMax"
            :matrix="ionMatrix"
            @update:mz-tolerance="mzTolerance = $event"
            @update:colormap="colormap = $event"
            @update:intensity-scale="intensityScale = $event"
            @reset="resetControls"
          />
        </div>

        <!-- Color Bar (fixed narrow column) -->
        <div class="shrink-0 card bg-base-100 border border-base-200 rounded-xl p-3 flex items-stretch overflow-visible">
          <ColorBar
            :colormap="colormap"
            :global-min="globalMin"
            :global-max="globalMax"
            :display-min="displayMin"
            :display-max="displayMax"
            :histogram="intensityHistogram"
            :info="imageInfo"
            @update:display-min="onDisplayMinChange"
            @update:display-max="onDisplayMaxChange"
          />
        </div>
      </div>

      <!-- Bottom: Spectrum (fixed height) -->
      <div class="shrink-0 h-56 card bg-base-100 border border-base-200 rounded-xl p-4 flex flex-col">
        <SpectrumViewer
          :selected-mz="selectedMz"
          :peaks="spectrumPeaks"
          @select="onSpectrumSelect"
        />
      </div>

      <!-- Footer stats -->
      <div class="shrink-0 flex flex-wrap gap-4 text-xs text-base-content/60 px-1">
        <span>Peaks: <strong class="text-base-content">{{ spectrumStats.totalPeaks }}</strong></span>
        <span>Intensity: <strong class="text-base-content">{{ spectrumStats.intensityRange }}</strong></span>
        <span>Selected: <strong class="text-base-content font-mono">{{ selectedMz.toFixed(4) }}</strong></span>
        <span>Tolerance: <strong class="text-base-content font-mono">&plusmn;{{ mzTolerance }}</strong></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import ResultHeader from '@/components/workspace/visuals/ResultHeader.vue'
import IonImageViewer from '@/components/workspace/visuals/IonImageViewer.vue'
import ColorBar from '@/components/workspace/visuals/ColorBar.vue'
import SpectrumViewer from '@/components/workspace/visuals/SpectrumViewer.vue'
import type { SpectrumPeak } from '@/components/workspace/visuals/SpectrumViewer.vue'

// ─── Metadata (mock; replace with API later) ───
const meta = reactive({
  datasetName: 'S-2406-001483_3_S3_SM_Neg_20260406_AQ',
  analyzer: 'Orbitrap',
  ionSource: 'MALDI',
  pixelSize: '20 × 20 µm',
  status: 'Completed',
})

const methods = ref(['TIC Normalization', 'Gaussian Smoothing', 'Peak Picking'])

// ─── Shared viewer state ───
const selectedMz = ref(885.549)
const mzTolerance = ref(0.01)
const colormap = ref('viridis')
const intensityScale = ref('linear')

// --- Display range state ---
const globalMin = ref(0)
const globalMax = ref(1.2e6)
const displayMin = ref(0 + (1.2e6 - 0) * 0.01)   // P1
const displayMax = ref(1.2e6 - (1.2e6 - 0) * 0.01) // P99

function onDisplayMinChange(v: number) {
  displayMin.value = v
}

function onDisplayMaxChange(v: number) {
  displayMax.value = v
}

function resetControls() {
  selectedMz.value = 885.549
  mzTolerance.value = 0.01
  colormap.value = 'viridis'
  intensityScale.value = 'linear'
  displayMin.value = globalMin.value + (globalMax.value - globalMin.value) * 0.01
  displayMax.value = globalMax.value - (globalMax.value - globalMin.value) * 0.01
}

// ─── Ion image data (null = use mock inside component) ───
const ionMatrix = ref<number[][] | null>(null)

// ─── Intensity histogram (mock, 32 bins) ───
const intensityHistogram = computed(() => {
  // Approximate distribution for mock data: centered blob + noise
  const bins = 48
  const hist: number[] = new Array(bins).fill(0)
  const gMin = globalMin.value
  const gMax = globalMax.value
  // Sample a representative subset of the 300×400 mock
  const rows = 300, cols = 400
  const cx = cols / 2, cy = rows * 0.46
  const rx = cols * 0.42, ry = rows * 0.44
  for (let r = 0; r < rows; r += 4) {
    for (let c = 0; c < cols; c += 4) {
      const nx = (c - cx) / rx, ny = (r - cy) / ry
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
  pixels: '300 × 400',
  nonZero: '53.2%',
  totalIon: '2.1e10',
  imzML: meta.datasetName?.slice(-20) ?? '',
  polarity: 'Negative',
}))

// ─── Spectrum data (null = use mock inside component) ───
const spectrumPeaks = ref<SpectrumPeak[] | null>(null)

const spectrumStats = computed(() => {
  const peaks = spectrumPeaks.value
  if (!peaks || !peaks.length) {
    return { totalPeaks: '~1,000', intensityRange: '0 – 1.2e6' }
  }
  const maxInt = Math.max(...peaks.map(p => p.intensity))
  return {
    totalPeaks: peaks.length.toLocaleString(),
    intensityRange: `0 – ${maxInt.toExponential(1)}`,
  }
})

// ─── Interaction: spectrum click → update selected m/z ───
function onSpectrumSelect(mz: number) {
  selectedMz.value = mz
}
</script>
