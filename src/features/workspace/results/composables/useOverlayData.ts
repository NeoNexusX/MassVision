import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import { loadNpy } from '@/features/workspace/results/utils/npyParser'

export type OverlayMode = 'none' | 'umap' | 'kmeans'

const TAB20 = [
  [31, 119, 180],
  [174, 199, 232],
  [255, 127, 14],
  [255, 187, 120],
  [44, 160, 44],
  [152, 223, 138],
  [214, 39, 40],
  [255, 152, 150],
  [148, 103, 189],
  [197, 176, 213],
  [140, 86, 75],
  [196, 156, 148],
  [227, 119, 194],
  [247, 182, 210],
  [127, 127, 127],
  [199, 199, 199],
  [188, 189, 34],
  [219, 219, 141],
  [23, 190, 207],
  [158, 218, 229],
]

function zeroBasedXY(coords: Int32Array): { x: Int32Array; y: Int32Array } {
  const n = coords.length / 2
  const x = new Int32Array(n)
  const y = new Int32Array(n)
  let hasZero = false
  for (let i = 0; i < n; i++) {
    if (coords[i * 2] === 0 || coords[i * 2 + 1] === 0) {
      hasZero = true
      break
    }
  }
  for (let i = 0; i < n; i++) {
    x[i] = coords[i * 2]! - (hasZero ? 0 : 1)
    y[i] = coords[i * 2 + 1]! - (hasZero ? 0 : 1)
  }
  return { x, y }
}

function toInt32Array(data: unknown) {
  if (data instanceof BigInt64Array) {
    const arr = new Int32Array(data.length)
    for (let i = 0; i < arr.length; i++) arr[i] = Number(data[i])
    return arr
  }
  return data as Int32Array
}

export function useOverlayData(
  // Arguments
  ionRows: Ref<number>,
  ionCols: Ref<number>,
) {
  // State
  const overlayMode = ref<OverlayMode>('none')
  const overlayData = ref<Uint8ClampedArray | null>(null)
  const overlayLoading = ref(false)
  const overlayAlpha = ref(77)

  let coordsCache: Int32Array | null = null
  let umapEmbeddingsCache: Float32Array | null = null
  let kmeansLabelsCache: Int32Array | null = null

  // Methods
  const ensureOverlayData = async () => {
    if (coordsCache) return
    overlayLoading.value = true
    try {
      const [coordsNpy, umapNpy, kmeansNpy] = await Promise.all([
        loadNpy('/umap_kmeans/coordinates.npy'),
        loadNpy('/umap_kmeans/umap_result/umap_embeddings.npy'),
        loadNpy('/umap_kmeans/5_kmeans_result/kmeans_labels_k5.npy'),
      ])
      coordsCache = toInt32Array(coordsNpy.data)
      umapEmbeddingsCache = umapNpy.data as Float32Array
      kmeansLabelsCache = toInt32Array(kmeansNpy.data)
    } catch (error) {
      console.error('Failed to load overlay data:', error)
    } finally {
      overlayLoading.value = false
    }
  }

  const computeUmapOverlay = () => {
    if (!coordsCache || !umapEmbeddingsCache) return null
    const height = ionRows.value
    const width = ionCols.value
    if (!height || !width) return null
    const count = coordsCache.length / 2
    const { x, y } = zeroBasedXY(coordsCache)

    let embeddingMin = Infinity
    let embeddingMax = -Infinity
    for (let i = 0; i < umapEmbeddingsCache.length; i++) {
      const value = umapEmbeddingsCache[i]!
      if (value < embeddingMin) embeddingMin = value
      if (value > embeddingMax) embeddingMax = value
    }
    const embeddingRange = embeddingMax - embeddingMin || 1

    const rgba = new Uint8ClampedArray(height * width * 4)
    for (let i = 0; i < count; i++) {
      const px = x[i]!
      const py = y[i]!
      if (px < 0 || px >= width || py < 0 || py >= height) continue
      const offset = (py * width + px) * 4
      rgba[offset] = ((umapEmbeddingsCache[i * 3]! - embeddingMin) / embeddingRange) * 255
      rgba[offset + 1] = ((umapEmbeddingsCache[i * 3 + 1]! - embeddingMin) / embeddingRange) * 255
      rgba[offset + 2] = ((umapEmbeddingsCache[i * 3 + 2]! - embeddingMin) / embeddingRange) * 255
      rgba[offset + 3] = overlayAlpha.value
    }
    return rgba
  }

  const computeKmeansOverlay = () => {
    if (!coordsCache || !kmeansLabelsCache) return null
    const height = ionRows.value
    const width = ionCols.value
    if (!height || !width) return null
    const count = coordsCache.length / 2
    const { x, y } = zeroBasedXY(coordsCache)
    const rgba = new Uint8ClampedArray(height * width * 4)

    let labelMin = Infinity
    let labelMax = -Infinity
    for (let i = 0; i < count; i++) {
      const label = kmeansLabelsCache[i]!
      if (label < labelMin) labelMin = label
      if (label > labelMax) labelMax = label
    }
    const labelRange = labelMax - labelMin || 1

    for (let i = 0; i < count; i++) {
      const px = x[i]!
      const py = y[i]!
      if (px < 0 || px >= width || py < 0 || py >= height) continue
      const label = kmeansLabelsCache[i]!
      const norm = (label - labelMin) / labelRange
      const color = TAB20[Math.min(TAB20.length - 1, Math.round(norm * (TAB20.length - 1)))]!
      const offset = (py * width + px) * 4
      rgba[offset] = color[0]!
      rgba[offset + 1] = color[1]!
      rgba[offset + 2] = color[2]!
      rgba[offset + 3] = overlayAlpha.value
    }
    return rgba
  }

  const recomputeOverlay = () => {
    if (overlayMode.value === 'umap') overlayData.value = computeUmapOverlay()
    else if (overlayMode.value === 'kmeans') overlayData.value = computeKmeansOverlay()
  }

  const toggleOverlay = async (mode: OverlayMode) => {
    if (overlayMode.value === mode) {
      overlayMode.value = 'none'
      overlayData.value = null
      return
    }
    overlayMode.value = mode
    await ensureOverlayData()
    recomputeOverlay()
  }

  // Watchers
  watch(overlayAlpha, () => {
    if (overlayMode.value !== 'none' && coordsCache) recomputeOverlay()
  })

  // Release cached .npy TypedArrays on unmount so they don't persist in the
  // closure after the component is destroyed
  onBeforeUnmount(() => {
    coordsCache = null
    umapEmbeddingsCache = null
    kmeansLabelsCache = null
    overlayData.value = null
  })

  return {
    overlayMode,
    overlayData,
    overlayLoading,
    overlayAlpha,
    toggleOverlay,
    recomputeOverlay,
  }
}
