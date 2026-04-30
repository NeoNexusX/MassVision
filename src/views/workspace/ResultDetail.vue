<template>
  <div class="p-6 max-w-screen-2xl mx-auto">
    <!-- Summary Bar -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div v-for="(c, idx) in summaryCards" :key="idx" class="card bg-base-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <div class="text-xs text-gray-500">{{ c.label }}</div>
        <div class="text-xl font-semibold mt-1 truncate">{{ c.value }}</div>
      </div>
    </div>

    <!-- Middle: Data Info & Processing Pipeline -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <!-- Data Info -->
      <div class="card bg-base-100 rounded-xl p-6 border border-base-200">
        <h2 class="text-lg font-semibold mb-4">Data Info</h2>
        <div class="space-y-4 text-sm">
          <div>
            <div class="text-xs text-gray-500">Dataset</div>
            <div class="font-medium">{{ meta.datasetName }}</div>
          </div>

          <div>
            <div class="text-xs text-gray-500">Files</div>
            <div class="font-medium">imzML + ibd</div>
          </div>

          <div class="flex gap-4">
            <div class="flex-1">
              <div class="text-xs text-gray-500">Created</div>
              <div class="font-medium">{{ meta.createdAt }}</div>
            </div>
            <div class="flex-1">
              <div class="text-xs text-gray-500">Pixel Size</div>
              <div class="font-medium">{{ meta.pixelSize }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Processing Pipeline -->
      <div class="lg:col-span-2 card bg-base-100 rounded-xl p-6 border border-base-200">
        <h2 class="text-lg font-semibold mb-4">Processing Pipeline</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="(m, i) in methods" :key="i" class="badge badge-outline">{{ m }}</span>
        </div>

        <div class="mt-6 text-sm text-base-content/70">
          <div class="mb-2">Notes</div>
          <div class="bg-base-200 p-3 rounded text-sm">Pipeline executed with default parameters. Parameters are stored with the analysis record for reproducibility.</div>
        </div>
      </div>
    </div>

    <!-- Visualization -->
    <div class="card bg-base-100 rounded-xl p-6 border border-base-200 mb-6">
      <h2 class="text-lg font-semibold mb-4">Visualizations</h2>

      <div class="flex flex-col lg:flex-row gap-6">
        <!-- Ion Image -->
        <div class="lg:flex-1 rounded-xl border border-base-200 bg-white p-4 flex flex-col">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-md font-semibold">Ion Image</h3>
              <div class="text-xs text-gray-500">Per-pixel ion intensity map</div>
            </div>

            <div class="flex items-center gap-2">
              <select v-model="controls.colormap" class="select select-sm w-36">
                <option value="viridis">Viridis</option>
                <option value="magma">Magma</option>
                <option value="plasma">Plasma</option>
              </select>
              <button @click="resetControls" class="btn btn-sm btn-ghost">Reset</button>
            </div>
          </div>

          <div class="h-96 bg-base-200 rounded-lg flex items-center justify-center border border-base-300">
            <div class="text-center text-base-content/60">
              <div class="text-sm">Ion Image Placeholder</div>
              <div class="text-xs mt-2">Colormap: {{ controls.colormap }}</div>
            </div>
          </div>
        </div>

        <!-- Spectrum -->
        <div class="lg:flex-1 rounded-xl border border-base-200 bg-white p-4 flex flex-col">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-md font-semibold">Spectrum</h3>
              <div class="text-xs text-gray-500">Average spectrum across selected region</div>
            </div>
            <div class="text-sm text-gray-500">&nbsp;</div>
          </div>

          <div class="flex-1 h-96 bg-base-200 rounded-lg border border-base-300 flex items-center justify-center">
            <div class="text-center text-base-content/60">Spectrum Chart Placeholder</div>
          </div>
        </div>
      </div>

      <!-- Spectrum Summary -->
      <div class="mt-6 flex flex-col sm:flex-row gap-4">
        <div class="sm:flex-1 card p-4 rounded-xl bg-base-100 border border-base-200">
          <div class="text-xs text-gray-500">Total Peaks</div>
          <div class="text-lg font-semibold">{{ spectrum.totalPeaks }}</div>
        </div>
        <div class="card p-4 rounded-xl bg-base-100 border border-base-200">
          <div class="text-xs text-gray-500">Intensity Range</div>
          <div class="text-lg font-semibold">{{ spectrum.intensityRange }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'

// Mock metadata (replace with API data later)
const meta = reactive({
  datasetName: 'S-2406-001483_3_S3_SM_Neg_20260406_AQ',
  createdAt: '2026-04-21',
  pixelSize: '20 × 20 µm',
  analyzer: 'Orbitrap',
  ionSource: 'MALDI',
  status: 'Completed'
})

const methods = ref(['TIC Normalization', 'Gaussian Smoothing', 'Peak Picking'])

const summaryCards = [
  { label: 'Dataset', value: meta.datasetName },
  { label: 'Analyzer', value: meta.analyzer },
  { label: 'Ion Source', value: meta.ionSource },
  { label: 'Status', value: meta.status }
]

const controls = reactive({ colormap: 'viridis' })
const spectrum = reactive({ totalPeaks: 124, intensityRange: '0 - 1.2e6' })

function resetControls() {
  controls.colormap = 'viridis'
}
</script>
