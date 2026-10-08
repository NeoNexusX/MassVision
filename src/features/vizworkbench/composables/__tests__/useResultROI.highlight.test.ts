import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useResultROI } from '../useResultROI'
import type { DraftROI } from '../useROI'

const rect = (x0: number, y0: number, x1: number, y1: number): DraftROI => ({
  type: 'rectangle',
  rect: { x0, y0, x1, y1 },
  path: [],
})

function setup(w = 4, h = 4) {
  const matrix = ref<Float32Array | null>(new Float32Array(w * h).fill(2))
  const roi = useResultROI(matrix, ref(w), ref(h))
  const draw = (d: DraftROI) => {
    roi.roiSelectTool('rectangle')
    roi.onDraftUpdated(d)
    roi.roiConfirm()
  }
  return { roi, matrix, draw }
}

describe('useResultROI highlight vs filtering', () => {
  it('outlines a confirmed ROI without enabling the ROI-only filter', () => {
    const { roi, matrix, draw } = setup()
    expect(roi.roiHighlightOverlay.value).toBeNull()

    draw(rect(0, 0, 3, 3)) // covers the whole 4x4 grid

    // The filter stays off — no blacking out the rest of the image on confirm.
    expect(roi.viewingROI.value).toBe(false)
    expect(roi.roiUnionMask.value).toBeNull()
    expect(roi.displayMatrix.value).toBe(matrix.value)

    // Only the outline is painted; the interior stays transparent so the ion
    // intensities underneath remain visible.
    const hl = roi.roiHighlightOverlay.value!
    const alphaAt = (r: number, c: number) => hl[(r * 4 + c) * 4 + 3]
    expect(alphaAt(0, 0)).toBe(255) // corner
    expect(alphaAt(0, 2)).toBe(255) // top edge
    expect(alphaAt(3, 3)).toBe(255) // opposite corner
    expect(alphaAt(1, 1)).toBe(0) // interior
    expect(alphaAt(2, 2)).toBe(0) // interior
  })

  it('drops the highlight when the ROI is deselected', () => {
    const { roi, draw } = setup()
    draw(rect(0, 0, 1, 1))

    const id = roi.confirmedROIs.value[0]!.id
    roi.toggleRoiSelection(id)

    expect(roi.roiHighlightOverlay.value).toBeNull()
  })
})
