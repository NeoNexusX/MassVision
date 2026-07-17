import { computed, ref, watch, onBeforeUnmount, type Ref } from 'vue'

const GRADIENT_STOPS: Record<string, string[]> = {
  viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#fee825'],
  inferno: ['#000004', '#280b54', '#65156e', '#9f2a63', '#d44842', '#f57d15', '#fac127', '#fcffa4'],
  plasma: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fdb42f'],
  gray: ['#000000', '#ffffff'],
}

function computeRange(matrix: Float32Array) {
  const nonZero: number[] = []
  for (let i = 0; i < matrix.length; i++) {
    const v = matrix[i]!
    if (v > 0) nonZero.push(v)
  }
  if (!nonZero.length) return { displayMin: 0, displayMax: 1, dataMax: 1, sorted: [] as number[] }
  nonZero.sort((a, b) => a - b)
  const p95 = nonZero[Math.floor(nonZero.length * 0.95)] ?? nonZero[nonZero.length - 1]!
  const dataMax = nonZero[nonZero.length - 1]!
  return { displayMin: 0, displayMax: p95, dataMax, sorted: nonZero }
}

function formatIonValue(value: number): string {
  if (value === 0) return '0'
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'e6'
  if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + 'e3'
  if (Math.abs(value) < 0.01) return value.toExponential(1)
  return value.toFixed(1)
}

export function useDisplayRange(
  ionMatrix: Ref<Float32Array | null>,
  colormap: Ref<string>,
  ionCols: Ref<number>,
  ionRows: Ref<number>,
) {
  // State
  const globalMin = ref(0)
  const globalMax = ref(1)
  const dataMax = ref(1)
  const sortedNonZero = ref<number[]>([])
  const displayMin = ref(0)
  const displayMax = ref(1)
  const stripRef = ref<HTMLElement | null>(null)
  let stripDragDir: 'min' | 'max' | null = null
  let activeDragMove: ((e: MouseEvent) => void) | null = null
  let activeDragUp: (() => void) | null = null

  // Computed
  const stripRange = computed(() => globalMax.value - globalMin.value || 1)

  const gradientCSS = computed(() => {
    const stops = (GRADIENT_STOPS[colormap.value] ?? GRADIENT_STOPS.inferno)!
    const darkest = stops[0]!
    const brightest = stops[stops.length - 1]!
    const range = stripRange.value
    const lo = ((displayMin.value - globalMin.value) / range) * 100
    const hi = ((displayMax.value - globalMin.value) / range) * 100
    const inner = stops
      .map((color, index) => {
        const pct = lo + ((hi - lo) * index) / (stops.length - 1)
        return `${color} ${pct}%`
      })
      .join(', ')
    return `linear-gradient(to top, ${darkest} 0%, ${darkest} ${lo}%, ${inner}, ${brightest} ${hi}%, ${brightest} 100%)`
  })

  const intensityHistogram = computed(() => {
    const bins = 10
    const hist: number[] = new Array(bins).fill(0)
    const matrix = ionMatrix.value
    if (!matrix) return hist
    const range = dataMax.value || 1
    for (let i = 0; i < matrix.length; i++) {
      const value = matrix[i]!
      const index = Math.min(bins - 1, Math.max(0, Math.floor((value / range) * bins)))
      hist[index] = (hist[index] ?? 0) + 1
    }
    return hist
  })

  const imageInfo = computed(() => {
    const matrix = ionMatrix.value
    if (!matrix || !matrix.length) {
      return { pixels: '--', nonZero: '--', totalIon: '--', polarity: '' }
  }
  const cols = ionCols.value
  const rows = ionRows.value
  let nonZero = 0
  let total = 0
  for (let i = 0; i < matrix.length; i++) {
    const value = matrix[i]!
    if (value > 0) nonZero++
    total += value
  }
  return {
    pixels: `${cols} × ${rows}`,
    nonZero: ((nonZero / (rows * cols)) * 100).toFixed(1) + '%',
    totalIon: total.toExponential(2),
    polarity: '',
  }
  })

  // Methods
  const applyRange = (range: ReturnType<typeof computeRange>) => {
    globalMin.value = range.displayMin
    globalMax.value = range.dataMax
    dataMax.value = range.dataMax
    sortedNonZero.value = range.sorted
    displayMin.value = range.displayMin
    displayMax.value = range.displayMax
  }

  const resetRange = () => {
    if (ionMatrix.value) applyRange(computeRange(ionMatrix.value))
  }

  const calcHandleTop = (value: number) => ((globalMax.value - value) / stripRange.value) * 100
  const clampPct = (value: number) => Math.max(0, Math.min(100, value))

  const onStripMouseDown = (event: MouseEvent) => {
    const element = stripRef.value
    if (!element) return
    const rect = element.getBoundingClientRect()
    const topPct = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    const clickedValue = globalMax.value - (topPct / 100) * stripRange.value
    const distMin = Math.abs(displayMin.value - clickedValue)
    const distMax = Math.abs(displayMax.value - clickedValue)
    if (distMin <= distMax) displayMin.value = clickedValue
    else displayMax.value = clickedValue
  }

  const startStripDrag = (which: 'min' | 'max', event: MouseEvent) => {
    const element = stripRef.value
    if (!element) return
    stripDragDir = which
    const rect = element.getBoundingClientRect()
    const height = rect.height
    const onMove = (moveEvent: MouseEvent) => {
      if (!stripDragDir) return
      const topPct = Math.max(0, Math.min(100, ((moveEvent.clientY - rect.top) / height) * 100))
      const value = globalMax.value - (topPct / 100) * stripRange.value
      if (stripDragDir === 'min') {
        displayMin.value = Math.max(globalMin.value, Math.min(value, displayMax.value))
      } else {
        displayMax.value = Math.min(globalMax.value, Math.max(value, displayMin.value))
      }
    }
    const onUp = () => {
      stripDragDir = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      activeDragMove = null
      activeDragUp = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    activeDragMove = onMove
    activeDragUp = onUp
  }

  const getIntensityRange = () => {
    const matrix = ionMatrix.value
    if (!matrix) return '--'
    let minValue = Infinity
    let maxValue = -Infinity
    for (let i = 0; i < matrix.length; i++) {
      const value = matrix[i]!
      if (Number.isFinite(value)) {
        if (value < minValue) minValue = value
        if (value > maxValue) maxValue = value
      }
    }
    return `${formatIonValue(minValue === Infinity ? 0 : minValue)} – ${formatIonValue(
      maxValue === -Infinity ? 0 : maxValue,
    )}`
  }

  // Watchers
  watch(
    ionMatrix,
    (matrix) => {
      if (matrix) applyRange(computeRange(matrix))
    },
    { immediate: true },
  )

  // Remove any pending drag listeners if the component unmounts mid-drag
  onBeforeUnmount(() => {
    if (activeDragMove) document.removeEventListener('mousemove', activeDragMove)
    if (activeDragUp) document.removeEventListener('mouseup', activeDragUp)
  })

  return {
    globalMin,
    globalMax,
    dataMax,
    sortedNonZero,
    displayMin,
    displayMax,
    stripRef,
    gradientCSS,
    intensityHistogram,
    imageInfo,
    getIntensityRange,
    applyRange,
    resetRange,
    calcHandleTop,
    clampPct,
    onStripMouseDown,
    startStripDrag,
    formatVal: formatIonValue,
  }
}
