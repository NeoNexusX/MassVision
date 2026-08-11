/**
 * AverageSpectrum 图表的主题感知配色。
 *
 * ECharts 不读 CSS 变量，配色必须在构建 options 时显式传入。这里把每个
 * 语义色槽的 light / dark 两份色值集中收口：组件只依赖 SpectrumPalette
 * 接口，具体取哪套色由 resolveSpectrumPalette(mode) 决定。
 */

/** 图表语义色槽定义（与模式无关的结构） */
export interface SpectrumPalette {
  axis: {
    /** 坐标轴名称文字（m/z、Intensity） */
    nameText: string
    /** 轴线与刻度 */
    line: string
    /** 坐标轴刻度标签（数字） */
    label: string
    /** 网格虚线 */
    splitLine: string
  }
  /** profile 模式主谱线 */
  series: {
    line: string
    area: string
  }
  /** centroid 模式柱条 */
  bar: string
  /** m/z 选择竖线及其标签 */
  selector: string
  dataZoom: {
    border: string
    filler: string
    handle: string
  }
}

export type SpectrumThemeMode = 'light' | 'dark'

const light: SpectrumPalette = {
  axis: {
    nameText: '#6b7280', // gray-500
    line: '#9ca3af', // gray-400
    label: '#4b5563', // gray-600
    splitLine: '#e5e7eb', // gray-200
  },
  series: {
    line: '#374151', // gray-700
    area: 'rgba(55, 65, 81, 0.06)',
  },
  bar: '#6b7280',
  selector: '#ef4444', // red-500，深浅底均可读，不变
  dataZoom: {
    border: '#d1d5db', // gray-300
    filler: 'rgba(59, 130, 246, 0.12)',
    handle: '#4d99f7', // blue-500
  },
}

const dark: SpectrumPalette = {
  axis: {
    nameText: '#f6f5f4', // gray-400
    line: '#f6f5f4', // gray-500
    label: '#d1d5db', // gray-300
    splitLine: '#374151', // gray-700
  },
  series: {
    line: '#eef1f6', // gray-300
    area: 'rgba(13, 87, 234, 0.08)',
  },
  bar: '#9ca3af',
  selector: '#ef4444',
  dataZoom: {
    border: '#f6f5f4', // gray-600
    filler: 'rgba(8, 95, 235, 0.18)',
    handle: '#4d99f7', // blue-400
  },
}

/** 按当前主题模式取整套图表配色 */
export function resolveSpectrumPalette(mode: SpectrumThemeMode): SpectrumPalette {
  return mode === 'dark' ? dark : light
}
