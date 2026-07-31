/**
 * Shared low-level primitives for reading zarr v3 arrays over OSS.
 *
 * Extracted from ZarrOssStore so the ion-image reader (massflow.msi_zarr) and
 * the clustering reader (massflow_feature_analysis) can share one
 * implementation of: codec decoding (gzip/zlib/deflate/zstd), typed-array
 * construction, v3 chunk-key computation, and metadata validation.
 *
 * Everything here is pure (no instance state, no network) - the network fetch
 * stays in each store via the shared OssClient.
 */

import { ZSTDDecoder } from 'zstddec'

// ---------- zstd decoder (singleton) ----------

let zstdDecoderPromise: Promise<ZSTDDecoder> | null = null

export function getZstdDecoder(): Promise<ZSTDDecoder> {
  if (!zstdDecoderPromise) {
    const decoder = new ZSTDDecoder()
    zstdDecoderPromise = decoder.init().then(() => decoder)
  }
  return zstdDecoderPromise
}

// ---------- decompression helpers ----------

export async function decompressBytes(payload: Uint8Array, codecName: string): Promise<Uint8Array> {
  const run = async (format: 'gzip' | 'deflate' | 'deflate-raw') => {
    const stream = new Blob([payload as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream(format))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  }
  if (codecName === 'gzip') return run('gzip')
  try {
    return await run('deflate-raw')
  } catch {
    return run('deflate')
  }
}

// ---------- zarr v3 metadata types ----------

export interface ZarrV3ArrayMetadata {
  zarr_format: 3
  node_type: 'array'
  shape: number[]
  data_type: string
  chunk_grid: {
    name: 'regular'
    configuration: { chunk_shape: number[] }
  }
  chunk_key_encoding: {
    name: 'default' | string
    configuration?: { separator?: string }
  }
  codecs?: Array<{
    name: string
    configuration?: Record<string, unknown>
  }>
  attributes?: Record<string, unknown>
  fill_value?: number | null
}

export interface ZarrV3GroupMetadata {
  zarr_format: 3
  node_type: 'group'
  attributes?: Record<string, unknown>
}

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
    default: return 4
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
  }
}

/**
 * Decompress a raw chunk payload according to the array's codecs.
 * gzip / zlib / deflate via native DecompressionStream, zstd via zstddec.
 * Pass-through when no compression codec is set.
 */
export async function decodePayload(
  meta: ZarrV3ArrayMetadata,
  raw: ArrayBuffer,
): Promise<Uint8Array> {
  let payload: Uint8Array = new Uint8Array(raw)

  const bytesCodec = (meta.codecs ?? []).find(
    (c) => ['gzip', 'zlib', 'deflate', 'zstd'].includes(c.name),
  )
  if (bytesCodec) {
    payload =
      bytesCodec.name === 'zstd'
        ? (await getZstdDecoder()).decode(payload)
        : await decompressBytes(payload, bytesCodec.name)
  }
  return payload
}

/**
 * Validate a zarr v3 array's metadata: must be a v3 array and only use
 * codecs we know how to decode (bytes / gzip / zlib / deflate / zstd).
 */
export function assertV3Array(meta: ZarrV3ArrayMetadata, label: string): void {
  if (meta.zarr_format !== 3 || meta.node_type !== 'array') {
    throw new Error(`[zarrCodecs] ${label}: not a v3 array`)
  }
  const unsupported = (meta.codecs ?? []).filter(
    (c) => !['bytes', 'gzip', 'zlib', 'deflate', 'zstd'].includes(c.name),
  )
  if (unsupported.length > 0) {
    throw new Error(
      `[zarrCodecs] ${label}: unsupported codec: ${unsupported.map((c) => c.name).join(',')}`,
    )
  }
}

/**
 * Compute the chunk key for an N-D array using zarr v3 default encoding.
 * For a single-chunk array this is "c/0/0/0" (3D) / "c/0/0" (2D) / "c/0" (1D).
 */
export function computeNDChunkKey(
  meta: ZarrV3ArrayMetadata,
  chunkIndices: number[],
): string {
  const enc = meta.chunk_key_encoding
  if (enc.name !== 'default') {
    throw new Error(
      `[zarrCodecs] unsupported chunk key encoding: ${enc.name}`,
    )
  }
  const sep = enc.configuration?.separator ?? '/'
  return `c${sep}${chunkIndices.join(sep)}`
}

/**
 * Read an entire zarr v3 array as one contiguous row-major buffer.
 *
 * Handles single- and multi-chunk arrays of any dimensionality (1D/2D/3D+).
 * All chunks are fetched in parallel through the caller-supplied `fetchChunk`
 * (one OSS GET + decodePayload per chunk-grid coordinate), then reassembled;
 * edge chunks smaller than chunk_shape are handled per the v3 spec (stored
 * unpadded). `label` is used in error messages.
 */
export async function readFullArray(
  meta: ZarrV3ArrayMetadata,
  label: string,
  fetchChunk: (coords: number[]) => Promise<Uint8Array>,
): Promise<Uint8Array> {
  const shape = meta.shape
  const chunkShape = meta.chunk_grid.configuration.chunk_shape
  const bpe = bytesPerElement(meta.data_type)
  const totalBytes = shape.reduce((a, b) => a * b, 1) * bpe
  const ndim = shape.length

  const chunkCounts = shape.map((s, i) => Math.ceil(s / chunkShape[i]!))
  const totalChunks = chunkCounts.reduce((a, b) => a * b, 1)

  // Fast path: single chunk covering the whole array.
  if (totalChunks === 1) {
    const payload = await fetchChunk(shape.map(() => 0))
    if (payload.byteLength < totalBytes) {
      throw new Error(
        `[zarrCodecs] ${label}: chunk too small (${payload.byteLength} < ${totalBytes} bytes)`,
      )
    }
    // Truncate trailing padding if the writer left any.
    return payload.byteLength === totalBytes ? payload : payload.subarray(0, totalBytes)
  }

  // Enumerate every chunk-grid coordinate (row-major over the grid).
  const allCoords: number[][] = []
  const enumerate = (d: number, acc: number[]) => {
    if (d === ndim) {
      allCoords.push([...acc])
      return
    }
    for (let i = 0; i < chunkCounts[d]!; i++) {
      acc[d] = i
      enumerate(d + 1, acc)
    }
  }
  enumerate(0, new Array(ndim).fill(0))
  const payloads = await Promise.all(allCoords.map(fetchChunk))

  // Element strides (row-major) of the full array.
  const fullStrides = new Array<number>(ndim)
  fullStrides[ndim - 1] = 1
  for (let i = ndim - 2; i >= 0; i--) fullStrides[i] = fullStrides[i + 1]! * shape[i + 1]!

  const out = new Uint8Array(totalBytes)
  for (let ci = 0; ci < allCoords.length; ci++) {
    const coords = allCoords[ci]!
    const payload = payloads[ci]!
    // Edge chunks can be smaller than chunk_shape.
    const origin = coords.map((c, d) => c * chunkShape[d]!)
    const actual = coords.map((c, d) => Math.min(chunkShape[d]!, shape[d]! - origin[d]!))
    const chunkBytes = actual.reduce((a, b) => a * b, 1) * bpe
    if (payload.byteLength < chunkBytes) {
      throw new Error(
        `[zarrCodecs] ${label}: chunk (${coords.join(',')}) too small (${payload.byteLength} < ${chunkBytes} bytes)`,
      )
    }

    // Element strides (row-major) within this chunk.
    const chunkStrides = new Array<number>(ndim)
    chunkStrides[ndim - 1] = 1
    for (let i = ndim - 2; i >= 0; i--) chunkStrides[i] = chunkStrides[i + 1]! * actual[i + 1]!

    // Copy row by row along the last dim (contiguous in both buffers).
    const lastBytes = actual[ndim - 1]! * bpe
    let outerCount = 1
    for (let i = 0; i < ndim - 1; i++) outerCount *= actual[i]!
    for (let r = 0; r < outerCount; r++) {
      let rem = r
      let chunkOffElems = 0
      let fullOffElems = 0
      for (let d = ndim - 2; d >= 0; d--) {
        const coord = rem % actual[d]!
        rem = Math.floor(rem / actual[d]!)
        chunkOffElems += coord * chunkStrides[d]!
        fullOffElems += (origin[d]! + coord) * fullStrides[d]!
      }
      fullOffElems += origin[ndim - 1]! // last-dim stride is 1
      out.set(
        payload.subarray(chunkOffElems * bpe, chunkOffElems * bpe + lastBytes),
        fullOffElems * bpe,
      )
    }
  }
  return out
}
