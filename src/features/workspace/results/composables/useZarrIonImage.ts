import { computed, onMounted, ref } from 'vue'
import { FetchStore, get, open } from 'zarrita'

let zarrIonArray: any = null
let zarrMzData: Float64Array | null = null

async function initZarr() {
  const zarrUrl = new URL('/ion_image_output.zarr', window.location.origin).href
  const store = new FetchStore(zarrUrl)
  const root = await open(store, { kind: 'group' })
  zarrIonArray = await open(root.resolve('ion_images'), { kind: 'array' })
  const mzArr = await open(root.resolve('mz_axis'), { kind: 'array' })
  const chunk = await get(mzArr)
  zarrMzData = chunk.data as Float64Array
}

function findMzRangeIndices(target: number, tolerance: number): number[] {
  if (!zarrMzData) return []
  const indices: number[] = []
  for (let i = 0; i < zarrMzData.length; i++) {
    const mz = zarrMzData[i]!
    if (mz >= target - tolerance && mz <= target + tolerance) indices.push(i)
    else if (mz > target + tolerance) break
  }
  return indices
}

async function loadIonSliceSum(indices: number[]): Promise<number[][]> {
  if (!indices.length) return []
  const first = await get(zarrIonArray, [indices[0]!, null, null])
  const height = first.shape[0]!
  const width = first.shape[1]!
  const sum: number[][] = []
  for (let rowIndex = 0; rowIndex < height; rowIndex++) {
    sum.push(new Array<number>(width).fill(0))
  }

  const addSlice = (flat: Float32Array) => {
    for (let rowIndex = 0; rowIndex < height; rowIndex++) {
      const offset = rowIndex * width
      for (let colIndex = 0; colIndex < width; colIndex++) {
        sum[rowIndex]![colIndex]! += flat[offset + colIndex]!
      }
    }
  }

  addSlice(first.data as Float32Array)
  for (let i = 1; i < indices.length; i++) {
    const result = await get(zarrIonArray, [indices[i]!, null, null])
    addSlice(result.data as Float32Array)
  }
  return sum
}

export function useZarrIonImage() {
  // State
  const selectedMz = ref(900.5)
  const mzTolerance = ref(0.05)
  const ionMatrix = ref<number[][] | null>(null)

  // Computed
  const ionCols = computed(() => ionMatrix.value?.[0]?.length ?? 0)
  const ionRows = computed(() => ionMatrix.value?.length ?? 0)
  const totalPeaks = computed(() => (zarrMzData ? zarrMzData.length.toLocaleString() : '--'))

  // Methods
  const onSpectrumClick = async (mz: number) => {
    if (!zarrMzData) return
    selectedMz.value = mz
    const indices = findMzRangeIndices(mz, mzTolerance.value)
    ionMatrix.value = await loadIonSliceSum(indices)
  }

  // Lifecycle
  onMounted(async () => {
    await initZarr()
    if (!zarrMzData) return

    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < zarrMzData.length; i++) {
      const dist = Math.abs(zarrMzData[i]! - 900.5)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      } else if (zarrMzData[i]! > 900.5 + bestDist) {
        break
      }
    }
    selectedMz.value = zarrMzData[bestIdx]!
    const indices = findMzRangeIndices(selectedMz.value, mzTolerance.value)
    ionMatrix.value = await loadIonSliceSum(indices)
  })

  return {
    selectedMz,
    mzTolerance,
    ionMatrix,
    ionCols,
    ionRows,
    totalPeaks,
    onSpectrumClick,
  }
}
