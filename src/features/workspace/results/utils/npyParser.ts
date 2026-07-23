/**
 * Minimal browser-side parser for NumPy .npy files (v1 and v2).
 * Supports float32, float64, int32, int64, uint8, uint16, uint32.
 */

interface NpyResult {
  data: TypedArray
  shape: number[]
  dtype: string
}

type TypedArray =
  | Float32Array
  | Float64Array
  | Int32Array
  | BigInt64Array
  | Uint8Array
  | Uint16Array
  | Uint32Array

type TypedArrayConstructor = new (
  buffer: ArrayBufferLike,
  byteOffset?: number,
  length?: number,
) => TypedArray

const DTYPE_MAP: Record<string, TypedArrayConstructor> = {
  '<f4': Float32Array,
  '<f8': Float64Array,
  '<i4': Int32Array,
  '<i8': BigInt64Array,
  '|u1': Uint8Array,
  '<u2': Uint16Array,
  '<u4': Uint32Array,
  '>f4': Float32Array,
  '>f8': Float64Array,
  '>i4': Int32Array,
  '>u2': Uint16Array,
  '>u4': Uint32Array,
}

function parseNpy(buffer: ArrayBuffer): NpyResult {
  const view = new DataView(buffer)

  // Magic: \x93NUMPY
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
    view.getUint8(4),
    view.getUint8(5),
  )
  if (magic !== '\x93NUMPY') throw new Error('Not a valid .npy file')

  const major = view.getUint8(6)

  let headerLen: number
  let headerStart: number
  if (major >= 2) {
    headerLen = view.getUint32(8, true)
    headerStart = 12
  } else {
    headerLen = view.getUint16(8, true)
    headerStart = 10
  }

  const headerBytes = new Uint8Array(buffer, headerStart, headerLen)
  const header = new TextDecoder().decode(headerBytes)

  // Parse dtype
  const dtypeMatch = header.match(/'descr':\s*'([^']+)'/)
  if (!dtypeMatch) throw new Error('Cannot parse dtype from .npy header')
  const descr = dtypeMatch[1]!

  // Parse shape
  const shapeMatch = header.match(/'shape':\s*\(([^)]*)\)/)
  if (!shapeMatch) throw new Error('Cannot parse shape from .npy header')
  const shapeStr = shapeMatch[1]!.trim()
  const shape = shapeStr
    ? shapeStr
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n))
    : [0]

  // Determine byte order and find constructor
  let normalizedDescr = descr
  // Swap byte order if needed (native is little-endian on most systems)
  if (descr.startsWith('>')) {
    normalizedDescr = '<' + descr.slice(1)
  }

  const Ctor = DTYPE_MAP[normalizedDescr] || DTYPE_MAP[descr]
  if (!Ctor) throw new Error(`Unsupported dtype: ${descr}`)

  const dataStart = headerStart + headerLen
  const rawBuffer = buffer.slice(dataStart)
  const data = new Ctor(rawBuffer)

  // If big-endian, we need to byteswap
  if (descr.startsWith('>') && !(data instanceof BigInt64Array)) {
    const bytesPerElem = data.BYTES_PER_ELEMENT
    const raw = new Uint8Array(data.buffer)
    for (let i = 0; i < raw.length; i += bytesPerElem) {
      for (let j = 0; j < bytesPerElem / 2; j++) {
        const a = i + j
        const b = i + bytesPerElem - 1 - j
        const tmp = raw[a]!
        raw[a] = raw[b]!
        raw[b] = tmp
      }
    }
  }

  return { data, shape, dtype: descr }
}

export async function loadNpy(url: string): Promise<NpyResult> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`)
  const buffer = await resp.arrayBuffer()
  return parseNpy(buffer)
}
