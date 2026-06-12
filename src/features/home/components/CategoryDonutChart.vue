<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useTheme } from '@/shared/composables/useTheme'
import type { DatasetCategoryItem } from '../api/statsApi'

/**
 * 分类分布环形图（ECharts pie + 内空心 donut）。分类分布、离子源类型分布共用此组件。
 *
 * 纯展示组件：loading / error / empty 由父面板处理，这里只在拿到 items 后渲染。
 * - 标签从弧拉到外部显示分段名（label.position: 'outside' + labelLine）；
 * - hover 某段时 tooltip 显示「名称：具体数量（占比）」。
 *
 * 尺寸全部交给父级：盒子大小由父级用 em 控制（本组件填满父级 h-full/w-full），
 * 环内标签字号 / 引导线长度等无法用 CSS em 触达 canvas，故在此读取父级继承下来的
 * 字号（getComputedStyle 的 fontSize）按 labelScale 推算，视口变化时随 ResizeObserver 重绘。
 */
const props = withDefaults(
  defineProps<{
    items: DatasetCategoryItem[]
    /** 环内标签字号占父级基准字号的比例；引导线/行高等都由它派生 */
    labelScale?: number
  }>(),
  { labelScale: 0.28},
)

const { isDark } = useTheme()

// 分段配色：以项目品牌蓝为主，搭配几种在明暗主题下都清晰的强调色。
const PALETTE = [
  '#4b72e4',
  '#8caaf8',
  '#22c55e',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
  '#a855f7',
  '#ef4444',
  '#0ea5e9',
  '#eab308',
]

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

function render() {
  const el = chartRef.value
  if (!el) return

  if (!chart) chart = echarts.init(el)

  // 标签 / 引导线颜色随主题切换，保证暗色下也清晰
  const labelColor = isDark.value ? '#cbd5e1' : '#475569'
  const lineColor = isDark.value ? '#475569' : '#cbd5e1'
  const borderColor = isDark.value ? '#1d232a' : '#ffffff'

  // 读取父级（流式 clamp）继承下来的基准字号，按比例派生 canvas 内各尺寸
  const base = parseFloat(getComputedStyle(el).fontSize) || 16
  const fontSize = base * props.labelScale
  const lineHeight = fontSize * 1.35
  // 标签钉到容器边（alignTo:'edge'）：引导线第一段短、第二段由 ECharts 自动补到边缘，
  // 环越大线越长、文字始终贴边，离环最远。minMargin 控制上下相邻标签的最小间距，防竖向重叠。
  const lineLen = base * 0.1
  const lineLen2 = base * 0.12
  const labelMinMargin = base * 0.08

  chart.setOption(
    {
      color: PALETTE,
      tooltip: {
        trigger: 'item',
        // {b}=分段名 {c}=数量 {d}=占比
        formatter: '{b}<br/><strong>{c}</strong> datasets ({d}%)',
        textStyle: { fontSize },
      },
      series: [
        {
          type: 'pie',
          radius: ['30%', '60%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor, borderWidth: 2, borderRadius: 4 },
          label: {
            show: true,
            position: 'outside',
            alignTo: 'edge', // 文字对齐到容器边，离大环最远
            edgeDistance: '4%', // 离容器边留 4%
            minMargin: labelMinMargin, // 相邻标签最小竖向间距，防重叠
            formatter: '{b}\n{c}',
            color: labelColor,
            fontSize,
            lineHeight,
          },
          labelLine: {
            show: true,
            length: lineLen,
            length2: lineLen2,
            lineStyle: { color: lineColor },
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
            label: { fontWeight: 'bold' },
          },
          data: props.items.map((i) => ({ name: i.category, value: i.count })),
        },
      ],
    },
    { notMerge: true },
  )
}

onMounted(async () => {
  await nextTick()
  render()
  if (chartRef.value) {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  chart?.dispose()
  chart = null
})

// items 变化（重新拉到数据）或主题切换时重绘
watch(() => props.items, render, { deep: true })
watch(isDark, render)
</script>

<template>
  <div ref="chartRef" class="h-64 w-full"></div>
</template>
