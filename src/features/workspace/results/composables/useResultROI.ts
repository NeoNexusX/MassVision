import { computed, ref, type Ref } from 'vue'
import ROIOverlay from '@/features/workspace/results/components/visuals/ROIOverlay.vue'
import {
  useROI,
  type DraftROI,
  type ROIType,
} from '@/features/workspace/results/composables/useROI'

export function useResultROI(
  // Arguments
  ionMatrix: Ref<Float32Array | null>,
  ionCols: Ref<number>,
  ionRows: Ref<number>,
) {
  // External composables
  const {
    selectedTool: roiTool,
    confirmedROIs,
    selectTool: roiSelectTool,
    confirmROI: roiConfirmDraft,
    deleteROI: roiDelete,
    clearAllROIs,
  } = useROI(ionCols, ionRows)

  // State
  const roiOverlayRef = ref<InstanceType<typeof ROIOverlay> | null>(null)
  const currentDraft = ref<DraftROI | null>(null)
  const viewingROI = ref(false)

  // Computed
  const draftReady = computed(() => currentDraft.value !== null)

  const displayMatrix = computed(() => {
    const matrix = ionMatrix.value
    const w = ionCols.value
    const h = ionRows.value
    if (!matrix || !viewingROI.value || !confirmedROIs.value.length) return matrix
    const size = w * h
    const filtered = new Float32Array(size)
    for (const roi of confirmedROIs.value) {
      const mask = roi.mask
      if (!mask || !mask.length) continue
      for (let r = 0; r < h; r++) {
        const rowOff = r * w
        for (let c = 0; c < w; c++) {
          if (mask[r]?.[c]) filtered[rowOff + c] = matrix[rowOff + c] ?? 0
        }
      }
    }
    return filtered
  })

  // Methods
  const onDraftUpdated = (draft: DraftROI) => {
    currentDraft.value = draft
  }

  const onDraftCleared = () => {
    currentDraft.value = null
  }

  const roiCancel = () => {
    roiOverlayRef.value?.clearAll()
    currentDraft.value = null
    roiSelectTool(null)
  }

  const roiConfirm = () => {
    if (!ionMatrix.value || !currentDraft.value) return
    roiConfirmDraft(ionMatrix.value, ionCols.value, ionRows.value, currentDraft.value)
    roiOverlayRef.value?.clearAll()
    currentDraft.value = null
    roiSelectTool(null)
    viewingROI.value = true
  }

  const roiClearAll = () => {
    clearAllROIs()
    currentDraft.value = null
    roiOverlayRef.value?.clearAll()
  }

  const roiReset = () => {
    currentDraft.value = null
    roiOverlayRef.value?.clearAll()
    roiSelectTool(null)
    viewingROI.value = false
  }

  return {
    roiOverlayRef,
    roiTool,
    confirmedROIs,
    draftReady,
    viewingROI,
    displayMatrix,
    roiSelectTool: (value: string | null) => roiSelectTool(value as ROIType | null),
    roiConfirm,
    roiCancel,
    roiDelete,
    roiClearAll,
    roiReset,
    onDraftUpdated,
    onDraftCleared,
  }
}
