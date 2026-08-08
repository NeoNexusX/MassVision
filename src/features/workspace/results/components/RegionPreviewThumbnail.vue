<script setup lang="ts">
/**
 * Region preview thumbnail.
 *
 * Sits under the Compare Regions panel and shows the compared regions (A/B)
 * on a dimmed TIC backdrop, each in its own identity color (kmeans palette
 * color for clusters, palette-assigned color for ROIs). Confirmed ROIs are
 * also rendered as colored fills + outlines, so the thumbnail doubles as the
 * "where are my ROIs" overview (the main ion image intentionally doesn't draw
 * confirmed ROI frames).
 *
 * Rendering: masks are H×W grids (row*width+col), drawn into a 1:1 ImageData
 * and upscaled with drawImage - same pattern as the main canvas renderer, so
 * colors and geometry match the ion image exactly.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { ConfirmedROI } from '@/features/workspace/results/composables/useROI'
import { hexToRgb, rgbCss, type RGB } from '@/features/workspace/results/utils/regionPalette'

export interface ThumbnailRegion {
  value: string
  label: string
  color: RGB
  /** H×W 0/1 raster, row*width+col. */
  mask: Uint8Array
}

const props = defineProps<{
  a: ThumbnailRegion | null
  b: ThumbnailRegion | null
  rois: ConfirmedROI[]
  matrix: Float32Array | null
  width: number
  height: number
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const hasAnything = computed(
  () => !!(props.a || props.b || props.rois.length) && props.width > 0 && props.height > 0,
)

const legendA = computed(() =>
  props.a ? { label: `A · ${props.a.label}`, css: rgbCss(props.a.color) } : null,
)
const legendB = computed(() =>
  props.b ? { label: `B · ${props.b.label}`, css: rgbCss(props.b.color) } : null,
)

// ---------- raster building ----------

const BG = { r: 0x0a, g: 0x0a, b: 0x0f } // same backdrop as the main canvas

function buildImageData(): ImageData | null {
  const { width: w, height: h } = props
  if (!w || !h) return null
  const img = new ImageData(w, h)
  const buf = img.data
  const n = w * h

  // Backdrop: dimmed grayscale of the TIC/ion matrix so the regions sit in
  // spatial context without competing with their identity colors.
  const matrix = props.matrix
  let max = 0
  if (matrix) {
    for (let i = 0; i < n; i++) {
      const v = matrix[i] ?? 0
      if (v > max) max = v
    }
  }
  const hasMatrix = !!(matrix && max > 0 && matrix.length >= n)
  for (let i = 0; i < n; i++) {
    const off = i * 4
    if (hasMatrix) {
      const v = (matrix![i] ?? 0) / max
      const gray = Math.round(Math.sqrt(v) * 88) // sqrt boosts dim tissue
      buf[off] = 14 + gray
      buf[off + 1] = 14 + gray
      buf[off + 2] = 20 + gray
    } else {
      buf[off] = BG.r
      buf[off + 1] = BG.g
      buf[off + 2] = BG.b
    }
    buf[off + 3] = 255
  }

  // Confirmed ROIs: colored fill (subtle) + outline (full color). Drawn under
  // the A/B highlight so the compared regions stay on top.
  for (const roi of props.rois) {
    const c = hexToRgb(roi.color)
    if (!c) continue
    paintMask(buf, roi.mask, w, h, c, 0.22, true)
  }

  // Compared regions: strong fill, their own identity color. B after A so
  // overlap (if any) reads as B - same precedence as the ion-image overlay.
  if (props.a) paintMask(buf, props.a.mask, w, h, props.a.color, 0.85, false)
  if (props.b) paintMask(buf, props.b.mask, w, h, props.b.color, 0.85, false)

  return img
}

/**
 * Alpha-blend a region over the backdrop. `mask` may be a flat Uint8Array
 * (kmeans/comparison raster) or a boolean[][] (ROI). With `outline`, mask
 * edge pixels additionally get the full-strength color.
 */
function paintMask(
  buf: Uint8ClampedArray,
  mask: Uint8Array | boolean[][],
  w: number,
  h: number,
  c: RGB,
  alpha: number,
  outline: boolean,
) {
  const at = (r: number, col: number): boolean =>
    Array.isArray(mask) ? !!mask[r]?.[col] : !!mask[r * w + col]

  for (let r = 0; r < h; r++) {
    for (let col = 0; col < w; col++) {
      if (!at(r, col)) continue
      let a = alpha
      if (outline) {
        const edge =
          r === 0 ||
          col === 0 ||
          r === h - 1 ||
          col === w - 1 ||
          !at(r - 1, col) ||
          !at(r + 1, col) ||
          !at(r, col - 1) ||
          !at(r, col + 1)
        if (edge) a = 1
      }
      const off = (r * w + col) * 4
      buf[off] = Math.round(buf[off]! * (1 - a) + c.r * a)
      buf[off + 1] = Math.round(buf[off + 1]! * (1 - a) + c.g * a)
      buf[off + 2] = Math.round(buf[off + 2]! * (1 - a) + c.b * a)
    }
  }
}

// ---------- canvas ----------

function draw() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const cw = container.clientWidth
  if (!cw) return
  const aspect = props.height / props.width
  const ch = Math.max(1, Math.round(cw * aspect))

  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(cw * dpr)
  canvas.height = Math.round(ch * dpr)
  canvas.style.height = ch + 'px'

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = `rgb(${BG.r},${BG.g},${BG.b})`
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const img = buildImageData()
  if (!img) return

  // 1:1 offscreen → upscaled blit (pixelated), matching the main renderer.
  const off = document.createElement('canvas')
  off.width = img.width
  off.height = img.height
  off.getContext('2d')!.putImageData(img, 0, 0)
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height)
}

let ro: ResizeObserver | null = null
onMounted(() => {
  if (containerRef.value) {
    ro = new ResizeObserver(() => draw())
    ro.observe(containerRef.value)
  }
  draw()
})
onBeforeUnmount(() => ro?.disconnect())

watch(
  () => [props.a, props.b, props.rois, props.matrix, props.width, props.height],
  () => draw(),
)
</script>

<template>
  <div class="border-0 rounded-none bg-transparent overflow-visible">
    <div class="px-3 pt-2 pb-1.5 flex items-center justify-between">
      <span class="text-sm font-semibold text-base-content">Region preview</span>
      <span v-if="!hasAnything" class="text-xs text-base-content/40">
        Select regions or draw ROIs
      </span>
    </div>
    <div ref="containerRef" class="px-3 pb-2">
      <canvas
        ref="canvasRef"
        class="block w-full max-w-full rounded-md border border-base-300"
        style="image-rendering: pixelated"
      />
    </div>
    <div v-if="legendA || legendB" class="px-3 pb-2.5 flex flex-wrap gap-x-4 gap-y-1">
      <span v-if="legendA" class="flex items-center gap-1.5 text-xs text-base-content/80">
        <span
          class="w-2.5 h-2.5 rounded-sm border border-base-content/30 shrink-0"
          :style="{ backgroundColor: legendA.css }"
        ></span>
        <span class="truncate max-w-[180px]" :title="legendA.label">{{ legendA.label }}</span>
      </span>
      <span v-if="legendB" class="flex items-center gap-1.5 text-xs text-base-content/80">
        <span
          class="w-2.5 h-2.5 rounded-sm border border-base-content/30 shrink-0"
          :style="{ backgroundColor: legendB.css }"
        ></span>
        <span class="truncate max-w-[180px]" :title="legendB.label">{{ legendB.label }}</span>
      </span>
    </div>
  </div>
</template>
