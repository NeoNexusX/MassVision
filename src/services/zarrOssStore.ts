/**
 * On-demand reader for zarr v3 data stored in Alibaba Cloud OSS, with
 * decoding. Downloads one chunk at a time and caches the last N via LRU.
 *
 * Pipeline: STS token → OSS GET → zarr metadata → chunk path resolution
 *           → decode → ion image.
 *
 * Concurrency: requests for the same chunk share a single in-flight Promise.
 * Also kicks off background prefetches of neighboring chunks; prefetch
 * failures never block the main image request.
 *
 * Supported codecs: gzip (via fflate), zlib/deflate, zstd (via zstddec);
 * unsupported codecs raise a clear error.
 *
 * Zarr layout assumed by this project:
 *   <root>/zarr.json
 *   <root>/mz_axis/zarr.json + chunk files
 *   <root>/ion_images/zarr.json + chunk files
 *       shape: [nMz, H, W], chunk shape typically [16, H, W]
 *
 * Chunk key encoding (zarr v3 default encoding "default"):
 *   <root>/ion_images/c<chunkIndex>/<innerChunkKey>
 *   where innerChunkKey is the dimension indices joined by the configured
 *   separator (default ".").
 *
 *   Example (ndim=3, chunk_shape=[16, H, W], full chunks):
 *     ion_images/c0/0.0.0
 *     ion_images/c1/0.0.0
 *     ...
 */

import { gunzip, inflate } from 'fflate'
import { ZSTDDecoder } from 'zstddec'
import { LruCache } from '../utils/lruCache'
import { createOssClient } from './ossClient'
import type { OssClient, OssError } from './ossClient'
import type { ZarrAccessResponse } from './zarrAccessApi'

// ---------- zstd decoder (singleton; WASM is initialized once) ----------

let zstdDecoderPromise: Promise<ZSTDDecoder> | null = null

function getZstdDecoder(): Promise<ZSTDDecoder> {
  if (!zstdDecoderPromise) {
    const decoder = new ZSTDDecoder()
    zstdDecoderPromise = decoder.init().then(() => decoder)
  }
  return zstdDecoderPromise
}

// ---------- zarr v3 metadata types (subset) ----------

interface ZarrV3ArrayMetadata {
  zarr_format: 3
  node_type: 'array'
  shape: number[]
  data_type:
    | 'float32'
    | 'float64'
    | 'int32'
    | 'int64'
    | 'uint32'
    | 'uint64'
    | 'uint8'
    | 'uint16'
    | 'int16'
    | 'uint16'
    | 'int8'
    | 'bool'
    | string
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
  dimension_names?: string[]
  fill_value?: number | null
}

interface ZarrV3GroupMetadata {
  zarr_format: 3
  node_type: 'group'
  attributes?: Record<string, unknown>
}

// ---------- typed array helpers ----------

type DType =
  | 'float32'
  | 'float64'
  | 'int32'
  | 'uint32'
  | 'int16'
  | 'uint16'
  | 'int8'
  | 'uint8'
  | 'uint64'
  | 'int64'

function bytesPerElement(dtype: DType): number {
  switch (dtype) {
    case 'float32':
    case 'int32':
    case 'uint32':
      return 4
    case 'float64':
    case 'int64':
    case 'uint64':
      return 8
    case 'int16':
    case 'uint16':
      return 2
    case 'int8':
    case 'uint8':
      return 1
    default:
      return 4
  }
}

function makeTypedArray(
  dtype: DType,
  buf: ArrayBuffer,
): Float32Array | Float64Array | Int32Array | Uint32Array | Int16Array | Uint16Array | Int8Array | Uint8Array | BigInt64Array | BigUint64Array {
  switch (dtype) {
    case 'float32':
      return new Float32Array(buf)
    case 'float64':
      return new Float64Array(buf)
    case 'int32':
      return new Int32Array(buf)
    case 'uint32':
      return new Uint32Array(buf)
    case 'int16':
      return new Int16Array(buf)
    case 'uint16':
      return new Uint16Array(buf)
    case 'int8':
      return new Int8Array(buf)
    case 'uint8':
      return new Uint8Array(buf)
    case 'int64':
      return new BigInt64Array(buf)
    case 'uint64':
      return new BigUint64Array(buf)
  }
}

// ---------- main store ----------

export interface IonImageInfo {
  mzIndex: number
  mz: number
  chunkIndex: number
  localIndex: number
  width: number
  height: number
  /** row-major [H, W] */
  matrix: Float32Array
}

export interface DecodedIonImageChunk {
  chunkIndex: number
  /** ndim === 3 → [chunkSize, H, W] in one Float32Array (row-major) */
  data: Float32Array
  chunkShape: [number, number, number]
  width: number
  height: number
  /** Global mz_axis index for each mz slot in this chunk. */
  mzIndices: number[]
  /** mz value for each mz slot in this chunk. */
  mzValues: number[]
}

export interface CacheInfo {
  maxSize: number
  size: number
  keys: (string | number)[]
  currentChunk: number | null
  prefetchEnabled: boolean
}

export interface ZarrOssStoreOptions {
  /** ion_images chunk cache size; defaults to 5. */
  ionChunkCacheSize?: number
  /** Whether to enable neighbor prefetch; defaults to true. */
  enablePrefetch?: boolean
}

interface InFlightEntry {
  promise: Promise<DecodedIonImageChunk & { fetchMs: number; decodeMs: number }>
  cached: boolean
}

export class ZarrOssStore {
  private access: ZarrAccessResponse
  private oss: OssClient
  private cache: LruCache<number, DecodedIonImageChunk>
  private inFlight = new Map<number, InFlightEntry>()
  private currentChunk: number | null = null
  private enablePrefetch: boolean

  // metadata
  private ionMeta: ZarrV3ArrayMetadata | null = null
  private mzMeta: ZarrV3ArrayMetadata | null = null

  // data
  private mzAxis: Float32Array | Float64Array | null = null

  constructor(access: ZarrAccessResponse, options: ZarrOssStoreOptions = {}) {
    this.access = access
    this.oss = createOssClient(access)
    this.cache = new LruCache<number, DecodedIonImageChunk>(options.ionChunkCacheSize ?? 5)
    this.enablePrefetch = options.enablePrefetch ?? true
  }

  // ---------- lifecycle ----------

  async init(): Promise<void> {
    // Read the root zarr.json to confirm this is a group.
    const rootMeta = await this.readJson<ZarrV3GroupMetadata>('zarr.json')
    if (rootMeta.zarr_format !== 3 || rootMeta.node_type !== 'group') {
      throw new Error(
        `[ZarrOssStore] unsupported zarr format/node_type: ${rootMeta.zarr_format}/${rootMeta.node_type}`,
      )
    }
    this.ionMeta = await this.readJson<ZarrV3ArrayMetadata>('ion_images/zarr.json')
    this.mzMeta = await this.readJson<ZarrV3ArrayMetadata>('mz_axis/zarr.json')

    this.assertIonImagesMetadata(this.ionMeta)
    this.assertIsV3Array(this.mzMeta, 'mz_axis')

    if (import.meta.env.DEV) {
      console.table({
        bucket: this.access.bucket,
        region: this.access.region,
        folderPath: this.access.folder_path,
        mzAxisLength: this.mzMeta.shape[0],
        ionImagesShape: this.ionMeta.shape.join('x'),
        ionImagesChunkShape: this.ionMeta.chunk_grid.configuration.chunk_shape.join('x'),
        dtype: this.ionMeta.data_type,
        codecs: (this.ionMeta.codecs ?? []).map((c) => c.name).join(',') || '(none)',
        cacheSize: this.cache.maxSize,
      })
    }
  }

  private assertIsV3Array(meta: ZarrV3ArrayMetadata, label: string) {
    if (meta.zarr_format !== 3 || meta.node_type !== 'array') {
      throw new Error(`[ZarrOssStore] ${label}: not a v3 array`)
    }
    const unsupported = (meta.codecs ?? []).filter(
      (c: { name: string }) => !['bytes', 'gzip', 'zlib', 'deflate', 'zstd'].includes(c.name),
    )
    if (unsupported.length > 0) {
      throw new Error(
        `[ZarrOssStore] ${label}: unsupported codec: ${unsupported.map((c) => c.name).join(',')}`,
      )
    }
  }

  private assertIonImagesMetadata(meta: ZarrV3ArrayMetadata) {
    this.assertIsV3Array(meta, 'ion_images')
    if (meta.shape.length !== 3) {
      throw new Error(
        `[ZarrOssStore] ion_images: expected ndim=3 [nMz,H,W], got shape=[${meta.shape.join(',')}]`,
      )
    }
  }

  // ---------- OSS read helpers ----------

  private key(relativePath: string): string {
    // folder_path usually ends with "/"
    const root = this.access.folder_path
    const rel = relativePath.replace(/^\/+/, '')
    return root.endsWith('/') ? `${root}${rel}` : `${root}/${rel}`
  }

  private async readJson<T>(relativePath: string): Promise<T> {
    const key = this.key(relativePath)
    const ab = await this.oss.getObjectArrayBuffer(key)
    const text = new TextDecoder('utf-8').decode(new Uint8Array(ab))
    try {
      return JSON.parse(text) as T
    } catch (e) {
      throw new Error(
        `[ZarrOssStore] failed to parse JSON at ${key}: ${(e as Error).message}`,
      )
    }
  }

  // ---------- chunk key encoding ----------

  /**
   * Compute the OSS object key for ion_images chunk #chunkIndex.
   *
   * Zarr v3 default chunk key encoding:
   *   ["c", ...chunkCoords].join(separator)   (separator defaults to "/")
   * → for chunkIndex=5 with H/W = 0: "ion_images/c/5/0/0"
   */
  private computeChunkKey(chunkIndex: number): string {
    if (!this.ionMeta) throw new Error('[ZarrOssStore] ionMeta not loaded, call init() first')
    const enc = this.ionMeta.chunk_key_encoding
    if (enc.name !== 'default') {
      throw new Error(`[ZarrOssStore] unsupported chunk key encoding: ${enc.name}`)
    }
    const sep = enc.configuration?.separator ?? '/'
    // Full chunk: mz dim = chunkIndex, H/W dims = 0.
    const inner = `c${sep}${chunkIndex}${sep}0${sep}0`
    return `ion_images/${inner}`
  }

  // ---------- decode chunk bytes ----------

  private async decodeIonImageChunk(
    chunkIndex: number,
    raw: ArrayBuffer,
  ): Promise<DecodedIonImageChunk> {
    if (!this.ionMeta) throw new Error('[ZarrOssStore] ionMeta not loaded')
    const dtype = this.ionMeta.data_type as DType
    const chunkShape = this.ionMeta.chunk_grid.configuration.chunk_shape as [
      number,
      number,
      number,
    ]
    const [cs, h, w] = chunkShape

    let payload: Uint8Array = new Uint8Array(raw)

    // 1) Decompress bytes-to-bytes codec (gzip / zlib / deflate / zstd).
    //    Array-to-bytes codecs like "bytes" are no-ops here.
    const bytesCodec = (this.ionMeta.codecs ?? []).find(
      (c: { name: string }) => ['gzip', 'zlib', 'deflate', 'zstd'].includes(c.name),
    )
    if (bytesCodec) {
      const decompressed = await new Promise<Uint8Array>((resolve, reject) => {
        if (bytesCodec.name === 'gzip') {
          gunzip(payload, (err, out) => (err ? reject(err) : resolve(out)))
        } else if (bytesCodec.name === 'zlib' || bytesCodec.name === 'deflate') {
          inflate(payload, (err, out) => (err ? reject(err) : resolve(out)))
        } else if (bytesCodec.name === 'zstd') {
          getZstdDecoder()
            .then((dec) => resolve(dec.decode(payload)))
            .catch(reject)
        } else {
          reject(
            new Error(
              `[ZarrOssStore] unsupported bytes codec: ${bytesCodec.name}`,
            ),
          )
        }
      })
      payload = decompressed
    }

    // 2) Verify byte length.
    const bpe = bytesPerElement(dtype)
    const gotBytes = payload.byteLength
    if (bpe * cs * h * w !== gotBytes) {
      // Partial chunks at the mz boundary may have fewer than `cs` planes; allow that.
      const actualCs = Math.floor(gotBytes / (bpe * h * w))
      if (actualCs <= 0 || actualCs > cs) {
        throw new Error(
          `[ZarrOssStore] chunk size mismatch at chunkIndex=${chunkIndex}: ` +
            `expected ${bpe * cs * h * w} bytes, got ${gotBytes} bytes`,
        )
      }
      // Edge chunk: replace the effective cs with the actual one.
      ;(chunkShape as number[])[0] = actualCs
    }

    // 3) Wrap into an ArrayBuffer to rebuild the typed array
    // (fflate's output is a Uint8Array whose byteOffset may be non-zero).
    const ab = payload.buffer.slice(
      payload.byteOffset,
      payload.byteOffset + payload.byteLength,
    )
    const typed = makeTypedArray(dtype, ab as ArrayBuffer) as Float32Array | Float64Array
    // Normalize to Float32Array for downstream consumers.
    const normalized = typed instanceof Float32Array ? typed : Float32Array.from(typed as Float64Array)

    // 4) Compute global mz_axis index and mz value for each plane in this chunk.
    const mzStart = chunkIndex * (this.ionMeta.chunk_grid.configuration.chunk_shape[0] ?? cs)
    const actualCs = (chunkShape as number[])[0]!
    const mzIndices: number[] = []
    const mzValues: number[] = []
    if (this.mzAxis) {
      for (let i = 0; i < actualCs; i++) {
        const gi = mzStart + i
        if (gi < this.mzAxis.length) {
          mzIndices.push(gi)
          mzValues.push(this.mzAxis[gi]!)
        }
      }
    }

    return {
      chunkIndex,
      data: normalized,
      chunkShape: [actualCs, h, w],
      width: w,
      height: h,
      mzIndices,
      mzValues,
    }
  }

  // ---------- public API ----------

  async loadMzAxis(): Promise<Float32Array | Float64Array> {
    if (this.mzAxis) return this.mzAxis
    if (!this.mzMeta) throw new Error('[ZarrOssStore] call init() first')
    const ab = await this.fetchArrayFull('mz_axis', this.mzMeta)
    const dtype = this.mzMeta.data_type as DType
    const typed = makeTypedArray(dtype, ab)
    this.mzAxis =
      typed instanceof Float32Array || typed instanceof Float64Array
        ? typed
        : Float64Array.from(typed as ArrayLike<number>)
    return this.mzAxis
  }

  /**
   * General-purpose: read a small 1D/2D array in one shot. Downloads every
   * chunk and concatenates them. Only used for small arrays like mz_axis.
   */
  private async fetchArrayFull(
    relPath: string,
    meta: ZarrV3ArrayMetadata,
  ): Promise<ArrayBuffer> {
    const total = meta.shape.reduce((a, b) => a * b, 1)
    const bpe = bytesPerElement(meta.data_type as DType)
    const out = new Uint8Array(total * bpe)

    const chunkShape = meta.chunk_grid.configuration.chunk_shape
    const dims = meta.shape.length
    const totalChunks: number[] = meta.shape.map((s, i) => Math.ceil(s / chunkShape[i]!))

    const chunkIndices: number[][] = [[]]
    for (let d = 0; d < dims; d++) {
      const next: number[][] = []
      for (const prefix of chunkIndices) {
        for (let i = 0; i < totalChunks[d]!; i++) next.push([...prefix, i])
      }
      chunkIndices.length = 0
      chunkIndices.push(...next)
    }

    for (const ci of chunkIndices) {
      const enc = meta.chunk_key_encoding
      let chunkKey: string
      if (enc.name === 'default') {
        const sep = enc.configuration?.separator ?? '/'
        chunkKey = ['c', ...ci].join(sep)
      } else {
        throw new Error(`[ZarrOssStore] unsupported chunk key encoding: ${enc.name}`)
      }
      const chunkRelKey = `${relPath}/${chunkKey}`
      const raw = await this.oss.getObjectArrayBuffer(this.key(chunkRelKey))
      let payload: Uint8Array = new Uint8Array(raw)
      const bytesCodec = (meta.codecs ?? []).find(
        (c: { name: string }) => ['gzip', 'zlib', 'deflate', 'zstd'].includes(c.name),
      )
      if (bytesCodec) {
        payload = await new Promise<Uint8Array>((resolve, reject) => {
          if (bytesCodec.name === 'gzip') {
            gunzip(payload, (err, out) => (err ? reject(err) : resolve(out)))
          } else if (bytesCodec.name === 'zlib' || bytesCodec.name === 'deflate') {
            inflate(payload, (err, out) => (err ? reject(err) : resolve(out)))
          } else if (bytesCodec.name === 'zstd') {
            getZstdDecoder()
              .then((dec) => resolve(dec.decode(payload)))
              .catch(reject)
          } else {
            reject(new Error(`[ZarrOssStore] unsupported codec: ${bytesCodec.name}`))
          }
        })
      }
      // Compute this chunk's byte offset inside `out`.
      const chunkStart: number[] = ci.map((c, d) => c * chunkShape[d]!)
      const chunkSize: number[] = ci.map((c, d) => {
        const start = c * chunkShape[d]!
        return Math.min(chunkShape[d]!, meta.shape[d]! - start)
      })
      // Simplified: only 1D is supported by this function. 2D+ is not handled here.
      if (dims === 1) {
        const start = chunkStart[0]! * bpe
        out.set(payload.subarray(0, chunkSize[0]! * bpe), start)
      } else {
        // 2D: copy row by row.
        if (dims === 2) {
          const [ch, cw] = chunkShape
          const [h, w] = chunkSize
          for (let r = 0; r < h!; r++) {
            const srcOff = r * ch! * bpe
            const dstOff = ((chunkStart[0]! + r) * meta.shape[1]! + chunkStart[1]!) * bpe
            out.set(payload.subarray(srcOff, srcOff + w! * bpe), dstOff)
          }
        } else {
          throw new Error(
            `[ZarrOssStore] fetchArrayFull only supports 1D/2D, got ndim=${dims}`,
          )
        }
      }
    }

    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)
  }

  /**
   * Core entry point: lazily fetch a single ion image.
   * Automatically goes through the LRU cache; concurrent requests for the
   * same chunk share a single in-flight Promise.
   */
  async getIonImageByMzIndex(mzIndex: number): Promise<IonImageInfo> {
    if (!this.ionMeta) throw new Error('[ZarrOssStore] call init() first')
    if (!this.mzAxis) await this.loadMzAxis()

    const totalMz = this.ionMeta.shape[0]!
    if (mzIndex < 0 || mzIndex >= totalMz) {
      throw new Error(
        `[ZarrOssStore] mzIndex out of range: ${mzIndex} (total ${totalMz})`,
      )
    }
    const chunkShape = this.ionMeta.chunk_grid.configuration.chunk_shape
    const cs = chunkShape[0]!
    const chunkIndex = Math.floor(mzIndex / cs)
    const localIndex = mzIndex % cs

    const t0 = performance.now()
    const cached = this.cache.get(chunkIndex)
    let chunk: DecodedIonImageChunk
    let chunkCacheHit = false
    let fetchMs = 0
    let decodeMs = 0
    if (cached) {
      chunk = cached
      chunkCacheHit = true
    } else {
      const inflight = this.inFlight.get(chunkIndex)
      if (inflight) {
        const decoded = await inflight.promise
        chunk = decoded
        chunkCacheHit = inflight.cached
        fetchMs = decoded.fetchMs
        decodeMs = decoded.decodeMs
      } else {
        const p = this.fetchAndDecodeChunk(chunkIndex)
        this.inFlight.set(chunkIndex, { promise: p, cached: false })
        let decoded: DecodedIonImageChunk & { fetchMs: number; decodeMs: number }
        try {
          decoded = await p
          chunk = decoded
        } catch (err) {
          this.inFlight.delete(chunkIndex)
          throw err
        }
        this.inFlight.delete(chunkIndex)
        this.cache.set(chunkIndex, chunk)
        fetchMs = decoded.fetchMs
        decodeMs = decoded.decodeMs
      }
    }

    this.currentChunk = chunkIndex

    const [, h, w] = chunk.chunkShape
    const planeSize = h * w
    // Return a subarray VIEW (no copy): the caller (loadIonSliceSum) accumulates
    // it into a target matrix immediately, so the view stays valid for the
    // duration of the call and the chunk cannot be evicted by LRU mid-use.
    const matrix = chunk.data.subarray(localIndex * planeSize, (localIndex + 1) * planeSize)

    const info: IonImageInfo = {
      mzIndex,
      mz: this.mzAxis ? (this.mzAxis[mzIndex] as number) : NaN,
      chunkIndex,
      localIndex,
      width: w,
      height: h,
      matrix,
    }

    if (import.meta.env.DEV) {
      console.table({
        mzIndex,
        mz: info.mz,
        chunkIndex,
        localIndex,
        chunkCacheHit,
        objectKey: this.computeChunkKey(chunkIndex),
        fetchMs: Math.round(fetchMs),
        decodeMs: Math.round(decodeMs),
        renderMs: Math.round(performance.now() - t0),
      })
    }

    return info
  }

  async getIonImageChunk(chunkIndex: number): Promise<DecodedIonImageChunk> {
    const cached = this.cache.get(chunkIndex)
    if (cached) return cached
    const inflight = this.inFlight.get(chunkIndex)
    if (inflight) return inflight.promise
    const p = this.fetchAndDecodeChunk(chunkIndex)
    this.inFlight.set(chunkIndex, { promise: p, cached: false })
    try {
      const chunk = await p
      this.inFlight.delete(chunkIndex)
      this.cache.set(chunkIndex, chunk)
      return chunk
    } catch (err) {
      this.inFlight.delete(chunkIndex)
      throw err
    }
  }

  private async fetchAndDecodeChunk(chunkIndex: number): Promise<DecodedIonImageChunk & { fetchMs: number; decodeMs: number }> {
    const relKey = this.computeChunkKey(chunkIndex)
    const key = this.key(relKey)
    const tFetch0 = performance.now()
    const raw = await this.oss.getObjectArrayBuffer(key)
    const fetchMs = performance.now() - tFetch0
    const tDecode0 = performance.now()
    const decoded = await this.decodeIonImageChunk(chunkIndex, raw)
    const decodeMs = performance.now() - tDecode0
    return Object.assign(decoded, { fetchMs, decodeMs })
  }

  /**
   * Background prefetch of the current chunk's neighbors.
   * Failures only emit a warning and never block the main request.
   */
  prefetchNeighborChunks(mzIndex: number): void {
    if (!this.enablePrefetch || !this.ionMeta) return
    const cs = this.ionMeta.chunk_grid.configuration.chunk_shape[0]!
    const totalMz = this.ionMeta.shape[0]!
    const totalChunks = Math.ceil(totalMz / cs)
    const center = Math.floor(mzIndex / cs)
    const radius = Math.max(1, Math.floor((this.cache.maxSize - 1) / 2))
    const targets: number[] = []
    for (let off = -radius; off <= radius; off++) {
      const c = center + off
      if (c < 0 || c >= totalChunks) continue
      if (c === center) continue
      if (this.cache.has(c) || this.inFlight.has(c)) continue
      targets.push(c)
    }
    for (const c of targets) {
      const p = this.fetchAndDecodeChunk(c)
      this.inFlight.set(c, { promise: p, cached: false })
      void p.then((chunk) => {
          this.inFlight.delete(c)
          this.cache.set(c, chunk)
        })
        .catch((err) => {
          this.inFlight.delete(c)
          console.warn(
            `[ZarrOssStore] prefetch failed for chunk ${c}:`,
            (err as OssError).message ?? err,
          )
        })
    }
  }

  getCacheInfo(): CacheInfo {
    return {
      maxSize: this.cache.maxSize,
      size: this.cache.size,
      keys: this.cache.keys(),
      currentChunk: this.currentChunk,
      prefetchEnabled: this.enablePrefetch,
    }
  }

  getIonShape(): number[] | null {
    return this.ionMeta?.shape ?? null
  }

  getIonChunkShape(): number[] | null {
    return this.ionMeta?.chunk_grid.configuration.chunk_shape ?? null
  }
}
