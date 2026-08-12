<template>
  <div
    :class="[
      // Small screens
      'flex h-[320px] flex-col',
      // Desktop
      'lg:h-full',
    ]"
  >
    <!-- 标题区 -->
    <div class="flex items-center gap-3 mb-3">
      <h3 class="text-lg font-semibold">{{ title }}</h3>
      <div
        v-if="!loading && !error && showPeakCount"
        class="ml-auto text-base text-base-content/50 font-mono"
      >
        {{ peakCountLabel }}
      </div>
    </div>

    <!-- 加载中 -->
    <div
      v-if="loading"
      class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 bg-base-200 rounded-lg border border-base-content/30"
    >
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="text-xl text-base-content/60">{{ loadingText }}</p>
    </div>

    <!-- 错误 -->
    <div
      v-else-if="error"
      class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 bg-base-200 rounded-lg border border-base-content/30"
    >
      <SvgIcon type="warning" class="w-8 h-8 text-error" />
      <p class="text-xl text-error font-semibold">Failed to load data</p>
      <p class="text-lg text-base-content/50 max-w-md text-center">{{ error }}</p>
      <button class="btn btn-sm btn-outline mt-2 text-base" @click="$emit('retry')">Retry</button>
    </div>

    <!-- 谱图 -->
    <div
      v-else
      data-testid="average-spectrum-chart"
      ref="chartContainerRef"
      class="flex-1 min-h-0 bg-base-100  overflow-hidden"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GraphicComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { DataMode } from '@/services/zarr/types/zarr'
import { useTheme } from '@/shared/composables/useTheme'
import { resolveSpectrumPalette } from '../../types/spectrumTheme'

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GraphicComponent,
  CanvasRenderer,
])

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

// ---- 底部垂直布局预算（px）----
// grid.bottom 取各项之和而非写死值，保证轴名/刻度不被 dataZoom 滑块遮挡
const CHART_LAYOUT = {
  /** 刻度数字带（ECharts 默认 12px 字号，渲染 ~9px） */
  axisLabelBand: 10,
  /** "m/z" 轴名字号，需与 xAxis.nameTextStyle.fontSize 一致 */
  axisNameFont: 18,
  /** 轴名空隙，需与 xAxis.nameGap 一致 */
  axisNameMargin: 16,
  /** 滑块厚度，需与 dataZoom slider.height 一致 */
  zoomHeight: 24,
  /** 滑块底距，需与 dataZoom slider.bottom 一致 */
  zoomBottom: 8,
} as const

/** grid.bottom：以上各项之和 */
const GRID_BOTTOM =
  CHART_LAYOUT.axisLabelBand +
  CHART_LAYOUT.axisNameFont +
  CHART_LAYOUT.axisNameMargin +
  CHART_LAYOUT.zoomHeight +
  CHART_LAYOUT.zoomBottom

/** 当前主题对应的整套图表配色（ECharts 不读 CSS 变量，需随主题重建 options） */
const { isDark } = useTheme()
const palette = computed(() => resolveSpectrumPalette(isDark.value ? 'dark' : 'light'))

/** 谱图标题 */
const title = 'Spectrum View'

/** 加载中文本 */
const loadingText = computed(() =>
  props.dataMode === 'processed' ? 'Loading spectrum...' : 'Loading average spectrum...',
)

/** 是否显示峰数 */
const showPeakCount = computed(
  () =>
    props.dataMode !== 'processed' ||
    (props.dataMode === 'processed' && props.chartData.length > 0),
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
  // processed 模式没有共享 m/z 轴，不需要选择线
  if (!chartInstance || props.dataMode === 'processed') return []
  const idx = props.selectedMzIndex
  const mz = props.selectedMz
  if (idx == null || idx < 0 || mz == null) return []
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
      style: { stroke: palette.value.selector, lineWidth: 1.5 },
    },
    {
      id: 'mz-selector-label',
      type: 'text',
      z: 100,
      silent: true,
      position: [x + 4, topY - 2],
      style: {
        text: label,
        fill: palette.value.selector,
        font: '16px monospace',
        textAlign: 'left',
        textVerticalAlign: 'bottom',
      },
    },
  ]
}

function updateSelector() {
  if (!chartInstance || isUnmounted || props.dataMode === 'processed') return
  chartInstance.setOption({ graphic: buildSelectorGraphic() as any })
}

function scheduleSelectorUpdate() {
  if (selectorTimer || props.dataMode === 'processed') return
  selectorTimer = window.setTimeout(() => {
    selectorTimer = 0
    updateSelector()
  }, 0)
}

/**
 * 为 dataZoom 缩略图构建"保峰 + 位置对齐"的抽稀数据。
 *
 * 两个问题都源自 ECharts 缩略图的实现（SliderZoomView.js 的 _renderDataShadow）：
 * 1. 默认按固定步长等间隔抽稀原始 series（每隔 N 个点取 1 个），窄峰容易一个点
 *    都取不到而在缩略图里"消失"——所以按桶取每个桶里的峰值点代替原始点。
 * 2. 非 time 类型坐标轴下，缩略图每个点的横坐标是按"数组下标"均匀排开的
 *    （宽度 / 点数），完全不看该点真实的 m/z 值；主图则是按真实 m/z 值经坐标轴
 *    换算位置。当 chartData 里因过滤零值、centroid 峰间距本就不均匀等原因产生
 *    "空白区间"（该区间的点在数组里整个不存在，而不是值为 0）时，下标就不再和
 *    m/z 值成比例，缩略图形状会和主图错位。所以这里按真实 m/z 值等分桶（而不是
 *    按下标等分），每个桶固定只产出 1 个点（桶内最大值，空桶补一个强度为 0 的
 *    占位点），让输出数组里每个点的"下标顺序"精确对应等宽的真实 m/z 区间，
 *    ECharts 按下标均匀布点的假设才成立（残余误差 ≤ 一个桶的宽度）。
 *
 * 最终作为一个透明的专属 series 插到 series 数组最前面，让 ECharts 的
 * _prepareDataShadowInfo 选中它作为缩略图的数据来源（取匹配到的第一个 series）。
 */
function buildShadowData(data: ChartPoint[], targetWidth: number): ChartPoint[] {
  const bucketCount = Math.max(1, Math.floor(targetWidth))
  // 注意：即便原始点数少于 bucketCount 也不能跳过分桶直接返回原始数据——
  // centroid 峰间距本就不均匀，跳过分桶会让 ECharts 缩略图按"下标均匀"摆点
  // （而不是按真实 m/z），峰位置又会和主图对不上，桶数据这一步就白做了。
  const mzMin = data[0]![0]
  const mzMax = data[data.length - 1]![0]
  const span = mzMax - mzMin
  if (!(span > 0)) return data

  const result: ChartPoint[] = []
  let i = 0
  for (let b = 0; b < bucketCount; b++) {
    const bucketEnd = mzMin + ((b + 1) / bucketCount) * span
    const isLastBucket = b === bucketCount - 1
    let maxIdx = -1
    while (i < data.length && (isLastBucket ? data[i]![0] <= bucketEnd : data[i]![0] < bucketEnd)) {
      if (maxIdx === -1 || data[i]![1] > data[maxIdx]![1]) maxIdx = i
      i++
    }
    if (maxIdx === -1) {
      // 该 m/z 区间内没有数据点（例如强度为零被过滤掉的空白区），补一个基线点占位，
      // 保证后续桶的"下标顺序"依然正比于真实 m/z 位置
      const bucketStart = mzMin + (b / bucketCount) * span
      result.push([bucketStart, 0])
    } else {
      result.push(data[maxIdx]!)
    }
  }
  return result
}

/**
 * 构建完整 ECharts options。提取为独立函数，每次 render 都用
 * notMerge: true 传入，确保 dataZoom 缩略图与主图完全同步。
 */
function buildOptions(targetWidth: number): Record<string, unknown> {
  const isProfile = props.spectrumMode === 'profile'
  const shadowData = buildShadowData(props.chartData, targetWidth)
  const colors = palette.value
  return {
    tooltip: {
      trigger: 'axis',
      formatter(params: unknown) {
        const items = params as Array<{ data: ChartPoint; dataIndex: number }>
        if (!items?.length) return ''
        const [mz, intensity] = items[0]!.data
        return `<div class="font-mono text-base">
            <div><i>m/z</i>: <strong>${mz}</strong></div>
            <div>Intensity: <strong>${intensity}</strong></div>
          </div>`
      },
    },
    grid: { left: 54, right: 54, top: 16, bottom: GRID_BOTTOM },
    xAxis: {
      type: 'value',
      name: 'm/z',
      scale: true,
      // 显式钉死 min/max 为数据真实范围：scale:true 默认会取"nice"整数刻度，
      // 往往比数据实际范围更宽，主图两侧就会留出空白；而 dataZoom 缩略图的阴影
      // 永远是按（抽稀后）数据自身的最小/最大值撑满整个滑块宽度渲染的，不认
      // 这个 nice 范围，于是两者边缘对不齐。钉死后主图也是从数据首尾点撑满，
      // 和缩略图口径一致。
      min: props.chartData[0]?.[0],
      max: props.chartData[props.chartData.length - 1]?.[0],
      nameLocation: 'center',
      nameGap: CHART_LAYOUT.axisNameMargin,
      axisLabel: { color: colors.axis.label },
      axisPointer: { label: { show: false } },
      nameTextStyle: {
        fontSize: CHART_LAYOUT.axisNameFont,
        color: colors.axis.nameText,
        fontFamily: '"Times New Roman", Times, serif',
        fontStyle: 'italic',
      },
      axisLine: { lineStyle: { color: colors.axis.line } },
      axisTick: { lineStyle: { color: colors.axis.line } },
      splitLine: { lineStyle: { color: colors.axis.splitLine, type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: 'Intensity',
      nameLocation: 'center',
      nameGap: 48,
      axisLabel: { color: colors.axis.label },
      nameTextStyle: { fontSize: 20, color: colors.axis.nameText },
      axisLine: { lineStyle: { color: colors.axis.line } },
      axisTick: { lineStyle: { color: colors.axis.line } },
      splitLine: { lineStyle: { color: colors.axis.splitLine, type: 'dashed' } },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
      {
        type: 'slider',
        xAxisIndex: 0,
        start: 0,
        end: 100,
        height: CHART_LAYOUT.zoomHeight,
        bottom: CHART_LAYOUT.zoomBottom,
        borderColor: colors.dataZoom.border,
        fillerColor: colors.dataZoom.filler,
        handleStyle: { color: colors.dataZoom.handle },
        textStyle: { fontSize: 16 },
      },
    ],
    series: [
      // 缩略图专用透明 series：放在数组最前面，供 dataZoom 滑块的 _prepareDataShadowInfo
      // 选中作为缩略图数据源，数据已用 buildShadowData 做过峰值保留抽稀。
      // tooltip.show: false 避免它混入 axis 触发的 tooltip。
      {
        id: 'spectrum-shadow-series',
        type: 'line',
        data: shadowData,
        showSymbol: false,
        silent: true,
        tooltip: { show: false },
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        z: -100,
      },
      isProfile
        ? {
            id: 'spectrum-series',
            type: 'line',
            data: props.chartData,
            showSymbol: false,
            lineStyle: { color: colors.series.line, width: 2 },
            areaStyle: { color: colors.series.area },
          }
        : {
            id: 'spectrum-series',
            type: 'bar',
            data: props.chartData,
            barWidth: 3,
            barGap: '-100%',
            itemStyle: { color: colors.bar },
            large: true,
            // xAxis.min/max 钉死在首尾数据点上，柱子中心正好卡在网格边缘，
            // 默认裁剪会把最左/最右柱子露出网格外的那一半切掉；关掉裁剪即可
            // 完整显示，网格外侧还有 grid.left/right 的边距可以容纳这半根柱子。
            clip: false,
          },
    ],
    animation: false,
  }
}

function renderChart() {
  const container = chartContainerRef.value
  if (!container) {
    console.warn('[AverageSpectrum] No chart container')
    return
  }
  if (isUnmounted) return

  // 同一帧内 onMounted + watch 都会触发，引用相同则跳过
  if (lastData === props.chartData) return
  lastData = props.chartData

  const isProcessed = props.dataMode === 'processed'

  // 清事件
  if (selectorTimer) {
    clearTimeout(selectorTimer)
    selectorTimer = 0
  }
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

  // 彻底销毁重建，保证 dataZoom 缩略图和主图完全一致
  chartInstance?.dispose()
  chartInstance = echarts.init(container)
  chartInstance.setOption(buildOptions(container.clientWidth || 800), { notMerge: true })

  // 注册事件（仅 continuous 模式）

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

      const mz =
        axisExtent[0] + ((px - gridRect.x) / gridRect.width) * (axisExtent[1] - axisExtent[0])
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

  // 仅 continuous 模式需要更新选择线
  if (!isProcessed) updateSelector()
}

// ===== 生命周期 =====

let lastData: ChartPoint[] | null = null

onMounted(() => {
  if (!props.loading && !props.error && props.chartData.length > 0) {
    renderChart()
  }
})

onBeforeUnmount(() => {
  isUnmounted = true
  if (selectorTimer) {
    clearTimeout(selectorTimer)
    selectorTimer = 0
  }
  if (onDataZoom) {
    chartInstance?.off('datazoom', onDataZoom)
    onDataZoom = null
  }
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

// 主题切换时强制重建：lastData 短路会跳过相同数据的渲染，需先置空；
// notMerge: true 的 setOption 会整体替换旧配色，无残留
watch(isDark, () => {
  if (props.chartData.length > 0 && !isUnmounted && !props.loading) {
    lastData = null
    renderChart()
  }
})
</script>
