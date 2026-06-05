<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-3">
      <div>
        <h3 class="text-lg font-semibold">Average Spectrum</h3>
        <p class="text-sm text-base-content/50">Mean intensity from all ion images</p>
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
      <p class="text-lg text-base-content/60">Loading chunks ({{ progress }}%)...</p>
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
      class="flex-1 min-h-0 bg-base-100 rounded-lg border border-base-300 overflow-hidden"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { getSharedZarrContext, mzAxisRef } from '@/features/workspace/results/composables/useZarrIonImage'

const props = defineProps<{
  /** Global mz_axis index of the currently selected peak. Source of truth for the red marker line. */
  selectedMzIndex?: number
  runId?: string
}>()

const emit = defineEmits<{
  /** Emits the GLOBAL mz_axis index of the clicked bar (not the m/z value). */
  (e: 'select-mz-index', index: number): void
}>()

const chartContainerRef = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const progress = ref(0)
const nMz = ref(0)

/**
 * chartData holds only non-zero [mz, intensity] points in mz_axis order, so
 * ECharts' click dataIndex is NOT the global mz_axis index — see
 * `findClosestGlobalIndex` and the click handler in `renderChart`.
 */
type ChartPoint = [number, number]
/**
 * Compact array of non-zero [mz, intensity] points, in mz_axis order.
 * Zero values (unloaded chunks / fully-NaN ion images) are omitted from the
 * chart entirely, so ECharts' click dataIndex is NOT the global mz_axis
 * index — we map back via a closest-mz binary search in the click handler.
 */
let chartData: ChartPoint[] = []

/**
 * Hard cap on the number of chunks we pull from OSS up front. Each chunk is
 * a separate HTTP round-trip + decode, and the shared store's LRU cache is
 * only 5 chunks deep — so loading everything serially both blocks the UI
 * for a long time AND thrashes the cache the ion image viewer relies on.
 * m/z whose chunks were not loaded have mean=0 and are dropped from the
 * chart; the click handler recovers the global mz_axis index by
 * binary-searching for the clicked bar's m/z value.
 */
const INITIAL_LOAD_CHUNKS = 200

let chartInstance: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null
let clickCleanup: (() => void) | null = null
let isUnmounted = false

function calculateMean(values: Float32Array | Float64Array | number[]): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < values.length; i++) {
    const val = values[i]!
    if (Number.isFinite(val)) { sum += val; count++ }
  }
  return count > 0 ? sum / count : 0
}

/**
 * Binary-search the GLOBAL mz_axis for the entry closest to `target`.
 * Avoids the floating-point equality pitfall: we never compare two m/z
 * values for strict equality, we just pick whichever neighbor is nearer.
 * Assumes mzAxis is sorted ascending (true for our data).
 */
function findClosestGlobalIndex(mzAxis: Float64Array, target: number): number {
  if (mzAxis.length === 0) return -1
  let lo = 0
  let hi = mzAxis.length - 1
  // Find the first index whose m/z is >= target.
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (mzAxis[mid]! < target) lo = mid + 1
    else hi = mid
  }
  // lo and lo-1 are the two candidates; pick the closer one.
  if (lo > 0) {
    const dLo = Math.abs(mzAxis[lo]! - target)
    const dPrev = Math.abs(mzAxis[lo - 1]! - target)
    if (dPrev < dLo) return lo - 1
  }
  return lo
}

/**
 * Load ion image chunks via the shared ZarrOssStore and compute the mean
 * spectrum. Zero-mean entries (unloaded chunks / fully-NaN ion images) are
 * dropped from the chart after the loop, see the filter block below.
 */
async function loadSpectrum() {
  const { store } = getSharedZarrContext()
  // Use the same Float64 mzAxis instance the ion image / red marker reads from.
  const mzAxis = mzAxisRef.value
  if (!store || !mzAxis) return

  loading.value = true
  error.value = null
  progress.value = 0

  try {
    const shape = store.getIonShape()
    if (!shape || shape.length < 3) throw new Error('Invalid ion_images shape')
    const totalMz = shape[0]!
    nMz.value = totalMz

    const chunkShape = store.getIonChunkShape()
    const cs = chunkShape?.[0] ?? 16
    const totalChunks = Math.ceil(totalMz / cs)
    const chunksToLoad = Math.min(totalChunks, INITIAL_LOAD_CHUNKS)

    // Pre-size so we can write by global index — any chunk that fails or is
    // not loaded just leaves zeros, which the post-loop filter drops.
    const means = new Float64Array(totalMz)

    for (let ck = 0; ck < chunksToLoad; ck++) {
      if (isUnmounted) break
      try {
        const chunk = await store.getIonImageChunk(ck)
        const { width: w, height: h, data } = chunk
        const planeSize = w * h
        const chunkStart = ck * cs
        for (let i = 0; i < chunk.chunkShape[0]; i++) {
          const plane = data.subarray(i * planeSize, (i + 1) * planeSize)
          const globalIdx = chunkStart + i
          if (globalIdx < totalMz) means[globalIdx] = calculateMean(plane)
        }
      } catch {
        // skip individual chunk errors; their m/z stay at 0 and are dropped
        // from the chart by the post-loop filter.
      }
      progress.value = Math.round(((ck + 1) / chunksToLoad) * 100)
    }

    // Filter out zero-mean bars: they correspond to m/z positions with no
    // loaded data (unloaded chunks) or whose ion image is entirely NaN/Inf.
    // Rendering them as 0-height bars is misleading and wastes render work.
    // The click handler maps the displayed bar's m/z back to the global
    // mz_axis index via `findClosestGlobalIndex`, so dropping them is safe.
    chartData = []
    for (let i = 0; i < totalMz; i++) {
      const v = means[i]!
      if (v !== 0) chartData.push([mzAxis[i]!, v])
    }

    loading.value = false
    await nextTick()
    if (!isUnmounted) renderChart()
  } catch (e) {
    console.error('[AverageSpectrum] Error:', e)
    if (!isUnmounted) {
      loading.value = false
      error.value = e instanceof Error ? e.message : String(e)
    }
  }
}

async function loadData() {
  await waitForSharedStore()
  await loadSpectrum()
}

/** Wait for the shared store to be ready, up to 60 seconds */
function waitForSharedStore(timeoutMs = 60000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      const { store } = getSharedZarrContext()
      if (store && mzAxisRef.value && store.getCacheInfo()?.keys != null) { resolve(); return }
      if (Date.now() - start > timeoutMs) {
        console.warn('[AverageSpectrum] timeout waiting for shared store')
        resolve()
        return
      }
      setTimeout(check, 200)
    }
    check()
  })
}

/**
 * Build the ECharts `graphic` payload for the red selector line + label.
 *
 * We render the selector with the `graphic` component instead of `series.markLine`
 * because markLine routes through ECharts' "axis pointer" pipeline which
 * snaps/rounds the x coordinate (verified: data x = 359.0826, computed pixel
 * via convertToPixel = 726.96, but markLine renders meaningfully off). Going
 * through `graphic` lets us place the line at an EXACT pixel x computed
 * ourselves via `convertToPixel`, so it always lines up with its bar.
 *
 * Must be called AFTER the chart is laid out (post-setOption) so
 * `convertToPixel` / `getModel().getComponent('grid')` have valid geometry.
 */
function buildSelectorGraphic(): unknown[] {
  if (!chartInstance) return []
  const axis = mzAxisRef.value
  const idx = props.selectedMzIndex
  if (axis == null || idx == null || idx < 0 || idx >= axis.length) {
    // Return an empty placeholder with the same `id` so ECharts removes the
    // previous line/label cleanly on deselect.
    return [
      { id: 'mz-selector-line', $action: 'remove' },
      { id: 'mz-selector-label', $action: 'remove' },
    ]
  }
  const mz = axis[idx]!
  // Pixel x for this mz on the current axis (already accounts for dataZoom).
  const x = chartInstance.convertToPixel({ xAxisIndex: 0 }, mz)
  // Grid geometry — we only want the line inside the plotting area.
  const gridModel = (chartInstance as any).getModel().getComponent('grid', 0)
  const gridRect = gridModel?.coordinateSystem?.getRect?.()
  const topY = gridRect ? gridRect.y : 24
  const bottomY = gridRect ? gridRect.y + gridRect.height : 200
  const label = mz.toFixed(4)

  return [
    {
      id: 'mz-selector-line',
      type: 'line',
      // `z` puts it above bars; `silent` so it doesn't eat clicks.
      z: 100,
      silent: true,
      shape: { x1: x, y1: topY, x2: x, y2: bottomY },
      style: { stroke: '#ef4444', lineWidth: 1.5 },
    },
    {
      id: 'mz-selector-label',
      type: 'text',
      z: 100,
      silent: true,
      // Slight x offset so the label sits next to the line, not on top of it.
      position: [x + 4, topY - 2],
      style: {
        text: label,
        fill: '#ef4444',
        font: '12px monospace',
        textAlign: 'left',
        textVerticalAlign: 'bottom',
      },
    },
  ]
}

/** Update only the graphic layer — cheap, no re-layout. */
function updateSelector() {
  if (!chartInstance) return
  chartInstance.setOption({ graphic: buildSelectorGraphic() as any })
}

/**
 * Same as updateSelector() but deferred — call this from inside ECharts
 * event handlers (datazoom, resize, etc.) to avoid the
 * "setOption should not be called during main process" warning that fires
 * when we mutate state mid-render. setTimeout(0) bumps the call out of
 * ECharts' current tick.
 */
let selectorRaf = 0
function scheduleSelectorUpdate() {
  if (selectorRaf) return
  selectorRaf = window.setTimeout(() => {
    selectorRaf = 0
    updateSelector()
  }, 0)
}

function renderChart() {
  const container = chartContainerRef.value
  if (!container) { console.warn('[AverageSpectrum] No chart container'); return }

  chartInstance?.dispose()
  clickCleanup?.()
  chartInstance = echarts.init(container)

  chartInstance.setOption(
    {
      tooltip: {
        trigger: 'axis',
        formatter(params: unknown) {
          const items = params as Array<{ data: ChartPoint; dataIndex: number }>
          if (!items?.length) return ''
          const [mz, intensity] = items[0]!.data
          return `<div class="font-mono text-xs">
            <div>m/z: <strong>${mz.toFixed(4)}</strong></div>
            <div>Mean intensity: <strong>${intensity.toFixed(4)}</strong></div>
          </div>`
        },
      },
      grid: { left: 64, right: 24, top: 24, bottom: 72 },
      xAxis: {
        type: 'value', name: 'm/z', scale: true,
        nameLocation: 'center', nameGap: 28,
        axisLabel: { formatter: (v: number) => v.toFixed(4) },
        // The cursor/markLine pointer on the x-axis. Hidden because it
        // displays a pixel-snapped value (e.g. 341.1000) that disagrees with
        // the markLine's true mz_axis value (341.1048) and is misleading.
        axisPointer: { label: { show: false } },
        // Do NOT set `minInterval` here — it makes ECharts quantize the axis
        // domain to that step, which shifts the absolute pixel position of
        // markLine (drawn at e.g. 341.1048) so it no longer sits exactly on
        // its corresponding bar.
        nameTextStyle: { fontSize: 15, color: '#6b7280' },
        axisLine: { lineStyle: { color: '#9ca3af' } },
        axisTick: { lineStyle: { color: '#9ca3af' } },
        splitLine: { lineStyle: { color: '#e5e7eb', type: 'dashed' } },
      },
      yAxis: {
        type: 'value', name: 'Mean intensity',
        nameLocation: 'center', nameGap: 48,
        nameTextStyle: { fontSize: 17, color: '#6b7280' },
        axisLine: { lineStyle: { color: '#9ca3af' } },
        axisTick: { lineStyle: { color: '#9ca3af' } },
        splitLine: { lineStyle: { color: '#e5e7eb', type: 'dashed' } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        {
          type: 'slider', start: 0, end: 100, height: 24, bottom: 8,
          borderColor: '#d1d5db', fillerColor: 'rgba(59, 130, 246, 0.12)',
          handleStyle: { color: '#3b82f6' }, textStyle: { fontSize: 13 },
        },
      ],
      series: [
        {
          id: 'average-spectrum',
          type: 'bar', data: chartData, barWidth: 3, barGap: '-100%',
          itemStyle: { color: '#374151' },
          // NOTE: do NOT enable `large: true` or `sampling` — both would
          // drop/aggregate data points and break the click-to-mz mapping.
          // The click handler reads p.data[0] (the m/z) and binary-searches
          // mz_axis to recover the global index, so any reduction of the
          // data array would make that m/z no longer point at a real bar.
        },
      ],
      animation: false,
    },
    { notMerge: true },
  )

  // ===== Click: map clicked bar's m/z back to the GLOBAL mz_axis index =====
  // chartData only contains non-zero bars, so dataIndex is NOT the global
  // index. We pull the m/z off the bar's data and binary-search mz_axis
  // for the closest entry. We can hand the m/z off to the search directly
  // because ECharts returns the m/z we put into chartData, unchanged.
  chartInstance.off('click')
  chartInstance.on('click', (params: unknown) => {
    const p = params as { data?: ChartPoint; dataIndex?: number }
    if (p.dataIndex == null || p.dataIndex < 0 || p.dataIndex >= chartData.length) return
    const mzAxis = mzAxisRef.value
    if (!mzAxis) return
    const mz = p.data?.[0]
    if (mz == null) return
    const globalIdx = findClosestGlobalIndex(mzAxis, mz)
    if (globalIdx < 0) return
    if (import.meta.env.DEV) {
      console.log('[AverageSpectrum click]', {
        dataIndex: p.dataIndex,
        clickedMz: mz,
        globalIdx,
        axisMz: mzAxis[globalIdx],
      })
    }
    emit('select-mz-index', globalIdx)
  })

  clickCleanup = () => { chartInstance?.off('click') }

  // Keep the manual selector glued to its bar through pan / zoom / slider drag.
  // ECharts fires 'datazoom' synchronously inside its main render pipeline,
  // so we MUST defer the setOption call (scheduleSelectorUpdate uses a
  // setTimeout(0)). We deliberately do NOT subscribe to 'finished' here —
  // updateSelector triggers a graphic setOption which triggers another
  // 'finished', creating an infinite loop.
  const onDataZoom = () => scheduleSelectorUpdate()
  chartInstance.on('datazoom', onDataZoom)
  const prevClickCleanup = clickCleanup
  clickCleanup = () => {
    prevClickCleanup?.()
    chartInstance?.off('datazoom', onDataZoom)
  }

  resizeObserver = new ResizeObserver(() => {
    chartInstance?.resize()
    // resize triggers a layout pass; recompute pixel x after it settles.
    scheduleSelectorUpdate()
  })
  resizeObserver.observe(container)

  // First paint of the selector — safe to call sync here, we're outside
  // ECharts' main render pipeline.
  updateSelector()
}

onMounted(() => { loadData() })

onBeforeUnmount(() => {
  isUnmounted = true
  if (selectorRaf) { clearTimeout(selectorRaf); selectorRaf = 0 }
  clickCleanup?.()
  clickCleanup = null
  chartInstance?.dispose()
  chartInstance = null
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({ reload: loadData })

// Move the red selector line whenever the selected index changes.
watch(
  () => props.selectedMzIndex,
  (idx) => {
    if (!chartInstance) return
    if (import.meta.env.DEV) {
      const mzAxis = mzAxisRef.value
      const mz = idx != null ? mzAxis?.[idx] : null
      if (mz != null) {
        const barPx = chartInstance.convertToPixel({ xAxisIndex: 0 }, mz)
        console.log('[AverageSpectrum selector]', {
          selectedMzIndex: idx,
          axisMz: mz,
          pixelX: barPx,
        })
      }
    }
    updateSelector()
  },
)
</script>
