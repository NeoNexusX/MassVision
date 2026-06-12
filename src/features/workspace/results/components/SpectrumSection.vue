<script setup lang="ts">
import { computed } from 'vue'
import AverageSpectrum from '@/features/workspace/results/components/visuals/AverageSpectrum.vue'
import {
  mzAxisRef,
  meanChartData,
  spectrumLoading,
  spectrumError,
  nMz,
  findClosestPeak,
  loadMeanSpectrum,
} from '@/features/workspace/results/composables/useZarrIonImage'

const props = defineProps<{
  selectedMz: number
  selectedMzIndex: number
  mzTolerance: number
  intensityRange?: string
}>()

const emit = defineEmits<{
  /** Forwarded upwards: global mz_axis index of the clicked bar. */
  (e: 'select-mz-index', index: number): void
}>()

const totalPeaks = computed(() =>
  mzAxisRef.value ? mzAxisRef.value.length.toLocaleString() : '--',
)

// Map clicked m/z value → index of strongest peak within the tolerance window.
function onSelectMz(mz: number, tolerance: number) {
  const idx = findClosestPeak(mz, tolerance)
  if (idx >= 0) emit('select-mz-index', idx)
}

// Retry mean spectrum load.
async function onRetrySpectrum() {
  await loadMeanSpectrum()
}
</script>

<template>
  <div class="shrink-0 h-80 card bg-base-100 border border-base-200 rounded-xl p-4">
    <AverageSpectrum
      :chart-data="meanChartData"
      :selected-mz-index="selectedMzIndex"
      :selected-mz="selectedMz"
      :loading="spectrumLoading"
      :error="spectrumError"
      :n-mz="nMz"
      @select-mz="onSelectMz"
      @retry="onRetrySpectrum"
    />
  </div>

  <div class="shrink-0 flex flex-wrap gap-4 text-lg text-base-content/60 pl-4 pr-1">
    <span>
      Peaks:
      <strong class="text-base-content">{{ totalPeaks }}</strong>
    </span>
    <span>
      Intensity:
      <strong class="text-base-content">{{ intensityRange }}</strong>
    </span>
    <span>
      Selected:
      <strong class="text-base-content font-mono">{{ selectedMz.toFixed(4) }}</strong>
    </span>
    <span>
      Tolerance:
      <strong class="text-base-content font-mono">&plusmn;{{ mzTolerance }}</strong>
    </span>
  </div>
</template>
