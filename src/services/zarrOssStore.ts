/**
 * On-demand reader for MassFlow MSI Zarr v1.0 data stored in Alibaba Cloud OSS.
 *
 * New format (v1.0) supports two data layouts:
 *   - ion-major continuous → ion image + mean spectrum (existing feature)
 *   - pixel-major processed → TIC image + per-pixel spectrum (new feature)
 *
 * Layout (see public/zarr_schema.md):
 *   <root>/.zattrs              — root attributes (format, spatial_shape, etc.)
 *   <root>/metadata/.zattrs     — semantic metadata
 *   <root>/axes/coordinates     — (n_pixels, 3) uint32, pixel coordinates
 *   <root>/axes/mz              — shared m/z axis (continuous only)
 *   <root>/data/.zattrs         — row_axis + encoding
 *   <root>/data/intensity/      — 1D float32, flattened intensity values
 *   <root>/data/offsets/        — (n_rows+1,) int64, row boundary indices
 *   <root>/data/mz/             — per-point m/z (processed only)
 *   <root>/stats/mean_spectrum/ — optional, pre-computed mean spectrum
 *   <root>/stats/tic/           — optional, pre-computed TIC (processed mode)
 *
 * Chunk caching: intensity chunks use LRU cache (default 20 chunks).
 * In-flight request deduplication prevents redundant OSS requests for
 * the same chunk.
 *
 * Supported codecs: gzip / zlib / deflate (native DecompressionStream),
 * zstd (via zstddec).
 */

import { ZSTDDecoder } from 'zstddec'
import { LruCache } from '../utils/lruCache'
import { createOssClient } from './ossClient'
import type { OssClient } from './ossClient'
import type { ZarrAccessResponse } from './zarrAccessApi'

// ---------- zstd decoder (singleton) ----------

let zstdDecoderPromise: Promise<ZSTDDecoder> | null = null

function getZstdDecoder(): Promise<ZSTDDecoder> {
  if (!zstdDecoderPromise) {
    const decoder = new ZSTDDecoder()
    zstdDecoderPromise = decoder.init().then(() => decoder)
  }
  return zstdDecoderPromise
}

// ---------- decompression helpers ----------

async function decompressBytes(payload: Uint8Array, codecName: string): Promise<Uint8Array> {
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

interface ZarrV3ArrayMetadata {
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

interface ZarrV3GroupMetadata {
  zarr_format: 3
  node_type: 'group'
  attributes?: Record<string, unknown>
}

// ---------- typed array helpers ----------

type DType =
  | 'float32' | 'float64' | 'int32' | 'uint32'
  | 'int16' | 'uint16' | 'int8' | 'uint8'
  | 'uint64' | 'int64' | '<f4' | '<f8' | '<u4' | '<i8'

function normalizeDtype(dtype: string): DType {
  // Handle numpy-style dtype strings
  const map: Record<string, DType> = {
    '<f4': 'float32', '<f8': 'float64',
    '<u4': 'uint32', '<i8': 'int64',
    '>f4': 'float32', '>f8': 'float64',
  }
  return (map[dtype] ?? dtype) as DType
}

function bytesPerElement(dtype: string): number {
  const dt = normalizeDtype(dtype)
  switch (dt) {
    case 'float32': case 'int32': case 'uint32': return 4
    case 'float64': case 'int64': case 'uint64': return 8
    case 'int16': case 'uint16': return 2
    case 'int8': case 'uint8': return 1
    default: return 4
  }
}

function makeTypedArray(dtype: string, buf: ArrayBuffer) {
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

// ---------- domain types ----------

export type DataMode = 'continuous' | 'processed'

/** Root attributes from /.zattrs */
export interface RootAttrs {
  format: string
  format_version: string
  write_state: string
  coordinate_order: string[]
  coordinate_base: number
  spatial_shape: [number, number]
}

/** Data group attributes from /data/.zattrs */
export interface DataAttrs {
  row_axis: 'pixel' | 'ion'
  encoding: 'continuous' | 'processed'
}

/** Metadata attributes from /metadata/.zattrs */
export interface MetadataAttrs {
  name?: string
  version?: number
  spectrum_count_num?: number
  max_count_of_pixels_x?: number
  max_count_of_pixels_y?: number
  pixel_size_horizontal?: number
  pixel_size_vertical?: number
  analyzer?: string
  ionisation_source?: string
  polarity?: string
  centroid_spectrum?: boolean
  profile_spectrum?: boolean
  continuous?: boolean
  processed?: boolean
  ms1_spectrum?: boolean
  msn_spectrum?: boolean
  filename?: string
  [key: string]: unknown
}

export interface IonImageInfo {
  mzIndex: number
  mz: number
  /** Row-major [height * width] */
  matrix: Float32Array
  width: number
  height: number
}

export interface PixelSpectrum {
  pixelIndex: number
  /** 1-based coordinate from axes/coordinates */
  x: number
  y: number
  mz: Float64Array
  intensity: Float32Array
}

export interface CacheInfo {
  intensityChunkCacheSize: number
  intensityChunkCacheEntries: number
  mzChunkCacheSize: number
  mzChunkCacheEntries: number
}

// ---------- main store ----------

export class ZarrOssStore {
  private access: ZarrAccessResponse
  private oss: OssClient

  // Mode detection
  private _dataMode: DataMode | null = null
  private _rowAxis: 'pixel' | 'ion' | null = null

  // Root attributes
  private _spatialShape: [number, number] | null = null
  private coordinateBase: number = 1

  // Array metadata (zarr.json for each array)
  private intensityMeta: ZarrV3ArrayMetadata | null = null
  private offsetsMeta: ZarrV3ArrayMetadata | null = null
  private dataMzMeta: ZarrV3ArrayMetadata | null = null
  private axesMzMeta: ZarrV3ArrayMetadata | null = null
  private coordinatesMeta: ZarrV3ArrayMetadata | null = null
  private meanSpectrumMeta: ZarrV3ArrayMetadata | null = null
  private ticMeta: ZarrV3ArrayMetadata | null = null

  // Fully loaded small arrays (cached after first load)
  private coordinates: Uint32Array | null = null
  private mzAxis: Float64Array | null = null
  private _offsets: number[] | null = null   // converted from int64
  private meanSpectrum: Float32Array | null = null
  private ticData: Float64Array | null = null

  // Metadata attrs
  private _metadataAttrs: MetadataAttrs | null = null

  // Chunk caches for large 1D arrays
  private intensityChunkCache: LruCache<number, Float32Array>
  private mzChunkCache: LruCache<number, Float64Array>
  private inFlightIntensity = new Map<number, Promise<Float32Array>>()
  private inFlightMz = new Map<number, Promise<Float64Array>>()

  // Derived
  private totalIntensityPoints: number = 0
  private totalMzPoints: number = 0

  constructor(
    access: ZarrAccessResponse,
    options: { intensityChunkCacheSize?: number; mzChunkCacheSize?: number } = {},
  ) {
    this.access = access
    this.oss = createOssClient(access)
    this.intensityChunkCache = new LruCache<number, Float32Array>(
      options.intensityChunkCacheSize ?? 20,
    )
    this.mzChunkCache = new LruCache<number, Float64Array>(
      options.mzChunkCacheSize ?? 5,
    )
  }


  // ========== public accessors ==========

  get dataMode(): DataMode {
    if (!this._dataMode) throw new Error('[ZarrOssStore] call init() first')
    return this._dataMode
  }

  get rowAxis(): 'pixel' | 'ion' {
    if (!this._rowAxis) throw new Error('[ZarrOssStore] call init() first')
    return this._rowAxis
  }

  get spatialShape(): [number, number] {
    if (!this._spatialShape) throw new Error('[ZarrOssStore] call init() first')
    return this._spatialShape
  }

  get nRows(): number {
    return this._offsets ? this._offsets.length - 1 : 0
  }

  get metadataAttrs(): MetadataAttrs | null {
    return this._metadataAttrs
  }

  // ========== lifecycle ==========

  /**
   * 初始化：读取根属性、data 属性、各数组元数据。
   * 自动判定数据模式（continuous / processed）和行轴（pixel / ion）。
   *
   * 属性优先从 zarr.json 的 attributes 字段读取；
   * 如果不存在才尝试独立 .zattrs 文件（兼容其他 writer）。
   */
  async init(): Promise<void> {
    // 1) 根 zarr.json：验证 v3 group + 从中提取根属性
    const rootZarrJson = await this.readJson<ZarrV3GroupMetadata>('zarr.json')
    if (rootZarrJson.zarr_format !== 3 || rootZarrJson.node_type !== 'group') {
      throw new Error(
        `[ZarrOssStore] unsupported root zarr format/node_type: ${rootZarrJson.zarr_format}/${rootZarrJson.node_type}`,
      )
    }

    const rootAttrs = rootZarrJson.attributes as unknown as RootAttrs | undefined
    if (!rootAttrs?.format || !rootAttrs?.spatial_shape) {
      throw new Error(
        '[ZarrOssStore] root zarr.json missing required attributes (format, spatial_shape)',
      )
    }
    this.validateRootAttrs(rootAttrs)
    this._spatialShape = rootAttrs.spatial_shape
    this.coordinateBase = rootAttrs.coordinate_base

    // 2) data 组属性：优先 zarr.json attributes，其次 .zattrs
    const dataAttrs = await this.readDataAttrs()
    this._rowAxis = dataAttrs.row_axis
    this._dataMode = dataAttrs.encoding

    // 3) 读取各 data 子数组的 zarr.json 元数据
    this.intensityMeta = await this.readArrayMeta('data/intensity')
    this.offsetsMeta = await this.readArrayMeta('data/offsets')
    this.totalIntensityPoints = this.intensityMeta.shape[0]!

    // 5) data/mz 仅 processed 模式存在
    if (this._dataMode === 'processed') {
      try {
        this.dataMzMeta = await this.readArrayMeta('data/mz')
        this.totalMzPoints = this.dataMzMeta.shape[0]!
      } catch {
        throw new Error(
          '[ZarrOssStore] processed mode requires data/mz array',
        )
      }
    }

    // 6) axes/mz 仅 continuous 模式存在
    if (this._dataMode === 'continuous') {
      try {
        this.axesMzMeta = await this.readArrayMeta('axes/mz')
      } catch {
        throw new Error(
          '[ZarrOssStore] continuous mode requires axes/mz array',
        )
      }
    }

    // 7) axes/coordinates 始终存在
    this.coordinatesMeta = await this.readArrayMeta('axes/coordinates')

    // 7) metadata 属性（非致命，可能不存在）
    try {
      const meta = await this.readJson<ZarrV3GroupMetadata>('metadata/zarr.json')
      if (meta.attributes) {
        this._metadataAttrs = meta.attributes as unknown as MetadataAttrs
      }
    } catch {
      // metadata 组可选
    }

    // 9) stats/mean_spectrum（非致命，可能不存在）
    try {
      this.meanSpectrumMeta = await this.readArrayMeta('stats/mean_spectrum')
      if (import.meta.env.DEV) {
        console.log('[ZarrOssStore] mean_spectrum found', {
          shape: this.meanSpectrumMeta.shape.join('×'),
          dtype: this.meanSpectrumMeta.data_type,
        })
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[ZarrOssStore] mean_spectrum not available — this Zarr file has no pre-computed stats.', (e as Error).message)
      }
    }

    // 10) stats/tic（非致命，可能不存在；仅 processed 模式有意义）
    try {
      this.ticMeta = await this.readArrayMeta('stats/tic')
      if (import.meta.env.DEV) {
        console.log('[ZarrOssStore] stats/tic found', {
          shape: this.ticMeta.shape.join('×'),
          dtype: this.ticMeta.data_type,
        })
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[ZarrOssStore] stats/tic not available.', (e as Error).message)
      }
    }

    if (import.meta.env.DEV) {
      console.table({
        bucket: this.access.bucket,
        region: this.access.region,
        folderPath: this.access.folder_path,
        dataMode: this._dataMode,
        rowAxis: this._rowAxis,
        spatialShape: this._spatialShape.join('×'),
        totalIntensityPoints: this.totalIntensityPoints.toLocaleString(),
        intensityDtype: this.intensityMeta.data_type,
        intensityChunkShape: this.intensityMeta.chunk_grid.configuration.chunk_shape.join(','),
        codecs: (this.intensityMeta.codecs ?? []).map((c) => c.name).join(',') || '(none)',
        hasMeanSpectrum: !!this.meanSpectrumMeta,
        hasTIC: !!this.ticMeta,
      })
    }
  }

  // ========== data loading: common ==========

  /** Load pixel coordinates. Shape (n_pixels, 3), dtype uint32, one-based. */
  async loadCoordinates(): Promise<Uint32Array> {
    if (this.coordinates) return this.coordinates
    if (!this.coordinatesMeta) throw new Error('[ZarrOssStore] call init() first')
    const ab = await this.fetchArrayFull('axes/coordinates', this.coordinatesMeta)
    this.coordinates = new Uint32Array(ab)
    return this.coordinates
  }

  /** Load shared m/z axis (continuous mode only). Returns null for processed mode. */
  async loadMzAxis(): Promise<Float64Array | null> {
    if (this._dataMode === 'processed') return null
    if (this.mzAxis) return this.mzAxis
    if (!this.axesMzMeta) throw new Error('[ZarrOssStore] axes/mz metadata not loaded')
    const ab = await this.fetchArrayFull('axes/mz', this.axesMzMeta)
    const dtype = this.axesMzMeta.data_type
    const typed = makeTypedArray(dtype, ab)
    this.mzAxis =
      typed instanceof Float64Array
        ? typed
        : new Float64Array(typed as ArrayLike<number>)
    return this.mzAxis
  }

  /** Load row offsets. Returns number[] (converted from int64). */
  async loadOffsets(): Promise<number[]> {
    if (this._offsets) return this._offsets
    if (!this.offsetsMeta) throw new Error('[ZarrOssStore] call init() first')
    const ab = await this.fetchArrayFull('data/offsets', this.offsetsMeta)
    const typed = new BigInt64Array(ab)
    this._offsets = Array.from(typed, (v) => Number(v))
    return this._offsets
  }

  // ========== data loading: continuous mode (ion image + mean spectrum) ==========

  /**
   * Get a single ion image by m/z axis index.
   *
   * For ion-major continuous:
   *   intensity[offsets[mzIdx] : offsets[mzIdx+1]] has n_pixels values.
   *   coordinates[j] maps the j-th value to pixel position (x, y).
   */
  async getIonImageByMzIndex(mzIndex: number): Promise<IonImageInfo> {
    if (this._dataMode !== 'continuous') {
      throw new Error('[ZarrOssStore] getIonImageByMzIndex only available in continuous mode')
    }

    const offsets = await this.loadOffsets()
    const mzAxis = await this.loadMzAxis()
    if (!mzAxis) throw new Error('[ZarrOssStore] m/z axis not available')

    if (mzIndex < 0 || mzIndex >= offsets.length - 1) {
      throw new Error(
        `[ZarrOssStore] mzIndex out of range: ${mzIndex} (total ${offsets.length - 1} ions)`,
      )
    }

    const [height, width] = this.spatialShape
    const start = offsets[mzIndex]!
    const end = offsets[mzIndex + 1]!
    const nPixels = end - start

    // Read the intensity slice for this ion
    const slice = await this.readIntensitySlice(start, end)

    // Map to 2D via coordinates
    const coords = await this.loadCoordinates()
    const matrix = new Float32Array(height * width)
    for (let j = 0; j < nPixels; j++) {
      const x = coords[j * 3]!
      const y = coords[j * 3 + 1]!
      // one-based → zero-based
      const col = x - this.coordinateBase
      const row = y - this.coordinateBase
      if (row >= 0 && row < height && col >= 0 && col < width) {
        matrix[row * width + col] = slice[j]!
      }
    }

    return {
      mzIndex,
      mz: mzAxis[mzIndex]!,
      matrix,
      width,
      height,
    }
  }

  /**
   * Load pre-computed mean spectrum from stats/mean_spectrum.
   * Returns null if not available.
   */
  async loadMeanSpectrum(): Promise<Float32Array | null> {
    if (this._dataMode !== 'continuous') return null
    if (this.meanSpectrum) return this.meanSpectrum
    if (!this.meanSpectrumMeta) {
      // Try to read it
      try {
        this.meanSpectrumMeta = await this.readArrayMeta('stats/mean_spectrum')
      } catch {
        return null
      }
    }
    const ab = await this.fetchArrayFull('stats/mean_spectrum', this.meanSpectrumMeta)
    const dtype = this.meanSpectrumMeta.data_type
    const typed = makeTypedArray(dtype, ab)
    this.meanSpectrum =
      typed instanceof Float32Array
        ? typed
        : new Float32Array(typed as ArrayLike<number>)
    return this.meanSpectrum
  }

  // ========== data loading: processed mode (TIC + per-pixel spectrum) ==========

  /**
   * Load pre-computed TIC from stats/tic and map to 2D image.
   *
   * This is the preferred fast path for new-format Zarr files that include
   * pre-computed TIC stats. Falls back to computeTICImage() if stats/tic
   * is not available.
   *
   * Returns null if stats/tic does not exist.
   */
  async loadTIC(): Promise<Float32Array | null> {
    if (this._dataMode !== 'processed') return null

    // Try to read metadata if not already loaded
    if (!this.ticMeta) {
      try {
        this.ticMeta = await this.readArrayMeta('stats/tic')
      } catch {
        return null
      }
    }

    // Read the full stats/tic array (single chunk, small)
    const ab = await this.fetchArrayFull('stats/tic', this.ticMeta)
    const dtype = this.ticMeta.data_type
    const typed = makeTypedArray(dtype, ab)
    this.ticData =
      typed instanceof Float64Array
        ? typed
        : new Float64Array(typed as ArrayLike<number>)

    // Map 1D TIC values to 2D image via coordinates
    const coords = await this.loadCoordinates()
    const [height, width] = this.spatialShape
    const nPixels = coords.length / 3

    if (this.ticData.length < nPixels) {
      console.warn('[ZarrOssStore] stats/tic length mismatch, falling back to computeTICImage')
      this.ticData = null
      this.ticMeta = null
      return null
    }

    const matrix = new Float32Array(height * width)
    for (let p = 0; p < nPixels; p++) {
      const x = coords[p * 3]!
      const y = coords[p * 3 + 1]!
      const col = x - this.coordinateBase
      const row = y - this.coordinateBase
      if (row >= 0 && row < height && col >= 0 && col < width) {
        matrix[row * width + col] = this.ticData[p]!
      }
    }

    return matrix
  }

  /** Whether stats/tic is available (fast path). */
  get hasTIC(): boolean {
    return !!this.ticMeta
  }

  /**
   * Compute the TIC (Total Ion Current) image for processed mode.
   *
   * For pixel-major processed:
   *   Each pixel p has intensity[offsets[p]:offsets[p+1]].
   *   TIC[p] = sum of those intensities.
   *   Mapped to 2D via coordinates[p].
   *
   * Loads chunks in parallel batches to reduce network round-trips.
   */
  async computeTICImage(): Promise<Float32Array> {
    if (this._dataMode !== 'processed') {
      throw new Error('[ZarrOssStore] computeTICImage only available in processed mode')
    }

    const offsets = await this.loadOffsets()
    const coords = await this.loadCoordinates()
    const [height, width] = this.spatialShape
    const nPixels = offsets.length - 1

    const cs = this.intensityMeta!.chunk_grid.configuration.chunk_shape[0]!
    const totalChunks = Math.ceil(this.totalIntensityPoints / cs)

    const BATCH_SIZE = 6 // browser concurrent connection limit per origin
    const ticByPixel = new Float32Array(nPixels)
    let cursor = 0 // current pixel index, advances monotonically

    for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks)
      const batch: Promise<Float32Array>[] = []
      for (let ci = batchStart; ci < batchEnd; ci++) {
        batch.push(this.getIntensityChunk(ci))
      }
      const chunks = await Promise.all(batch)

      for (let j = 0; j < chunks.length; j++) {
        const ci = batchStart + j
        const chunk = chunks[j]!
        const chunkStart = ci * cs

        for (let i = 0; i < chunk.length; i++) {
          const globalIdx = chunkStart + i
          if (globalIdx >= this.totalIntensityPoints) break
          // advance cursor to the pixel containing this globalIdx
          while (cursor < nPixels && offsets[cursor + 1]! <= globalIdx) {
            cursor++
          }
          if (cursor < nPixels) {
            ticByPixel[cursor]! += chunk[i]!
          }
        }
      }
    }

    // Map TIC values to 2D image
    const matrix = new Float32Array(height * width)
    for (let p = 0; p < nPixels; p++) {
      const x = coords[p * 3]!
      const y = coords[p * 3 + 1]!
      const col = x - this.coordinateBase
      const row = y - this.coordinateBase
      if (row >= 0 && row < height && col >= 0 && col < width) {
        matrix[row * width + col] = ticByPixel[p]!
      }
    }

    return matrix
  }

  /**
   * Get the spectrum for a single pixel in processed mode.
   *
   * For pixel-major processed:
   *   mz = data_mz[offsets[p]:offsets[p+1]]
   *   intensity = data_intensity[offsets[p]:offsets[p+1]]
   */
  async getPixelSpectrum(pixelIndex: number): Promise<PixelSpectrum | null> {
    if (this._dataMode !== 'processed') {
      throw new Error('[ZarrOssStore] getPixelSpectrum only available in processed mode')
    }

    const offsets = await this.loadOffsets()
    const coords = await this.loadCoordinates()
    const nPixels = offsets.length - 1

    if (pixelIndex < 0 || pixelIndex >= nPixels) {
      throw new Error(
        `[ZarrOssStore] pixelIndex out of range: ${pixelIndex} (total ${nPixels} pixels)`,
      )
    }

    const start = offsets[pixelIndex]!
    const end = offsets[pixelIndex + 1]!
    if (start === end) return null // empty spectrum

    // Read intensity and mz slices in parallel
    const [intensitySlice, mzSlice] = await Promise.all([
      this.readIntensitySlice(start, end),
      this.readMzSlice(start, end),
    ])

    const x = coords[pixelIndex * 3]!
    const y = coords[pixelIndex * 3 + 1]!

    return {
      pixelIndex,
      x,
      y,
      mz: mzSlice,
      intensity: intensitySlice,
    }
  }

  /** Find the pixel index closest to a 2D (col, row) position (zero-based). */
  async findPixelByPosition(
    col: number,
    row: number,
    tolerance: number = 1.5,
  ): Promise<number> {
    const coords = await this.loadCoordinates()
    const nPixels = coords.length / 3
    let bestIdx = -1
    let bestDist = Infinity

    for (let p = 0; p < nPixels; p++) {
      const cx = coords[p * 3]!
      const cy = coords[p * 3 + 1]!
      const px = cx - this.coordinateBase
      const py = cy - this.coordinateBase
      const dist = Math.sqrt((px - col) ** 2 + (py - row) ** 2)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = p
      }
    }

    return bestDist <= tolerance ? bestIdx : -1
  }

  // ========== backward-compat helpers ==========

  /**
   * Returns [nMz, height, width] for continuous mode.
   * Used by existing components that expect the old ion shape format.
   */
  getIonShape(): number[] | null {
    if (this._dataMode !== 'continuous') return null
    if (!this._spatialShape) return null
    const offsetsLen = this._offsets ? this._offsets.length - 1 : 0
    return [offsetsLen, this._spatialShape[0], this._spatialShape[1]]
  }

  getCacheInfo(): CacheInfo {
    return {
      intensityChunkCacheSize: this.intensityChunkCache.maxSize,
      intensityChunkCacheEntries: this.intensityChunkCache.size,
      mzChunkCacheSize: this.mzChunkCache.maxSize,
      mzChunkCacheEntries: this.mzChunkCache.size,
    }
  }

  // ========== internal: OSS key helpers ==========

  private key(relativePath: string): string {
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

  /** Read a zarr v3 array's zarr.json */
  private async readArrayMeta(arrayPath: string): Promise<ZarrV3ArrayMetadata> {
    const meta = await this.readJson<ZarrV3ArrayMetadata>(`${arrayPath}/zarr.json`)
    this.assertV3Array(meta, arrayPath)
    return meta
  }

  /** Read data group attributes. Tries .zattrs first, then falls back to zarr.json attributes. */
  private async readDataAttrs(): Promise<DataAttrs> {
    const meta = await this.readJson<ZarrV3GroupMetadata>('data/zarr.json')
    if (!meta.attributes?.row_axis || !meta.attributes?.encoding) {
      throw new Error(
        '[ZarrOssStore] data/zarr.json missing required attributes (row_axis, encoding)',
      )
    }
    return meta.attributes as unknown as DataAttrs
  }

  private validateRootAttrs(attrs: RootAttrs): void {
    if (attrs.format !== 'massflow.msi_zarr') {
      throw new Error(
        `[ZarrOssStore] unsupported format: ${attrs.format}, expected massflow.msi_zarr`,
      )
    }
    if (attrs.write_state !== 'complete') {
      throw new Error(
        `[ZarrOssStore] dataset write_state is "${attrs.write_state}", expected "complete"`,
      )
    }
    if (!attrs.spatial_shape || attrs.spatial_shape.length !== 2) {
      throw new Error(
        `[ZarrOssStore] invalid spatial_shape: ${JSON.stringify(attrs.spatial_shape)}`,
      )
    }
  }

  private assertV3Array(meta: ZarrV3ArrayMetadata, label: string): void {
    if (meta.zarr_format !== 3 || meta.node_type !== 'array') {
      throw new Error(`[ZarrOssStore] ${label}: not a v3 array`)
    }
    const unsupported = (meta.codecs ?? []).filter(
      (c) => !['bytes', 'gzip', 'zlib', 'deflate', 'zstd'].includes(c.name),
    )
    if (unsupported.length > 0) {
      throw new Error(
        `[ZarrOssStore] ${label}: unsupported codec: ${unsupported.map((c) => c.name).join(',')}`,
      )
    }
  }

  // ========== internal: chunk reading ==========

  /**
   * Read a slice [start, end) from the 1D intensity array.
   * Uses chunk caching and in-flight deduplication.
   */
  private async readIntensitySlice(start: number, end: number): Promise<Float32Array> {
    if (!this.intensityMeta) throw new Error('[ZarrOssStore] call init() first')
    return this.read1DSlice(
      'data/intensity',
      this.intensityMeta,
      start,
      end,
      this.intensityChunkCache,
      this.inFlightIntensity,
    ) as Promise<Float32Array>
  }

  /**
   * Read a slice [start, end) from the 1D data/mz array.
   */
  private async readMzSlice(start: number, end: number): Promise<Float64Array> {
    if (!this.dataMzMeta) throw new Error('[ZarrOssStore] data/mz not available')
    return this.read1DSlice(
      'data/mz',
      this.dataMzMeta,
      start,
      end,
      this.mzChunkCache,
      this.inFlightMz,
    ) as Promise<Float64Array>
  }

  /**
   * General-purpose 1D array slice reader with chunk caching.
   */
  private async read1DSlice(
    arrayPath: string,
    meta: ZarrV3ArrayMetadata,
    start: number,
    end: number,
    cache: LruCache<number, Float32Array | Float64Array>,
    inFlight: Map<number, Promise<Float32Array | Float64Array>>,
  ): Promise<Float32Array | Float64Array> {
    if (start >= end) {
      const Ctor = normalizeDtype(meta.data_type) === 'float64' ? Float64Array : Float32Array
      return new Ctor(0)
    }

    const cs = meta.chunk_grid.configuration.chunk_shape[0]!
    const startChunk = Math.floor(start / cs)
    const endChunk = Math.floor((end - 1) / cs)
    const bpe = bytesPerElement(meta.data_type)
    const isFloat64 = bpe === 8

    const result = isFloat64
      ? new Float64Array(end - start)
      : new Float32Array(end - start)
    let resultOffset = 0

    for (let ci = startChunk; ci <= endChunk; ci++) {
      const chunk = await this.getOrFetchChunk(arrayPath, meta, ci, cache, inFlight)
      const chunkStart = ci * cs

      const sliceStart = Math.max(start - chunkStart, 0)
      const sliceEnd = Math.min(end - chunkStart, chunk.length)
      const len = sliceEnd - sliceStart

      if (len > 0) {
        ;(result as Float32Array).set(chunk.subarray(sliceStart, sliceEnd), resultOffset)
        resultOffset += len
      }
    }

    return result
  }

  /**
   * Get a single decoded chunk, using cache + in-flight deduplication.
   */
  private async getOrFetchChunk(
    arrayPath: string,
    meta: ZarrV3ArrayMetadata,
    chunkIndex: number,
    cache: LruCache<number, Float32Array | Float64Array>,
    inFlight: Map<number, Promise<Float32Array | Float64Array>>,
  ): Promise<Float32Array | Float64Array> {
    // Check cache
    const cached = cache.get(chunkIndex)
    if (cached) return cached

    // Check in-flight
    const inflight = inFlight.get(chunkIndex)
    if (inflight) return inflight

    // Fetch
    const promise = this.fetchAndDecode1DChunk(arrayPath, meta, chunkIndex)
    inFlight.set(chunkIndex, promise)
    try {
      const chunk = await promise
      cache.set(chunkIndex, chunk)
      return chunk
    } finally {
      inFlight.delete(chunkIndex)
    }
  }

  /**
   * Fetch and decode a single chunk from a 1D zarr array.
   */
  private async fetchAndDecode1DChunk(
    arrayPath: string,
    meta: ZarrV3ArrayMetadata,
    chunkIndex: number,
  ): Promise<Float32Array | Float64Array> {
    const chunkKey = this.compute1DChunkKey(meta, chunkIndex)
    const relKey = `${arrayPath}/${chunkKey}`
    const key = this.key(relKey)
    const raw = await this.oss.getObjectArrayBuffer(key)

    return this.decode1DChunk(meta, chunkIndex, raw)
  }

  /**
   * Compute chunk key for a 1D array using zarr v3 default encoding.
   * For 1D: "c/0", "c/1", "c/2", ...
   */
  private compute1DChunkKey(meta: ZarrV3ArrayMetadata, chunkIndex: number): string {
    const enc = meta.chunk_key_encoding
    if (enc.name !== 'default') {
      throw new Error(
        `[ZarrOssStore] unsupported chunk key encoding: ${enc.name}`,
      )
    }
    const sep = enc.configuration?.separator ?? '/'
    return `c${sep}${chunkIndex}`
  }

  /**
   * Decode a single 1D chunk: decompress, create typed array, normalize to Float32/64.
   */
  private async decode1DChunk(
    meta: ZarrV3ArrayMetadata,
    chunkIndex: number,
    raw: ArrayBuffer,
  ): Promise<Float32Array | Float64Array> {
    const dtype = normalizeDtype(meta.data_type)
    const cs = meta.chunk_grid.configuration.chunk_shape[0]!
    const totalLen = meta.shape[0]!
    const bpe = bytesPerElement(meta.data_type)
    const isFloat64 = bpe === 8

    let payload: Uint8Array = new Uint8Array(raw)

    // Decompress
    const bytesCodec = (meta.codecs ?? []).find(
      (c) => ['gzip', 'zlib', 'deflate', 'zstd'].includes(c.name),
    )
    if (bytesCodec) {
      payload =
        bytesCodec.name === 'zstd'
          ? (await getZstdDecoder()).decode(payload)
          : await decompressBytes(payload, bytesCodec.name)
    }

    // Handle edge chunk (may be smaller than cs)
    const chunkStart = chunkIndex * cs
    const expectedElements = Math.min(cs, totalLen - chunkStart)
    const expectedBytes = expectedElements * bpe
    let actualBytes = payload.byteLength

    if (actualBytes !== expectedBytes) {
      // Truncate or handle mismatch gracefully
      const maxElements = Math.floor(actualBytes / bpe)
      if (maxElements <= 0) {
        throw new Error(
          `[ZarrOssStore] empty chunk at chunkIndex=${chunkIndex}`,
        )
      }
      actualBytes = maxElements * bpe
    }

    // Create typed array
    const ab = payload.buffer.slice(
      payload.byteOffset,
      payload.byteOffset + actualBytes,
    )
    const typed = makeTypedArray(meta.data_type, ab as ArrayBuffer)

    // Normalize to Float32Array or Float64Array
    if (isFloat64) {
      return typed instanceof Float64Array
        ? typed
        : new Float64Array(typed as ArrayLike<number>)
    }
    return typed instanceof Float32Array
      ? typed
      : new Float32Array(typed as ArrayLike<number>)
  }

  /**
   * Read a small array in full (for metadata arrays like offsets, coordinates, mz_axis).
   * Downloads all chunks and concatenates.
   */
  private async fetchArrayFull(
    arrayPath: string,
    meta: ZarrV3ArrayMetadata,
  ): Promise<ArrayBuffer> {
    const shape = meta.shape
    const total = shape.reduce((a, b) => a * b, 1)
    const bpe = bytesPerElement(meta.data_type)
    const out = new Uint8Array(total * bpe)

    const chunkShape = meta.chunk_grid.configuration.chunk_shape
    const ndim = shape.length

    // Generate all chunk indices
    const totalChunksPerDim: number[] = shape.map((s, i) =>
      Math.ceil(s / chunkShape[i]!),
    )

    const chunkIndices: number[][] = []
    const generateIndices = (dim: number, prefix: number[]) => {
      if (dim === ndim) {
        chunkIndices.push([...prefix])
        return
      }
      for (let i = 0; i < totalChunksPerDim[dim]!; i++) {
        prefix.push(i)
        generateIndices(dim + 1, prefix)
        prefix.pop()
      }
    }
    generateIndices(0, [])

    // Fetch and assemble each chunk
    for (const ci of chunkIndices) {
      const chunkKey = this.computeNDChunkKey(meta, ci)
      const chunkRelKey = `${arrayPath}/${chunkKey}`
      const raw = await this.oss.getObjectArrayBuffer(this.key(chunkRelKey))

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

      // Compute byte offset in output
      const chunkStart: number[] = ci.map((c, d) => c * chunkShape[d]!)
      const chunkSize: number[] = ci.map((c, d) =>
        Math.min(chunkShape[d]!, shape[d]! - c * chunkShape[d]!),
      )

      if (ndim === 1) {
        const byteOff = chunkStart[0]! * bpe
        out.set(payload.subarray(0, chunkSize[0]! * bpe), byteOff)
      } else if (ndim === 2) {
        // 源行跨步 = chunk 一行有几个元素（chunkShape[1]），不是 chunkShape[0]（行数）
        const srcRowElems = chunkShape[1]!
        const [h, w] = chunkSize
        const [dstStride] = shape.slice(1)
        for (let r = 0; r < h!; r++) {
          const srcOff = r * srcRowElems * bpe
          const dstOff =
            ((chunkStart[0]! + r) * dstStride! + chunkStart[1]!) * bpe
          out.set(payload.subarray(srcOff, srcOff + w! * bpe), dstOff)
        }
      } else {
        throw new Error(
          `[ZarrOssStore] fetchArrayFull only supports 1D/2D, got ndim=${ndim}`,
        )
      }
    }

    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)
  }

  /** Compute chunk key for N-D arrays */
  private computeNDChunkKey(
    meta: ZarrV3ArrayMetadata,
    chunkIndices: number[],
  ): string {
    const enc = meta.chunk_key_encoding
    if (enc.name !== 'default') {
      throw new Error(
        `[ZarrOssStore] unsupported chunk key encoding: ${enc.name}`,
      )
    }
    const sep = enc.configuration?.separator ?? '/'
    return `c${sep}${chunkIndices.join(sep)}`
  }

  /**
   * Get a single intensity chunk (public for cache inspection).
   */
  private async getIntensityChunk(chunkIndex: number): Promise<Float32Array> {
    if (!this.intensityMeta) throw new Error('[ZarrOssStore] call init() first')
    return (await this.getOrFetchChunk(
      'data/intensity',
      this.intensityMeta,
      chunkIndex,
      this.intensityChunkCache,
      this.inFlightIntensity,
    )) as Float32Array
  }
}
