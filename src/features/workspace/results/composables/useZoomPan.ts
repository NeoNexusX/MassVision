import { ref } from 'vue'

export function useZoomPan(containerW: () => number, containerH: () => number) {
  const zoom = ref(2)
  const panX = ref(0)
  const panY = ref(0)

  function resetZoom() {
    zoom.value = 1
    panX.value = 0
    panY.value = 0
  }

  function zoomIn() {
    setZoom(zoom.value * 1.5)
  }

  function zoomOut() {
    setZoom(zoom.value / 1.5)
  }

  function setZoom(newZoom: number) {
    const clamped = Math.max(1, Math.min(40, newZoom))
    if (clamped === zoom.value) return
    const cx = containerW() / 2
    const cy = containerH() / 2
    const scale = clamped / zoom.value
    panX.value = cx - scale * (cx - panX.value)
    panY.value = cy - scale * (cy - panY.value)
    zoom.value = clamped
    if (zoom.value === 1) {
      panX.value = 0
      panY.value = 0
    }
  }

  function onWheel(e: WheelEvent, containerRef: HTMLElement | null) {
    const rect = containerRef?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
    const newZoom = Math.max(1, Math.min(40, zoom.value * factor))
    const scale = newZoom / zoom.value
    panX.value = mx - scale * (mx - panX.value)
    panY.value = my - scale * (my - panY.value)
    zoom.value = newZoom
    if (zoom.value === 1) {
      panX.value = 0
      panY.value = 0
    }
  }

  function onPanStart(e: MouseEvent, containerRef: HTMLElement | null) {
    if (zoom.value <= 1 || e.button !== 0) return
    e.preventDefault()
    const startX = e.clientX - panX.value
    const startY = e.clientY - panY.value
    const onMove = (ev: MouseEvent) => {
      panX.value = ev.clientX - startX
      panY.value = ev.clientY - startY
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return { zoom, panX, panY, resetZoom, zoomIn, zoomOut, setZoom, onWheel, onPanStart }
}
