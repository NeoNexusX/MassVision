<template>
  <div class="flex flex-col h-full">
    <!-- 标题区 -->
    <div class="flex items-center gap-3 mb-3">
      <div>
        <h3 class="text-lg font-semibold">{{ title }}</h3>
        <p class="text-sm text-base-content/50">{{ description }}</p>
      </div>
      <div v-if="!loading && !error && showPeakCount" class="ml-auto text-base text-base-content/50 font-mono">
        {{ peakCountLabel }}
      </div>
    </div>

    <!-- 加载中 -->
    <div
      v-if="loading"
      class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 bg-base-200 rounded-lg border border-base-300"
    >
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="text-lg text-base-content/60">{{ loadingText }}</p>
    </div>

    <!-- 错误 -->
    <div
      v-else-if="error"
      class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 bg-base-200 rounded-lg border border-base-300"
    >
      <div class="text-error text-4xl">!</div>
      <p class="text-lg text-error font-semibold">Failed to load data</p>
      <p class="text-base text-base-content/50 max-w-md text-center">{{ error }}</p>
      <button class="btn btn-sm btn-outline mt-2" @click="$emit('retry')">Retry</button>
    </div>

    <!-- 谱图 -->
    <div
      v-else
      ref="chartContainerRef"
      class="flex-1 min-h-0 bg-base-100 rounded-lg border border-base-300 overflow-hidden"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import type { DataMode } from '@/services/zarrOssStore'

type ChartPoint = [number, number]

const props = defineProps<{
  /** [mz, intensity] 数据对（按 mz 排序） */
  chartData: ChartPoint[]
  /** 全局 mz_axis 中当前选中峰的索引（仅 continuous 模式使用） */
  selectedMzIndex?: number
  /** 当前选中 m/z 值（用于绘制红色标记线） */
  selectedMz?: number
  loading: boolean
  error: string | null
  /** 总峰数（continuous 模式为 nMz，processed 模式为选中像素的峰数） */
  nMz: number
  /** 'centroid' → 柱状图, 'profile' → 折线图 */
  spectrumMode?: string
  /** 数据模式 */
  dataMode?: DataMode | null
  /** processed 模式下的像素信息 */
  pixelInfo?: { x: number; y: number } | null
}>()

const emit = defineEmits<{
  /** continuous 模式：点击谱图上的 m/z 位置 */
  (e: 'select-mz', mz: number, tolerance: number): void
  (e: 'retry'): void
}>()

const chartContainerRef = ref<HTMLDivElement | null>(null)

/** 谱图标题 */
const title = computed(() => {
  if (props.dataMode === 'processed' && props.pixelInfo) {
    return `Spectrum — Pixel (${props.pixelInfo.x}, ${props.pixelInfo.y})`
  }
  return props.dataMode === 'processed' ? 'Spectrum' : 'Average Spectrum'
})

/** 描述文本 */
const description = computed(() => {
  if (props.dataMode === 'processed') {
    return props.pixelInfo
      ? `Per-pixel spectrum at (${props.pixelInfo.x}, ${props.pixelInfo.y})`
      : 'Click a pixel on the TIC image to view its spectrum'
  }
  return 'Mean intensity from all ion images'
})

/** 加载中文本 */
const loadingText = computed(() =>
  props.dataMode === 'processed' ? 'Loading spectrum...' : 'Loading average spectrum...',
)

/** 是否显示峰数 */
const showPeakCount = computed(() =>
  props.dataMode !== 'processed' || (props.dataMode === 'processed' && props.chartData.length > 0),
)

/** 峰数标签 */
const peakCountLabel = computed(() => {
  const count = props.chartData.length
  return `${count.toLocaleString()} peaks`
})

// ---- ECharts 实例管理 ----

let chartInstance: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null
let selectorTimer = 0
let isUnmounted = false
let onDataZoom: (() => void) | null = null
let nativeClickHandler: ((e: MouseEvent) => void) | null = null
let nativeMouseDownHandler: ((e: MouseEvent) => void) | null = null
let nativeMouseDownX = 0

/**
 * 构建红色选择线的 graphic 配置。
 * 只在 continuous 模式下显示；processed 模式没有共享 m/z 轴，不显示。
 */
function buildSelectorGraphic(): unknown[] {
  if (!chartInstance) return []
  // processed 模式不显示选择线
  if (props.dataMode === 'processed') {
    return [
      { id: 'mz-selector-line', $action: 'remove' },
      { id: 'mz-selector-label', $action: 'remove' },
    ]
  }
  const idx = props.selectedMzIndex
  const mz = props.selectedMz
  if (idx == null || idx < 0 || mz == null) {
    return [
      { id: 'mz-selector-line', $action: 'remove' },
      { id: 'mz-selector-label', $action: 'remove' },
    ]
  }
  const x = chartInstance.convertToPixel({ xAxisIndex: 0 }, mz)
  const gridModel = (chartInstance as any).getModel().getComponent('grid', 0)
  const gridRect = gridModel?.coordinateSystem?.getRect?.()
  const topY = gridRect ? gridRect.y : 24
  const bottomY = gridRect ? gridRect.y + gridRect.height : 200
  const label = mz

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

function updateSelector() {
  if (!chartInstance) return
  chartInstance.setOption({ graphic: buildSelectorGraphic() as any })
}

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

  // 清理旧的事件和实例
  if (nativeMouseDownHandler) {
    container.removeEventListener('mousedown', nativeMouseDownHandler, true)
    nativeMouseDownHandler = null
  }
  if (nativeClickHandler) {
    container.removeEventListener('click', nativeClickHandler, true)
    nativeClickHandler = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null

  chartInstance?.dispose()
  chartInstance = echarts.init(container)

  const isProfile = props.spectrumMode === 'profile'
  const isProcessed = props.dataMode === 'processed'

  chartInstance.setOption(
    {
      tooltip: {
        trigger: 'axis',
        formatter(params: unknown) {
          const items = params as Array<{ data: ChartPoint; dataIndex: number }>
          if (!items?.length) return ''
          const [mz, intensity] = items[0]!.data
          return `<div class="font-mono text-xs">
            <div>m/z: <strong>${mz}</strong></div>
            <div>Intensity: <strong>${intensity}</strong></div>
          </div>`
        },
      },
      grid: { left: 64, right: 24, top: 24, bottom: 72 },
      xAxis: {
        type: 'value',
        name: 'm/z',
        scale: true,
        nameLocation: 'center',
        nameGap: 28,
        axisLabel: {},
        axisPointer: { label: { show: false } },
        nameTextStyle: { fontSize: 15, color: '#6b7280' },
        axisLine: { lineStyle: { color: '#9ca3af' } },
        axisTick: { lineStyle: { color: '#9ca3af' } },
        splitLine: { lineStyle: { color: '#e5e7eb', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'Intensity',
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
          type: 'slider', start: 0, end: 100, height: 24, bottom: 8,
          borderColor: '#d1d5db', fillerColor: 'rgba(59, 130, 246, 0.12)',
          handleStyle: { color: '#3b82f6' }, textStyle: { fontSize: 13 },
        },
      ],
      series: [
        isProfile
          ? {
              id: 'spectrum-series',
              type: 'line',
              data: props.chartData,
              showSymbol: false,
              lineStyle: { color: '#374151', width: 2 },
              areaStyle: { color: 'rgba(55, 65, 81, 0.06)' },
            }
          : {
              id: 'spectrum-series',
              type: 'bar',
              data: props.chartData,
              barWidth: 3,
              barGap: '-100%',
              itemStyle: { color: '#374151' },
              large: true,
            },
      ],
      animation: false,
    },
    { notMerge: true },
  )

  // ---- 点击事件（仅 continuous 模式） ----

  if (!isProcessed) {
    const handleMouseDown = (e: MouseEvent) => {
      nativeMouseDownX = e.clientX
    }
    const handleClick = (e: MouseEvent) => {
      if (Math.abs(e.clientX - nativeMouseDownX) > 3) return
      if (!chartInstance || !chartContainerRef.value) return
      const rect = chartContainerRef.value.getBoundingClientRect()
      const px = e.clientX - rect.left

      const gridModel = (chartInstance as any).getModel().getComponent('grid', 0)
      const gridRect: { x: number; y: number; width: number; height: number } | undefined =
        gridModel?.coordinateSystem?.getRect?.()
      const xAxis = (chartInstance as any).getModel().getComponent('xAxis', 0)
      const axisExtent = xAxis?.axis?.scale?.getExtent?.() as [number, number] | undefined

      if (!gridRect || !axisExtent) return
      if (px < gridRect.x || px > gridRect.x + gridRect.width) return

      const mz = axisExtent[0] + ((px - gridRect.x) / gridRect.width) * (axisExtent[1] - axisExtent[0])
      if (!Number.isFinite(mz)) return

      const tolerance = ((axisExtent[1] - axisExtent[0]) / gridRect.width) * 10
      emit('select-mz', mz, tolerance)
    }
    nativeMouseDownHandler = handleMouseDown
    nativeClickHandler = handleClick
    chartContainerRef.value!.addEventListener('mousedown', handleMouseDown, true)
    chartContainerRef.value!.addEventListener('click', handleClick, true)
  }

  // dataZoom 监听
  onDataZoom = () => scheduleSelectorUpdate()
  chartInstance.on('datazoom', onDataZoom)

  // 响应式调整
  resizeObserver = new ResizeObserver(() => {
    chartInstance?.resize()
    scheduleSelectorUpdate()
  })
  resizeObserver.observe(chartContainerRef.value!)

  updateSelector()
}

// ===== 生命周期 =====

onMounted(() => {
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

// chartData 变化时重新渲染
watch(
  () => props.chartData,
  (data) => {
    if (data.length > 0 && !isUnmounted && !props.loading) {
      renderChart()
    }
  },
  { flush: 'post' },
)

// 选中 m/z 变化时移动红线
watch(
  () => props.selectedMzIndex,
  () => {
    if (!chartInstance) return
    updateSelector()
  },
)

// spectrumMode 变化时重新渲染
watch(
  () => props.spectrumMode,
  () => {
    if (props.chartData.length > 0 && !isUnmounted && !props.loading) {
      renderChart()
    }
  },
)
</script>
