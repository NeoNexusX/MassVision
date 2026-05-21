<script setup lang="ts">
import AverageSpectrum from '@/features/workspace/results/components/visuals/AverageSpectrum.vue'

defineProps<{
  selectedMz: number
  mzTolerance: number
  spectrumStats: {
    totalPeaks: string
    intensityRange: string
  }
}>()

defineEmits<{
  (e: 'select-mz', value: number): void
}>()
</script>

<template>
  <div class="shrink-0 h-80 card bg-base-100 border border-base-200 rounded-xl p-4">
    <AverageSpectrum :selected-mz="selectedMz" @select-mz="$emit('select-mz', $event)" />
  </div>

  <div class="shrink-0 flex flex-wrap gap-4 text-lg text-base-content/60 px-1">
    <span>
      Peaks:
      <strong class="text-base-content">{{ spectrumStats.totalPeaks }}</strong>
    </span>
    <span>
      Intensity:
      <strong class="text-base-content">{{ spectrumStats.intensityRange }}</strong>
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
