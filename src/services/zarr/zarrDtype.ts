/**
 * dtype normalization and typed-array construction for zarr v3 arrays.
 *
 * Pure helpers (no instance state, no network) shared by the ion-image
 * reader and the clustering reader.
 */

// ---------- typed array helpers ----------

export type DType =
  | 'float32' | 'float64' | 'int32' | 'uint32'
  | 'int16' | 'uint16' | 'int8' | 'uint8'
  | 'uint64' | 'int64' | '<f4' | '<f8' | '<u4' | '<i8'

export function normalizeDtype(dtype: string): DType {
  // Handle numpy-style dtype strings
  const map: Record<string, DType> = {
    '<f4': 'float32', '<f8': 'float64',
    '<u4': 'uint32', '<i8': 'int64',
    '>f4': 'float32', '>f8': 'float64',
  }
  return (map[dtype] ?? dtype) as DType
}

export function bytesPerElement(dtype: string): number {
  const dt = normalizeDtype(dtype)
  switch (dt) {
    case 'float32': case 'int32': case 'uint32': return 4
    case 'float64': case 'int64': case 'uint64': return 8
    case 'int16': case 'uint16': return 2
    case 'int8': case 'uint8': return 1
    default: throw new Error(`[zarrDtype] unsupported dtype: ${dtype}`)
  }
}

export function makeTypedArray(dtype: string, buf: ArrayBuffer) {
  const dt = normalizeDtype(dtype)
  switch (dt) {
    case 'float32': return new Float32Array(buf)
    case 'float64': return new Float64Array(buf)
    case 'int32': return new Int32Array(buf)
    case 'uint32': return new Uint32Array(buf)
    case 'int16': return new Int16Array(buf)
    case 'uint16': return new Uint16Array(buf)
    case 'int8': return new Int8Array(buf)
    case 'uint8': return new Uint8Array(buf)
    case 'int64': return new BigInt64Array(buf)
    case 'uint64': return new BigUint64Array(buf)
    // Fail loudly instead of returning undefined: callers used to degrade to
    // an empty array and render a fully transparent image with no error.
    default: throw new Error(`[zarrDtype] unsupported dtype: ${dtype}`)
  }
}
