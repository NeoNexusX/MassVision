<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps<{
  imageWidth: number
  imageHeight: number
  overlayData: Uint8ClampedArray | null
  visible: boolean
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const containerW = ref(0)
const containerH = ref(0)
let ro: ResizeObserver | null = null

function render() {
  const canvas = canvasRef.value
  if (!canvas || !props.overlayData) return
  const W = containerW.value, H = containerH.value
  if (!W || !H) return
  const mw = props.imageWidth, mh = props.imageHeight
  if (!mw || !mh) return

  // Compute layout — same logic as IonImageViewer
  const scale = Math.min(W / mw, H / mh)
  const cellW = Math.max(1, Math.floor(scale))
  const cellH = Math.max(1, Math.floor(scale))
  const drawW = mw * cellW
  const drawH = mh * cellH
  const ox = Math.floor((W - drawW) / 2)
  const oy = Math.floor((H - drawH) / 2)

  const dpr = window.devicePixelRatio || 1
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.imageSmoothingEnabled = false

  // Render overlay to offscreen canvas at image resolution
  const offscreen = new OffscreenCanvas(mw, mh)
  const offCtx = offscreen.getContext('2d')!
  const imgData = new ImageData(props.overlayData, mw, mh)
  offCtx.putImageData(imgData, 0, 0)

  // Draw scaled overlay at same position as ion image
  ctx.drawImage(offscreen, ox, oy, drawW, drawH)
}

// Sync transform with IonImageViewer's canvas
let rafId = 0
function syncTransform() {
  const canvas = canvasRef.value
  if (!canvas || !props.visible) return
  const parent = canvas.parentElement?.parentElement
  if (!parent) return
  const ionCanvas = parent.querySelector('canvas') as HTMLCanvasElement | null
  if (!ionCanvas) return
  const wrapper = canvas.parentElement
  if (!wrapper) return
  wrapper.style.transform = ionCanvas.style.transform
  wrapper.style.transformOrigin = ionCanvas.style.transformOrigin
}

function syncLoop() {
  syncTransform()
  rafId = requestAnimationFrame(syncLoop)
}

watch(() => props.overlayData, () => { nextTick(render) }, { flush: 'post' })
watch(() => props.visible, (v) => { if (v) { nextTick(render); syncTransform() } })

onMounted(() => {
  const el = containerRef.value
  if (el) {
    const rect = el.getBoundingClientRect()
    containerW.value = Math.floor(rect.width)
    containerH.value = Math.floor(rect.height)
    ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerW.value = Math.floor(entry.contentRect.width)
        containerH.value = Math.floor(entry.contentRect.height)
      }
    })
    ro.observe(el)
  }
  if (props.visible) nextTick(render)
  rafId = requestAnimationFrame(syncLoop)
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  ro?.disconnect()
})
</script>

<template>
  <div
    ref="containerRef"
    v-show="visible"
    class="absolute inset-0 pointer-events-none overflow-hidden"
  >
    <canvas
      ref="canvasRef"
      class="absolute inset-0"
      style="image-rendering: pixelated;"
    />
  </div>
</template>
