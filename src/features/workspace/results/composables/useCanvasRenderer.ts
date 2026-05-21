import { onBeforeUnmount, type Ref } from 'vue'
import { buildLUT } from '../utils/colormapLut'

interface CanvasRendererOptions {
  canvasRef: Ref<HTMLCanvasElement | null>
  containerW: Ref<number>
  containerH: Ref<number>
  matrix: Ref<number[][] | null>
  colormap: Ref<string>
  intensityScale: Ref<string>
  displayMin: Ref<number | undefined>
  displayMax: Ref<number | undefined>
  zoom: Ref<number>
  panX: Ref<number>
  panY: Ref<number>
  overlayData: Ref<Uint8ClampedArray | null>
  overlayWidth: Ref<number>
  overlayHeight: Ref<number>
}

export function useCanvasRenderer(
  // Arguments
  opts: CanvasRendererOptions,
) {
  // State (module-internal cache, not exposed)
  let cachedData: number[][] | null = null
  let cachedP1 = 0
  let cachedP99 = 1
  let mockData: number[][] = []
  let renderRaf = 0
  let ro: ResizeObserver | null = null

  // Methods
  function setMockData(data: number[][]) {
    mockData = data
  }

  function updateCachedData(data: number[][]) {
    if (cachedData === data) return
    cachedData = data
    const allVals: number[] = []
    for (const row of data) for (const v of row) allVals.push(v)
    allVals.sort((a, b) => a - b)
    cachedP1 = allVals[Math.floor(allVals.length * 0.01)] ?? allVals[0] ?? 0
    cachedP99 = allVals[Math.floor(allVals.length * 0.99)] ?? allVals[allVals.length - 1] ?? 1
  }

  function render() {
    const canvas = opts.canvasRef.value
    if (!canvas) return

    const W = opts.containerW.value
    const H = opts.containerH.value
    if (!W || !H) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const data = opts.matrix.value ?? mockData
    if (!data.length || !data[0]?.length) return

    updateCachedData(data)

    const rows = data.length
    const cols = data[0]!.length

    ctx.imageSmoothingEnabled = false

    const dispMin = opts.displayMin.value ?? cachedP1
    const dispMax = opts.displayMax.value ?? cachedP99
    const range = dispMax - dispMin || 1

    const matrixW = cols,
      matrixH = rows
    const scale = Math.min(W / matrixW, H / matrixH)
    const cellW = Math.max(1, Math.floor(scale))
    const cellH = Math.max(1, Math.floor(scale))
    const drawW = matrixW * cellW
    const drawH = matrixH * cellH
    const ox = Math.floor((W - drawW) / 2)
    const oy = Math.floor((H - drawH) / 2)
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0a0a0f'
    ctx.fillRect(0, 0, W, H)

    const lut = buildLUT(opts.colormap.value)
    const useLog = opts.intensityScale.value === 'log'

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rawVal = data[r]![c] ?? 0
        if (rawVal === 0) continue

        const val = data[r]![c] ?? dispMin
        let norm = (val - dispMin) / range
        norm = Math.pow(Math.max(0, norm), 0.45)
        if (useLog) norm = Math.log1p(norm * 9) / Math.log1p(9)
        norm = Math.max(0, Math.min(1, norm))
        const idx = Math.round(norm * 255)
        const [cr, cg, cb] = lut[idx] ?? [0, 0, 0]
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`
        ctx.fillRect(
          ox + Math.floor(c * cellW),
          oy + Math.floor(r * cellH),
          Math.ceil(cellW),
          Math.ceil(cellH),
        )
      }
    }

    const overlay = opts.overlayData.value
    const ow = opts.overlayWidth.value
    const oh = opts.overlayHeight.value
    if (overlay && ow && oh) {
      for (let r = 0; r < oh; r++) {
        for (let c = 0; c < ow; c++) {
          const off = (r * ow + c) * 4
          const a = overlay[off + 3]!
          if (a === 0) continue
          ctx.fillStyle = `rgba(${overlay[off]!},${overlay[off + 1]!},${overlay[off + 2]!},${(a / 255).toFixed(2)})`
          ctx.fillRect(
            ox + Math.floor(c * cellW),
            oy + Math.floor(r * cellH),
            Math.ceil(cellW),
            Math.ceil(cellH),
          )
        }
      }
    }
  }

  function scheduleRender() {
    if (renderRaf) return
    renderRaf = requestAnimationFrame(() => {
      renderRaf = 0
      render()
    })
  }

  function observeContainer(containerRef: HTMLElement) {
    const rect = containerRef.getBoundingClientRect()
    opts.containerW.value = Math.floor(rect.width)
    opts.containerH.value = Math.floor(rect.height)
    ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        opts.containerW.value = Math.floor(entry.contentRect.width)
        opts.containerH.value = Math.floor(entry.contentRect.height)
        scheduleRender()
      }
    })
    ro.observe(containerRef)
  }

  // Lifecycle
  onBeforeUnmount(() => ro?.disconnect())

  return { render, scheduleRender, observeContainer, setMockData }
}
