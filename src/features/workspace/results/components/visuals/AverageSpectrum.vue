<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-3">
      <div>
        <h3 class="text-lg font-semibold">Average Spectrum</h3>
        <p class="text-sm text-base-content/50">Mean intensity across all pixels for each m/z</p>
      </div>
      <div v-if="!loading && !error" class="ml-auto text-base text-base-content/50 font-mono">
        {{ nMz.toLocaleString() }} m/z bins
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 bg-base-200 rounded-lg border border-base-300"
    >
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="text-lg text-base-content/60">Calculating mean spectrum...</p>
      <div class="w-64 bg-base-300 rounded-full h-2 overflow-hidden">
        <div
          class="bg-primary h-full rounded-full transition-all duration-300"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
      <p class="text-base text-base-content/40 font-mono">{{ progress }}%</p>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 bg-base-200 rounded-lg border border-base-300"
    >
      <div class="text-error text-4xl">!</div>
      <p class="text-lg text-error font-semibold">Failed to load data</p>
      <p class="text-base text-base-content/50 max-w-md text-center">{{ error }}</p>
      <button class="btn btn-sm btn-outline mt-2" @click="loadData">Retry</button>
    </div>

    <!-- Chart -->
    <div
      v-else
      ref="chartContainerRef"
      class="flex-1 min-h-0 bg-white rounded-lg border border-base-300 overflow-hidden"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { FetchStore, open, get, slice } from 'zarrita'

const props = defineProps<{
  zarrPath?: string
  selectedMz?: number
}>()

const emit = defineEmits<{
  (e: 'select-mz', mz: number): void
}>()

const chartContainerRef = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const progress = ref(0)
const nMz = ref(0)

let chartInstance: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

function calculateMean(values: Float32Array | Float64Array | number[]): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < values.length; i++) {
    const val = values[i]!
    if (Number.isFinite(val)) {
      sum += val
      count++
    }
  }
  return count > 0 ? sum / count : 0
}

async function loadData() {
  loading.value = true
  error.value = null
  progress.value = 0

  await nextTick()

  try {
    const zarrPath = props.zarrPath ?? '/ion_image_output.zarr'
    const zarrUrl = new URL(zarrPath, window.location.origin).href

    const store = new FetchStore(zarrUrl)
    const root = await open(store, { kind: 'group' })

    const mzArray = await open(root.resolve('mz_axis'), { kind: 'array' })
    const ionArray = await open(root.resolve('ion_images'), { kind: 'array' })

    const mzChunk = await get(mzArray)
    const mzData = mzChunk.data as Float64Array
    const totalMz = mzData.length
    nMz.value = totalMz

    const chunkSize = 16
    const meanSpectrum = new Float64Array(totalMz)
    const planeSize = ionArray.shape[1]! * ionArray.shape[2]!

    for (let start = 0; start < totalMz; start += chunkSize) {
      const end = Math.min(start + chunkSize, totalMz)
      const count = end - start

      const chunkResult = await get(ionArray, [slice(start, end), null, null])
      const chunkData = chunkResult.data as Float32Array

      for (let j = 0; j < count; j++) {
        const offset = j * planeSize
        const plane = chunkData.subarray(offset, offset + planeSize)
        meanSpectrum[start + j] = calculateMean(plane)
      }

      progress.value = Math.round((end / totalMz) * 100)
    }

    const chartData: [number, number][] = []
    for (let i = 0; i < totalMz; i++) {
      chartData.push([mzData[i]!, meanSpectrum[i]!])
    }

    loading.value = false
    await nextTick()
    renderChart(chartData)
  } catch (e) {
    console.error('[AverageSpectrum] Error:', e)
    loading.value = false
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function renderChart(data: [number, number][]) {
  const container = chartContainerRef.value
  if (!container) {
    console.warn('[AverageSpectrum] No chart container')
    return
  }

  chartInstance?.dispose()
  chartInstance = echarts.init(container)

  chartInstance.setOption(
    {
      tooltip: {
        trigger: 'axis',
        formatter(params: unknown) {
          const items = params as Array<{ data: [number, number] }>
          if (!items?.length) return ''
          const [mz, intensity] = items[0]!.data
          return `
            <div class="font-mono text-xs">
              <div>m/z: <strong>${mz.toFixed(4)}</strong></div>
              <div>Mean intensity: <strong>${intensity.toFixed(4)}</strong></div>
            </div>
          `
        },
      },
      grid: {
        left: 64,
        right: 24,
        top: 24,
        bottom: 72,
      },
      xAxis: {
        type: 'value',
        name: 'm/z',
        scale: true,
        nameLocation: 'center',
        nameGap: 28,
        nameTextStyle: { fontSize: 15, color: '#6b7280' },
        axisLine: { lineStyle: { color: '#9ca3af' } },
        axisTick: { lineStyle: { color: '#9ca3af' } },
        splitLine: { lineStyle: { color: '#e5e7eb', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'Mean intensity',
        nameLocation: 'center',
        nameGap: 48,
        nameTextStyle: { fontSize: 17, color: '#6b7280' },
        axisLine: { lineStyle: { color: '#9ca3af' } },
        axisTick: { lineStyle: { color: '#9ca3af' } },
        splitLine: { lineStyle: { color: '#e5e7eb', type: 'dashed' } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 24,
          bottom: 8,
          borderColor: '#d1d5db',
          fillerColor: 'rgba(59, 130, 246, 0.12)',
          handleStyle: { color: '#3b82f6' },
          textStyle: { fontSize: 13 },
        },
      ],
      series: [
        {
          type: 'bar',
          data,
          barWidth: 0.5,
          barGap: '-100%',
          itemStyle: { color: '#374151' },
          large: true,
          largeThreshold: 5000,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#ef4444', width: 1.5, type: 'solid' },
            data: props.selectedMz != null ? [{ xAxis: props.selectedMz }] : [],
            label: { show: false },
          },
        },
      ],
      animation: false,
    },
    { notMerge: true },
  )

  chartInstance.off('click')
  chartInstance.on('click', (params: unknown) => {
    const p = params as { data?: [number, number] }
    if (p.data && Array.isArray(p.data)) {
      emit('select-mz', p.data[0])
    }
  })

  resizeObserver = new ResizeObserver(() => {
    chartInstance?.resize()
  })
  resizeObserver.observe(container)
}

onMounted(() => {
  loadData()
})

onBeforeUnmount(() => {
  chartInstance?.dispose()
  chartInstance = null
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({ reload: loadData })

watch(
  () => props.selectedMz,
  (mz) => {
    if (!chartInstance) return
    chartInstance.setOption({
      series: [
        {
          markLine: {
            data: mz != null ? [{ xAxis: mz }] : [],
          },
        },
      ],
    })
  },
)
</script>
