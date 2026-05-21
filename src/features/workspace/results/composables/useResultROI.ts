import { computed, ref, type Ref } from 'vue'
import ROIOverlay from '@/features/workspace/results/components/visuals/ROIOverlay.vue'
import {
  useROI,
  type DraftROI,
  type ROIType,
} from '@/features/workspace/results/composables/useROI'

export function useResultROI(
  ionMatrix: Ref<number[][] | null>,
  ionCols: Ref<number>,
  ionRows: Ref<number>,
) {
  const roiOverlayRef = ref<InstanceType<typeof ROIOverlay> | null>(null)
  const currentDraft = ref<DraftROI | null>(null)
  const draftReady = computed(() => currentDraft.value !== null)
  const viewingROI = ref(false)

  const {
    selectedTool: roiTool,
    confirmedROIs,
    selectTool: roiSelectTool,
    confirmROI: roiConfirmDraft,
    deleteROI: roiDelete,
    clearAllROIs,
  } = useROI(ionCols, ionRows)

  const displayMatrix = computed(() => {
    const matrix = ionMatrix.value
    if (!matrix || !viewingROI.value || !confirmedROIs.value.length) return matrix
    const height = matrix.length
    const width = matrix[0]?.length ?? 0
    const combined: boolean[][] = []
    for (let rowIndex = 0; rowIndex < height; rowIndex++) {
      combined.push(new Array(width).fill(false))
    }
    for (const roi of confirmedROIs.value) {
      const mask = roi.mask
      if (!mask || !mask.length) continue
      for (let rowIndex = 0; rowIndex < height; rowIndex++) {
        for (let colIndex = 0; colIndex < width; colIndex++) {
          if (mask[rowIndex]?.[colIndex]) combined[rowIndex]![colIndex] = true
        }
      }
    }

    const filtered: number[][] = []
    for (let rowIndex = 0; rowIndex < height; rowIndex++) {
      const row = new Array<number>(width)
      for (let colIndex = 0; colIndex < width; colIndex++) {
        row[colIndex] = combined[rowIndex]![colIndex] ? (matrix[rowIndex]?.[colIndex] ?? 0) : 0
      }
      filtered.push(row)
    }
    return filtered
  })

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
    roiConfirmDraft(ionMatrix.value, currentDraft.value)
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
