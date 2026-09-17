<script setup lang="ts">
import { computed } from 'vue'
import AverageSpectrum from '@/features/vizworkbench/components/visuals/AverageSpectrum.vue'
import {
  mzAxisRef,
  meanChartData,
  spectrumLoading,
  spectrumError,
  findClosestMzIndex,
  loadMeanSpectrum,
  pixelSpectrum,
  pixelSpectrumLoading,
  pixelSpectrumError,
  loadPixelSpectrum,
} from '@/features/vizworkbench/composables/useZarrIonImage'
import type { DataMode } from '@/services/zarr/types/zarr'
import { formatNumber } from '@/shared/utils/format'
import { t } from '@/i18n'

const props = defineProps<{
  isStale?: boolean
  selectedMz: number
  selectedMzIndex: number
  mzTolerance: number
  intensityRange?: string
  spectrumMode?: string
  /** 数据模式 */
  dataMode?: DataMode | null
}>()

const emit = defineEmits<{
  /** continuous 模式：谱图点击 → 更新离子图 */
  (e: 'select-mz-index', index: number): void
}>()

// ---- continuous 模式数据 ----

const totalPeaks = computed(() => (mzAxisRef.value ? formatNumber(mzAxisRef.value.length) : '--'))

function onSelectMz(mz: number) {
  const idx = findClosestMzIndex(mz)
  if (idx >= 0) emit('select-mz-index', idx)
}

async function onRetryMeanSpectrum() {
  await loadMeanSpectrum()
}

// ---- processed 模式数据 ----

/** 将 processed 模式的逐像素谱转为 chartData 格式 */
const pixelChartData = computed<[number, number][]>(() => {
  const spec = pixelSpectrum.value
  if (!spec) return []
  const { mz, intensity } = spec
  const data: [number, number][] = []
  for (let i = 0; i < mz.length; i++) {
    const v = intensity[i]!
    if (v !== 0 && Number.isFinite(v)) {
      data.push([mz[i]!, v])
    }
  }
  return data
})

/** 当前谱图数据（根据模式选择） */
const currentChartData = computed(() =>
  props.dataMode === 'processed' ? pixelChartData.value : meanChartData.value,
)

/** 当前加载状态 */
const currentLoading = computed(() =>
  props.dataMode === 'processed' ? pixelSpectrumLoading.value : spectrumLoading.value,
)

/** 当前错误状态 */
const currentError = computed(() =>
  props.dataMode === 'processed' ? pixelSpectrumError.value : spectrumError.value,
)

/** 当前谱图重试 */
async function onRetry() {
  if (props.dataMode === 'processed') {
    const spec = pixelSpectrum.value
    if (spec) await loadPixelSpectrum(spec.pixelIndex)
  } else {
    await onRetryMeanSpectrum()
  }
}

// ---- 底部统计信息 ----

/** continuous 模式的底部统计 */
const continuousStats = computed<{ label: string; value: string }[]>(() => [
  { label: t('vizworkbench.spectrum.peaks'), value: totalPeaks.value },
  { label: t('vizworkbench.spectrum.intensity'), value: props.intensityRange ?? '--' },
  { label: t('vizworkbench.spectrum.selected'), value: props.selectedMz.toFixed(6) },
  { label: t('vizworkbench.spectrum.tolerance'), value: `±${props.mzTolerance}` },
])

/** processed 模式的底部统计 */
const processedStats = computed<{ label: string; value: string }[]>(() => {
  const spec = pixelSpectrum.value
  return [
    { label: t('vizworkbench.spectrum.peaks'), value: formatNumber(pixelChartData.value.length) },
    {
      label: t('vizworkbench.spectrum.pixel'),
      value: spec ? `(${spec.x}, ${spec.y})` : '--',
    },
  ]
})

/** 当前统计信息 */
const currentStats = computed(() =>
  props.dataMode === 'processed' ? processedStats.value : continuousStats.value,
)
</script>

<template>
  <!-- 桌面端在首屏剩余空间内与离子图按 2:5 分高，并允许随视口收缩。 -->
  <div
    class="shrink-0 lg:h-auto lg:min-h-0 lg:flex-[2_1_0%] lg:shrink card bg-base-100 border-2 border-base-content/30 p-2"
  >
    <div
      v-if="isStale"
      class="flex-1 flex items-center justify-center text-base-content/40 kawaru-text-95"
    >
      {{ $t('vizworkbench.spectrum.noData') }}
    </div>
    <div
      v-else-if="dataMode === 'processed' && !pixelSpectrum"
      class="flex-1 flex items-center justify-center text-base-content/40 kawaru-text-95"
    >
      <template v-if="pixelSpectrumLoading">
        <span class="loading loading-spinner loading-lg text-primary mr-3"></span>
        <div class="text-center">
          <div>{{ $t('vizworkbench.spectrum.loading') }}</div>
          <div class="text-base-content/40 mt-1">
            {{ $t('vizworkbench.spectrum.firstLoadHint') }}
          </div>
        </div>
      </template>
      <template v-else>{{ $t('vizworkbench.spectrum.clickPixelHint') }}</template>
    </div>
    <AverageSpectrum
      v-else
      :chart-data="currentChartData"
      :selected-mz-index="selectedMzIndex"
      :selected-mz="selectedMz"
      :loading="currentLoading"
      :error="currentError"
      :spectrum-mode="spectrumMode"
      :data-mode="dataMode"
      @select-mz="onSelectMz"
      @retry="onRetry"
    />
  </div>

  <!-- 底部统计信息 -->
  <div class="shrink-0 flex flex-wrap gap-4 kawaru-text-95 text-base-content/60 pl-4 pr-1">
    <span v-for="stat in currentStats" :key="stat.label">
      {{ $t('common.format.labelColon', { label: stat.label }) }}
      <strong class="text-base-content font-mono">{{ stat.value }}</strong>
    </span>
  </div>
</template>
