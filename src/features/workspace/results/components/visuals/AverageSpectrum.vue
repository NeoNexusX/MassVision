<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-3">
      <div>
        <h3 class="text-lg font-semibold">Average Spectrum</h3>
        <p class="text-sm text-base-content/50">Mean intensity from all ion images</p>
      </div>
      <div v-if="!loading && !error" class="ml-auto text-base text-base-content/50 font-mono">
        {{ nMz.toLocaleString() }} peaks
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 bg-base-200 rounded-lg border border-base-300"
    >
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="text-lg text-base-content/60">Loading average spectrum...</p>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 bg-base-200 rounded-lg border border-base-300"
    >
      <div class="text-error text-4xl">!</div>
      <p class="text-lg text-error font-semibold">Failed to load data</p>
      <p class="text-base text-base-content/50 max-w-md text-center">{{ error }}</p>
      <button class="btn btn-sm btn-outline mt-2" @click="$emit('retry')">Retry</button>
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
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

type ChartPoint = [number, number]

const props = defineProps<{
  /** Non-zero [mz, intensity] pairs in mz_axis order. */
  chartData: ChartPoint[]
  /** Global mz_axis index of the currently selected peak. Source of truth for the red marker line. */
  selectedMzIndex?: number
  /** The m/z VALUE at selectedMzIndex (used to place the selector via convertToPixel). */
  selectedMz?: number
  loading: boolean
  error: string | null
  nMz: number
}>()

const emit = defineEmits<{
  /** Emits the m/z VALUE at the clicked pixel and a viewport-based
   *  m/z tolerance (~10px worth) so the parent can find the strongest
   *  real peak near the click. */
  (e: 'select-mz', mz: number, tolerance: number): void
  (e: 'retry'): void
}>()

const chartContainerRef = ref<HTMLDivElement | null>(null)

let chartInstance: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null
let selectorTimer = 0
let isUnmounted = false
// Track the single datazoom listener so we can unregister it cleanly.
let onDataZoom: (() => void) | null = null
// Track the native click handler for cleanup.
let nativeClickHandler: ((e: MouseEvent) => void) | null = null
let nativeMouseDownHandler: ((e: MouseEvent) => void) | null = null
let nativeMouseDownX = 0

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
  const idx = props.selectedMzIndex
  const mz = props.selectedMz
  if (idx == null || idx < 0 || mz == null) {
    return [
      { id: 'mz-selector-line', $action: 'remove' },
      { id: 'mz-selector-label', $action: 'remove' },
    ]
  }
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
 * "setOption should not be called during main process" warning.
 */
function scheduleSelectorUpdate() {
  if (selectorTimer) return
  selectorTimer = window.setTimeout(() => {
    selectorTimer = 0
    updateSelector()
  }, 0)
}

function renderChart() {
  const container = chartContainerRef.value
  if (!container) { console.warn('[AverageSpectrum] No chart container'); return }
  if (isUnmounted) return

  chartInstance?.dispose()
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
        axisPointer: { label: { show: false } },
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
          type: 'bar', data: props.chartData, barWidth: 3, barGap: '-100%',
          itemStyle: { color: '#374151' },
          large: true,
        },
      ],
      animation: false,
    },
    { notMerge: true },
  )

  // Click: native DOM listener bypasses ECharts' hit-testing (which
  // doesn't work with large:true). We use capture phase so ECharts
  // canvas doesn't swallow the event. A 3px drag threshold prevents
  // dataZoom slider drags from being treated as peak selections.
  const handleMouseDown = (e: MouseEvent) => {
    nativeMouseDownX = e.clientX
  }
  const handleClick = (e: MouseEvent) => {
    // Ignore if mouse moved more than 3px (dataZoom drag, not a click)
    if (Math.abs(e.clientX - nativeMouseDownX) > 3) return
    if (!chartInstance || !chartContainerRef.value) return
    const rect = chartContainerRef.value.getBoundingClientRect()
    const px = e.clientX - rect.left

    // Get grid geometry and axis extent for pixel→m/z interpolation.
    const gridModel = (chartInstance as any).getModel().getComponent('grid', 0)
    const gridRect: { x: number; y: number; width: number; height: number } | undefined =
      gridModel?.coordinateSystem?.getRect?.()
    const xAxis = (chartInstance as any).getModel().getComponent('xAxis', 0)
    const axisExtent = xAxis?.axis?.scale?.getExtent?.() as [number, number] | undefined

    if (!gridRect || !axisExtent) return

    // Outside the plotting area → ignore (axis labels, dataZoom slider, etc.)
    if (px < gridRect.x || px > gridRect.x + gridRect.width) return

    // Linear interpolation: pixel position within the grid → m/z value
    const mz = axisExtent[0] + ((px - gridRect.x) / gridRect.width) * (axisExtent[1] - axisExtent[0])
    if (!Number.isFinite(mz)) return

    // Viewport-based tolerance: ~10px translated to m/z units
    const tolerance = ((axisExtent[1] - axisExtent[0]) / gridRect.width) * 10

    emit('select-mz', mz, tolerance)
  }
  nativeMouseDownHandler = handleMouseDown
  nativeClickHandler = handleClick
  chartContainerRef.value!.addEventListener('mousedown', handleMouseDown, true)
  chartContainerRef.value!.addEventListener('click', handleClick, true)

  // Keep the manual selector glued to its bar through pan / zoom / slider drag.
  onDataZoom = () => scheduleSelectorUpdate()
  chartInstance.on('datazoom', onDataZoom)

  resizeObserver = new ResizeObserver(() => {
    chartInstance?.resize()
    scheduleSelectorUpdate()
  })
  resizeObserver.observe(chartContainerRef.value!)

  // First paint of the selector — safe to call sync here.
  updateSelector()
}

// ===== Lifecycle =====

onMounted(() => {
  // chartData may already be ready when mounted; render immediately if so.
  // If still loading, chart will render when chartData prop changes.
  if (!props.loading && !props.error && props.chartData.length > 0) {
    renderChart()
  }
})

onBeforeUnmount(() => {
  isUnmounted = true
  if (selectorTimer) { clearTimeout(selectorTimer); selectorTimer = 0 }
  if (onDataZoom) { chartInstance?.off('datazoom', onDataZoom); onDataZoom = null }
  if (nativeMouseDownHandler && chartContainerRef.value) {
    chartContainerRef.value.removeEventListener('mousedown', nativeMouseDownHandler, true)
    nativeMouseDownHandler = null
  }
  if (nativeClickHandler && chartContainerRef.value) {
    chartContainerRef.value.removeEventListener('click', nativeClickHandler, true)
    nativeClickHandler = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  chartInstance?.dispose()
  chartInstance = null
})

// chartData is loaded asynchronously — re-render when it arrives.
// flush: 'post' is required because the chart container is behind a
// v-else (gated on loading/error), and watchers fire before DOM updates
// by default. Without it, renderChart() sees a null chartContainerRef.
watch(
  () => props.chartData,
  (data) => {
    if (data.length > 0 && !isUnmounted && !props.loading) {
      renderChart()
    }
  },
  { flush: 'post' },
)

// Move the red selector line whenever the selected m/z changes.
watch(
  () => props.selectedMzIndex,
  () => {
    if (!chartInstance) return
    updateSelector()
  },
)
</script>
