import { ref, type Ref } from 'vue'

export type ROIType = 'rectangle' | 'freehand'

export interface ROIPoint {
  x: number
  y: number
}

interface ROIStats {
  pixelCount: number
  mean: number
  std: number
  min: number
  max: number
  sum: number
}

export interface ConfirmedROI {
  id: string
  type: ROIType
  label: string
  color: string
  mask: boolean[][]
  stats: ROIStats | null
  spectrum: { mz: number; intensity: number }[] | null
}

export interface DraftROI {
  type: ROIType
  rect: { x0: number; y0: number; x1: number; y1: number } | null
  path: ROIPoint[]
}

export function useROI(
  // Arguments
  imageWidth: Ref<number>,
  imageHeight: Ref<number>,
) {
  // State
  const selectedTool = ref<ROIType | null>(null)
  const draft = ref<DraftROI | null>(null)
  const confirmedROIs = ref<ConfirmedROI[]>([])

  let nextId = 1
  let nextColorIdx = 0
  const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

  // Methods
  function selectTool(type: ROIType | null) {
    selectedTool.value = type
    draft.value = type ? { type, rect: null, path: [] } : null
  }

  function clearDraft() {
    draft.value = null
    selectedTool.value = null
  }

  function generateMask(draftROI: DraftROI, w: number, h: number): boolean[][] {
    const mask: boolean[][] = []
    for (let r = 0; r < h; r++) {
      mask.push(new Array(w).fill(false))
    }

    if (draftROI.type === 'rectangle' && draftROI.rect) {
      const { x0, y0, x1, y1 } = draftROI.rect
      const minX = Math.max(0, Math.min(x0, x1))
      const maxX = Math.min(w - 1, Math.max(x0, x1))
      const minY = Math.max(0, Math.min(y0, y1))
      const maxY = Math.min(h - 1, Math.max(y0, y1))
      for (let r = minY; r <= maxY; r++) {
        for (let c = minX; c <= maxX; c++) {
          mask[r]![c] = true
        }
      }
    }

    if (draftROI.type === 'freehand' && draftROI.path.length > 2) {
      const path = draftROI.path
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.beginPath()
        ctx.moveTo(path[0]!.x, path[0]!.y)
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i]!.x, path[i]!.y)
        }
        ctx.closePath()
        ctx.fill('evenodd')
        const imgData = ctx.getImageData(0, 0, w, h)
        for (let r = 0; r < h; r++) {
          for (let c = 0; c < w; c++) {
            if (imgData.data[(r * w + c) * 4 + 3]! > 0) {
              mask[r]![c] = true
            }
          }
        }
      }
    }

    return mask
  }

  function computeStats(matrix: number[][], mask: boolean[][]): ROIStats | null {
    const h = matrix.length
    const w = matrix[0]?.length ?? 0
    let sum = 0,
      count = 0,
      min = Infinity,
      max = -Infinity
    for (let r = 0; r < h; r++) {
      const row = matrix[r]!
      const maskRow = mask[r]!
      for (let c = 0; c < w; c++) {
        if (!maskRow[c]) continue
        const v = row[c] ?? 0
        if (!Number.isFinite(v)) continue
        sum += v
        count++
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    if (count === 0) return null
    const mean = sum / count
    let sumSq = 0
    for (let r = 0; r < h; r++) {
      const row = matrix[r]!
      const maskRow = mask[r]!
      for (let c = 0; c < w; c++) {
        if (!maskRow[c]) continue
        const v = row[c] ?? 0
        if (!Number.isFinite(v)) continue
        sumSq += (v - mean) ** 2
      }
    }
    return {
      pixelCount: count,
      mean,
      std: Math.sqrt(sumSq / count),
      min,
      max,
      sum,
    }
  }

  function confirmROI(matrix: number[][], draftROI: DraftROI, label?: string): ConfirmedROI | null {
    const w = matrix[0]?.length ?? 0
    const h = matrix.length
    if (!w || !h) return null
    const mask = generateMask(draftROI, w, h)
    const pixelCount = mask.flat().filter(Boolean).length
    if (pixelCount === 0) return null

    const stats = computeStats(matrix, mask)
    const roi: ConfirmedROI = {
      id: `roi-${nextId++}`,
      type: draftROI.type,
      label: label ?? `ROI ${nextId - 1}`,
      color: colors[nextColorIdx % colors.length]!,
      mask,
      stats,
      spectrum: null,
    }
    nextColorIdx++
    confirmedROIs.value.push(roi)
    clearDraft()
    return roi
  }

  function deleteROI(id: string) {
    confirmedROIs.value = confirmedROIs.value.filter((r) => r.id !== id)
  }

  function clearAllROIs() {
    confirmedROIs.value = []
    clearDraft()
  }

  return {
    selectedTool,
    confirmedROIs,
    selectTool,
    clearDraft,
    confirmROI,
    deleteROI,
    clearAllROIs,
    generateMask,
    computeStats,
  }
}
