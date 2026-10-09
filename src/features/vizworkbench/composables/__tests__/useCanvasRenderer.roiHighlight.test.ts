import { describe, expect, it, beforeEach } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useCanvasRenderer } from '../useCanvasRenderer'

/**
 * jsdom has no 2D canvas context, so this stubs `getContext('2d')` with a
 * recording object — same approach as useCanvasRenderer.channels.test.ts. The
 * ROI highlight is a SECOND overlay layer, so what matters here is that it is
 * blitted independently of (and after) the main overlay and that the view mask
 * clips it the same way.
 */
let puts: ImageData[]

function installCanvasStub() {
  puts = []
  const contexts = new WeakMap<HTMLCanvasElement, unknown>()
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
    if (type !== '2d') return null
    let ctx = contexts.get(this)
    if (!ctx) {
      ctx = {
        canvas: this,
        imageSmoothingEnabled: true,
        fillStyle: '',
        setTransform() {},
        clearRect() {},
        fillRect() {},
        drawImage() {},
        createImageData(w: number, h: number) {
          return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
        },
        putImageData(img: ImageData) {
          puts.push(img)
        },
      }
      contexts.set(this, ctx)
    }
    return ctx
  } as unknown as HTMLCanvasElement['getContext']
}

interface Harness {
  render: () => void
  exportTransparentCanvas: () => HTMLCanvasElement | null
  overlayData: Ref<Uint8ClampedArray | null>
  roiHighlightData: Ref<Uint8ClampedArray | null>
  roiMask: Ref<Uint8Array | null>
  cols: Ref<number>
  rows: Ref<number>
}

function makeRenderer(cols = 2, rows = 2): Harness {
  const canvasRef = ref<HTMLCanvasElement | null>(document.createElement('canvas'))
  const containerW = ref(200)
  const containerH = ref(100)
  const matrix = ref<Float32Array | null>(new Float32Array(cols * rows).fill(1))
  const colsRef = ref(cols)
  const rowsRef = ref(rows)
  const overlayData = ref<Uint8ClampedArray | null>(null)
  const roiHighlightData = ref<Uint8ClampedArray | null>(null)
  const roiMask = ref<Uint8Array | null>(null)
  const staticRef = <T>(v: T) => ref(v)

  let api: ReturnType<typeof useCanvasRenderer> | null = null
  const Harness = defineComponent({
    setup() {
      api = useCanvasRenderer({
        canvasRef,
        containerW,
        containerH,
        matrix,
        matrixCols: colsRef,
        matrixRows: rowsRef,
        colormap: staticRef('inferno'),
        intensityScale: staticRef('linear'),
        gamma: staticRef(1),
        displayMin: staticRef<number | undefined>(undefined),
        displayMax: staticRef<number | undefined>(undefined),
        overlayData,
        overlayWidth: colsRef,
        overlayHeight: rowsRef,
        roiMask,
        roiHighlightData,
      })
      return () => h('div')
    },
  })
  mount(Harness)
  return {
    render: () => api!.render(),
    exportTransparentCanvas: () => api!.exportTransparentCanvas(),
    overlayData,
    roiHighlightData,
    roiMask,
    cols: colsRef,
    rows: rowsRef,
  }
}

/** Uniform RGBA buffer of `n` pixels. */
function solid(n: number, r: number, g: number, b: number, a: number) {
  const buf = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    buf[i * 4] = r
    buf[i * 4 + 1] = g
    buf[i * 4 + 2] = b
    buf[i * 4 + 3] = a
  }
  return buf
}

function px(img: ImageData, i: number) {
  return [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2], img.data[i * 4 + 3]]
}

/** Every blitted layer at the given grid size, in draw order. */
function layers(w: number, h: number) {
  return puts.filter((p) => p.width === w && p.height === h)
}

/** The last layer blitted at the given grid size (topmost). */
function topLayer(w: number, h: number) {
  const g = layers(w, h)
  return g[g.length - 1]!
}

describe('useCanvasRenderer ROI highlight layer', () => {
  beforeEach(() => installCanvasStub())

  it('blits the ROI layer after the main overlay, independently', () => {
    const r = makeRenderer()
    r.overlayData.value = solid(4, 0, 0, 255, 255) // main overlay: blue
    r.roiHighlightData.value = solid(4, 255, 0, 0, 100) // ROI layer: red

    r.render()

    // offscreen ion image, then main overlay, then ROI layer
    const g = layers(2, 2)
    expect(g).toHaveLength(3)
    expect(px(g[1]!, 0)).toEqual([0, 0, 255, 255])
    expect(px(g[2]!, 0)).toEqual([255, 0, 0, 100])
  })

  it('draws the ROI layer even when no main overlay is active', () => {
    const r = makeRenderer()
    r.roiHighlightData.value = solid(4, 0, 255, 0, 100)

    r.render()

    const g = layers(2, 2)
    expect(g).toHaveLength(2) // offscreen + ROI layer
    expect(px(g[1]!, 0)).toEqual([0, 255, 0, 100])
  })

  it('clips the ROI layer to the view mask', () => {
    const r = makeRenderer()
    r.roiHighlightData.value = solid(4, 255, 0, 0, 100)
    r.roiMask.value = new Uint8Array([1, 0, 0, 0])

    r.render()

    const roi = layers(2, 2)[1]!
    expect(px(roi, 0)).toEqual([255, 0, 0, 100])
    expect(px(roi, 1)![3]).toBe(0)
  })

  it('includes the ROI layer on the transparent export path', () => {
    const r = makeRenderer()
    r.roiHighlightData.value = solid(4, 255, 0, 0, 100)

    const canvas = r.exportTransparentCanvas()
    expect(canvas).not.toBeNull()
    expect(px(topLayer(2, 2), 0)).toEqual([255, 0, 0, 100])
  })

  it('rebuilds the cached layer canvas when the grid size changes', () => {
    const r = makeRenderer()
    r.roiHighlightData.value = solid(4, 255, 0, 0, 100)
    r.render()

    r.cols.value = 3
    r.rows.value = 3
    r.roiHighlightData.value = solid(9, 0, 0, 255, 120)
    r.render()

    // A new 3x3 layer is blitted (no stale 2x2 buffer reused).
    expect(px(topLayer(3, 3), 0)).toEqual([0, 0, 255, 120])
  })
})
