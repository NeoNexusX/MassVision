import { onBeforeUnmount, type Ref } from 'vue'
import { buildLUT } from '../utils/colormapLut'
import { computeFitTransform } from '../utils/fitTransform'

interface CanvasRendererOptions {
  canvasRef: Ref<HTMLCanvasElement | null>
  containerW: Ref<number>
  containerH: Ref<number>
  matrix: Ref<Float32Array | null>
  matrixCols: Ref<number>
  matrixRows: Ref<number>
  colormap: Ref<string>
  intensityScale: Ref<string>
  gamma: Ref<number>
  displayMin: Ref<number | undefined>
  displayMax: Ref<number | undefined>
  overlayData: Ref<Uint8ClampedArray | null>
  overlayWidth: Ref<number>
  overlayHeight: Ref<number>
}

export function useCanvasRenderer(
  // Arguments
  opts: CanvasRendererOptions,
) {
  // State (module-internal cache, not exposed)
  let cachedData: Float32Array | null = null
  let cachedP1 = 0
  let cachedP95 = 1
  let renderRaf = 0
  let ro: ResizeObserver | null = null
  // Cached offscreen canvas — reused across renders
  let offscreen: HTMLCanvasElement | null = null
  // Cached offscreen canvas for the overlay — same trick, keeps overlay
  // compositing per-pixel (see the overlay note in render())
  let overlayCanvas: HTMLCanvasElement | null = null
  // Cached ImageData buffer for the offscreen canvas — reused while dims match
  let imageData: ImageData | null = null

  function updateCachedData(data: Float32Array) {
    if (cachedData === data) return
    cachedData = data
    // Sort a Float32Array copy with the native typed-array numeric sort —
    // identical ordering to (a, b) => a - b for the finite, non-negative
    // intensity values handled here, without per-comparison JS callbacks.
    const sorted = data.slice().sort()
    cachedP1 = sorted[Math.floor(sorted.length * 0.01)] ?? sorted[0] ?? 0
    cachedP95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1] ?? 1
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

    drawScene(ctx, W, H, false)
  }

  /**
   * Draw the ion image (and overlay) into a context. With transparentBg the
   * dark backdrop is skipped: zero-intensity pixels and the letterbox area
   * stay transparent, for PNG export without a background color.
   */
  function drawScene(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    transparentBg: boolean,
  ) {
    const data = opts.matrix.value
    const cols = opts.matrixCols.value
    const rows = opts.matrixRows.value
    if (!data || !data.length || !cols || !rows) return

    updateCachedData(data)

    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, W, H)
    if (!transparentBg) {
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, W, H)
    }

    const dispMin = opts.displayMin.value ?? cachedP1
    const dispMax = opts.displayMax.value ?? cachedP95
    const range = dispMax - dispMin || 1

    const lut = buildLUT(opts.colormap.value)
    const useLog = opts.intensityScale.value === 'log'

    const gamma = opts.gamma.value

    // Fit image into container with shared geometry (padding, scale, origin)
    const { scaleVal, drawW, drawH, ox, oy } = computeFitTransform(W, H, cols, rows)

    // Render to 1:1 offscreen canvas — no anti-alias gaps, no cell expansion.
    if (!offscreen || offscreen.width !== cols || offscreen.height !== rows) {
      offscreen = document.createElement('canvas')
      offscreen.width = cols
      offscreen.height = rows
      imageData = null
    }
    const offCtx = offscreen.getContext('2d')!
    // Reuse the ImageData buffer while dimensions are unchanged; every pixel
    // is rewritten below (background pre-fill + value pass) before putImageData.
    if (!imageData) imageData = offCtx.createImageData(cols, rows)
    const buf = imageData.data

    // Pre-fill with background (or leave transparent when exporting)
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = 0x0a
      buf[i + 1] = 0x0a
      buf[i + 2] = 0x0f
      buf[i + 3] = transparentBg ? 0 : 255
    }

    for (let r = 0; r < rows; r++) {
      const rowOff = r * cols
      for (let c = 0; c < cols; c++) {
        const srcIdx = rowOff + c
        const rawVal = data[srcIdx] ?? 0
        if (rawVal === 0) continue

        let norm = (rawVal - dispMin) / range
        if (gamma !== 1) norm = Math.pow(Math.max(0, norm), gamma)
        if (useLog) norm = Math.log1p(norm * 9) / Math.log1p(9)
        norm = Math.max(0, Math.min(1, norm))
        const lutIdx = Math.round(norm * 255)
        const [cr, cg, cb] = lut[lutIdx] ?? [0, 0, 0]

        const pi = (r * cols + c) * 4
        buf[pi] = cr
        buf[pi + 1] = cg
        buf[pi + 2] = cb
        buf[pi + 3] = 255
      }
    }
    offCtx.putImageData(imageData, 0, 0)

    // Blit offscreen → main canvas: drawImage handles DPR, centering, scaling.
    ctx.drawImage(offscreen, ox, oy, drawW, drawH)

    // Overlay: paint the RGBA buffer into its own 1:1 canvas, then blit once.
    // The old per-pixel fillRect used ceil(scaleVal)-sized rects at
    // floor(c*scaleVal) origins, so with a fractional scale adjacent rects
    // overlapped and semi-transparent pixels were composited TWICE in the
    // overlap - visible as darker stripes / uneven opacity. putImageData keeps
    // every pixel independent, and the single drawImage composites each
    // overlay pixel over the ion image exactly once.
    const overlay = opts.overlayData.value
    const ow = opts.overlayWidth.value
    const oh = opts.overlayHeight.value
    if (overlay && ow && oh && overlay.length === ow * oh * 4) {
      if (!overlayCanvas || overlayCanvas.width !== ow || overlayCanvas.height !== oh) {
        overlayCanvas = document.createElement('canvas')
        overlayCanvas.width = ow
        overlayCanvas.height = oh
      }
      const oCtx = overlayCanvas.getContext('2d')!
      const oData = oCtx.createImageData(ow, oh)
      oData.data.set(overlay)
      oCtx.putImageData(oData, 0, 0)
      ctx.drawImage(overlayCanvas, ox, oy, Math.floor(ow * scaleVal), Math.floor(oh * scaleVal))
    }
  }

  /**
   * Render the current scene onto a fresh canvas with a transparent
   * background, for PNG export without the dark backdrop. Returns null when
   * there is no data or container size yet.
   */
  function exportTransparentCanvas(): HTMLCanvasElement | null {
    const W = opts.containerW.value
    const H = opts.containerH.value
    if (!W || !H || !opts.matrix.value?.length) return null
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    drawScene(ctx, W, H, true)
    return canvas
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
  onBeforeUnmount(() => {
    ro?.disconnect()
    if (renderRaf) cancelAnimationFrame(renderRaf)
    offscreen = null
    overlayCanvas = null
    imageData = null
    cachedData = null
  })

  return { render, scheduleRender, observeContainer, exportTransparentCanvas }
}
