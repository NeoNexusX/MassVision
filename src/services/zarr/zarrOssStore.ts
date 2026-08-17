/**
 * On-demand reader for MassFlow MSI Zarr v1.0 data stored in Alibaba Cloud OSS.
 *
 * New format (v1.0) supports two data layouts:
 *   - ion-major continuous → ion image + mean spectrum (existing feature)
 *   - pixel-major processed → TIC image + per-pixel spectrum (new feature)
 *
 * v1.1 keeps the same semantics but splits the single data/ group into
 * ion_image/ (ion-major, continuous) and/or spectra/ (pixel-major); the
 * reader picks the first group carrying row_axis + encoding attributes.
 *
 * Layout:
 *   <root>/.zattrs              — root attributes (format, spatial_shape, etc.)
 *   <root>/metadata/.zattrs     — semantic metadata
 *   <root>/axes/coordinates     — (n_pixels, 3) uint32, pixel coordinates
 *   <root>/axes/mz              — shared m/z axis (continuous only)
 *   <root>/data/.zattrs         — row_axis + encoding   (v1.0)
 *   <root>/ion_image/.zattrs    — row_axis + encoding   (v1.1, continuous)
 *   <root>/spectra/.zattrs      — row_axis + encoding   (v1.1, pixel-major)
 *   <root>/<data>/intensity/    — 1D float32, flattened intensity values
 *   <root>/<data>/offsets/      — (n_rows+1,) int64, row boundary indices
 *   <root>/<data>/mz/           — per-point m/z (processed only)
 *   <root>/stats/mean_spectrum/ — optional, pre-computed mean spectrum
 *   <root>/stats/tic/           — optional, pre-computed TIC (both modes)
 *
 * The byte source is OSS via STS (ZarrAccessResponse from
 * GET /processes/{run_id}/zarr).
 *
 * Chunk caching: intensity chunks use LRU cache (default 20 chunks).
 * In-flight request deduplication prevents redundant OSS requests for
 * the same chunk.
 *
 * Supported codecs: gzip / zlib / deflate (native DecompressionStream),
 * zstd (via zstddec).
 */

import { LruCache } from '@/shared/utils/lruCache'
import { createOssClient, OssError } from './ossClient'
import type { OssClient } from './ossClient'
import type {
  ZarrAccessResponse,
  DataMode,
  RootAttrs,
  DataAttrs,
  MetadataAttrs,
  PixelSpectrum,
} from './types/zarr'
import type { ZarrV3ArrayMetadata, ZarrV3GroupMetadata } from './types/zarrV3'
import { assertV3Array, computeNDChunkKey } from './zarrMetadata'
import { decodePayload } from './zarrDecode'
import { normalizeDtype, bytesPerElement, makeTypedArray } from './zarrDtype'
import { readFullArray } from './zarrReader'

// ---------- main store ----------

/**
 * Fail fast on metadata we cannot decode: shape must be a non-empty list of
 * positive integers, chunk_shape must match its rank, and data_type must be
 * in the makeTypedArray whitelist (bytesPerElement throws otherwise). Without
 * this, a typo'd dtype surfaced far later as an empty typed array and a
 * transparent image with no error.
 */
function assertSupportedDtype(meta: ZarrV3ArrayMetadata, label: string): void {
  const shape = meta.shape
  const chunkShape = meta.chunk_grid?.configuration?.chunk_shape
  if (!Array.isArray(shape) || !shape.length || shape.some((s) => !Number.isInteger(s) || s < 0)) {
    throw new Error(`[ZarrOssStore] ${label}: invalid shape ${JSON.stringify(shape)}`)
  }
  if (!Array.isArray(chunkShape) || chunkShape.length !== shape.length) {
    throw new Error(
      `[ZarrOssStore] ${label}: chunk_shape rank mismatch (shape ${shape.length}D vs chunk_shape ${JSON.stringify(chunkShape)})`,
    )
  }
  bytesPerElement(meta.data_type) // throws on an unknown dtype
}

export class ZarrOssStore {
  private oss: OssClient
  private folderPath: string
  private sourceLabel: string
  /** Data group root: 'data' (v1.0) or 'ion_image' / 'spectra' (v1.1). */
  private dataPath = 'data'
  private _disposed = false

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
  // spectra 组（v1.1 双组布局的像素主序侧；v1.0 探测不到，保持 null）
  private spectraIntensityMeta: ZarrV3ArrayMetadata | null = null
  private spectraOffsetsMeta: ZarrV3ArrayMetadata | null = null

  // Fully loaded small arrays (cached after first load)
  private coordinates: Uint32Array | null = null
  private coordinatesPending: Promise<Uint32Array> | null = null
  private mzAxis: Float64Array | null = null
  private _offsets: number[] | null = null // converted from int64
  private offsetsPending: Promise<number[]> | null = null
  private meanSpectrum: Float32Array | null = null
  private ticData: Float64Array | null = null
  private _spectraOffsets: number[] | null = null // converted from int64
  private spectraOffsetsPending: Promise<number[]> | null = null

  // Metadata attrs
  private _metadataAttrs: MetadataAttrs | null = null

  // Chunk caches for large 1D arrays
  private intensityChunkCache: LruCache<number, Float32Array>
  private mzChunkCache: LruCache<number, Float64Array>
  // spectra 的 chunk 缓存必须独立——它的 chunk 边界与 ion_image 不同，
  // 共用会污染（同一 chunkIndex 指向完全不同的数据）。
  private spectraChunkCache: LruCache<number, Float32Array>
  private inFlightIntensity = new Map<number, Promise<Float32Array>>()
  private inFlightMz = new Map<number, Promise<Float64Array>>()
  private inFlightSpectra = new Map<number, Promise<Float32Array>>()
  /** spectra 并发下载窗口（同时在下载/解码的 chunk 上限），config.json 的 zarr.spectraConcurrency */
  private spectraConcurrency: number

  // Derived
  private totalIntensityPoints: number = 0
  private totalMzPoints: number = 0

  constructor(
    source: ZarrAccessResponse,
    options: {
      intensityChunkCacheSize?: number
      mzChunkCacheSize?: number
      spectraChunkCacheSize?: number
      spectraConcurrency?: number
      /** Re-fetch STS credentials when they expire (see ossClient). */
      refreshAccess?: () => Promise<ZarrAccessResponse>
    } = {},
  ) {
    this.oss = createOssClient(source, { refresh: options.refreshAccess })
    this.folderPath = source.folder_path
    this.sourceLabel = `${source.bucket} (${source.region})`
    this.intensityChunkCache = new LruCache<number, Float32Array>(
      options.intensityChunkCacheSize ?? 20,
    )
    this.mzChunkCache = new LruCache<number, Float64Array>(options.mzChunkCacheSize ?? 5)
    // spectra 缓存独立（chunk 边界与 ion_image 不同），1 chunk ≈ 1MB；
    // 100 个 ≈ 100MB 内存上限。两项均可经 config.json 的 zarr 块配置。
    this.spectraChunkCache = new LruCache<number, Float32Array>(
      options.spectraChunkCacheSize ?? 100,
    )
    this.spectraConcurrency = Math.max(1, Math.floor(options.spectraConcurrency ?? 16))
  }

  /**
   * Release all cached data and mark the store as disposed.
   * After calling this, the store should not be used again.
   */
  dispose(): void {
    this._disposed = true
    this.intensityChunkCache.clear()
    this.mzChunkCache.clear()
    this.spectraChunkCache.clear()
    this.inFlightIntensity.clear()
    this.inFlightMz.clear()
    this.inFlightSpectra.clear()
    this.coordinates = null
    this.coordinatesPending = null
    this.mzAxis = null
    this._offsets = null
    this.offsetsPending = null
    this._spectraOffsets = null
    this.spectraOffsetsPending = null
    this.meanSpectrum = null
    this.ticData = null
    this._metadataAttrs = null
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

    // 3) 拿到 dataMode 后，下面这些 zarr.json 互不依赖，全部并发拉取，
    //    把冷启动从 ~8 次串行 RTT 压到 ~1 次（连接复用后）。
    //    保持原语义：processed 缺 data/mz、continuous 缺 axes/mz 属致命错误；
    //    metadata / stats 为非致命，缺失只记日志不抛。
    const [
      intensityMeta,
      offsetsMeta,
      coordinatesMeta,
      metadataResult,
      meanSpectrumResult,
      modeArrayResult,
      statsResult,
    ] = await Promise.all([
      // 必备：data 子数组（失败以 Error 形式冒泡到下方统一抛出）
      this.readArrayMeta(this.intensityPath).then((m) => m, (e) => e as Error),
      this.readArrayMeta(this.offsetsPath).then((m) => m, (e) => e as Error),
      this.readArrayMeta('axes/coordinates').then((m) => m, (e) => e as Error),

      // 非致命：metadata 组
      this.readJson<ZarrV3GroupMetadata>('metadata/zarr.json').then(
        (m) => m,
        () => null as ZarrV3GroupMetadata | null,
      ),

      // 非致命：stats/mean_spectrum
      this.readArrayMeta('stats/mean_spectrum').then(
        (m) => m,
        () => null as ZarrV3ArrayMetadata | null,
      ),

      // 模式相关（二选一）：processed-><data>/mz，continuous->axes/mz
      // 只有一个会真正发起请求；缺失属致命错误，下方统一抛。
      (this._dataMode === 'processed'
        ? this.readArrayMeta(this.dataMzPath)
        : this.readArrayMeta('axes/mz')
      ).then(
        (m) => m,
        (e) => e as Error,
      ),

      // 非致命：stats/tic（两种模式均可选；continuous 下作为 TIC 归一化快路径）
      this.readArrayMeta('stats/tic').then(
        (m) => m,
        () => null as ZarrV3ArrayMetadata | null,
      ),
    ])

    // 必备数组：失败必须抛错（与原逻辑一致）
    if (intensityMeta instanceof Error) throw intensityMeta
    if (offsetsMeta instanceof Error) throw offsetsMeta
    if (coordinatesMeta instanceof Error) throw coordinatesMeta
    this.intensityMeta = intensityMeta
    this.offsetsMeta = offsetsMeta
    this.coordinatesMeta = coordinatesMeta
    this.totalIntensityPoints = this.intensityMeta.shape[0]!

    // 模式相关数组：缺失属致命错误（与原逻辑一致）
    if (this._dataMode === 'processed') {
      if (modeArrayResult instanceof Error || modeArrayResult === null) {
        throw new Error(`[ZarrOssStore] processed mode requires ${this.dataMzPath} array`)
      }
      this.dataMzMeta = modeArrayResult
      this.totalMzPoints = this.dataMzMeta.shape[0]!
    } else {
      if (modeArrayResult instanceof Error || modeArrayResult === null) {
        throw new Error('[ZarrOssStore] continuous mode requires axes/mz array')
      }
      this.axesMzMeta = modeArrayResult
    }

    // metadata 组（非致命）
    if (metadataResult && metadataResult.attributes) {
      this._metadataAttrs = metadataResult.attributes as unknown as MetadataAttrs
    }

    // stats/mean_spectrum（非致命）
    if (meanSpectrumResult) {
      this.meanSpectrumMeta = meanSpectrumResult
      if (import.meta.env.DEV) {
        console.log('[ZarrOssStore] mean_spectrum found', {
          shape: this.meanSpectrumMeta.shape.join('×'),
          dtype: this.meanSpectrumMeta.data_type,
        })
      }
    } else if (import.meta.env.DEV) {
      console.warn(
        '[ZarrOssStore] mean_spectrum not available - this Zarr file has no pre-computed stats.',
      )
    }

    // stats/tic（非致命）
    if (statsResult && !(statsResult instanceof Error)) {
      this.ticMeta = statsResult
      if (import.meta.env.DEV) {
        console.log('[ZarrOssStore] stats/tic found', {
          shape: this.ticMeta!.shape.join('×'),
          dtype: this.ticMeta!.data_type,
        })
      }
    } else if (import.meta.env.DEV) {
      console.warn('[ZarrOssStore] stats/tic not available.')
    }

    // spectra 组（v1.1 双组布局的像素主序侧，非致命）
    // 与 readDataAttrs 的 dataPath 探测独立——dataPath 选了 ion_image/ 或
    // data/，spectra 是另外那组，必须单独读。v1.0 单组布局没有它，只记日志。
    await this.probeSpectraGroup()

    if (import.meta.env.DEV) {
      console.table({
        source: this.sourceLabel,
        folderPath: this.folderPath || '(root)',
        dataGroup: this.dataPath,
        dataMode: this._dataMode,
        rowAxis: this._rowAxis,
        spatialShape: this._spatialShape.join('×'),
        totalIntensityPoints: this.totalIntensityPoints.toLocaleString(),
        intensityDtype: this.intensityMeta.data_type,
        intensityChunkShape: this.intensityMeta.chunk_grid.configuration.chunk_shape.join(','),
        codecs: (this.intensityMeta.codecs ?? []).map((c) => c.name).join(',') || '(none)',
        hasMeanSpectrum: !!this.meanSpectrumMeta,
        hasTIC: !!this.ticMeta,
        hasSpectra: this.hasSpectra,
      })
    }
  }

  /**
   * 非致命探测 spectra 组（v1.1 双组布局）。
   * 与 dataPath 探测独立：主组可能是 ion_image/（continuous）或 spectra/
   * （processed），这里找的是像素主序 + continuous 编码的那组，供区域比较
   * 按谱取。探测失败（v1.0 无此组 / 属性不符）只记日志、两个字段置空。
   */
  private async probeSpectraGroup(): Promise<void> {
    try {
      const meta = await this.readJson<ZarrV3GroupMetadata>('spectra/zarr.json')
      const attrs = meta.attributes
      if (attrs?.row_axis !== 'pixel' || attrs?.encoding !== 'continuous') {
        if (import.meta.env.DEV) {
          console.log(
            `[ZarrOssStore] spectra group has unexpected attrs (${attrs?.row_axis}/${attrs?.encoding}), ignoring`,
          )
        }
        return
      }
      const [intensityMeta, offsetsMeta] = await Promise.all([
        this.readArrayMeta('spectra/intensity'),
        this.readArrayMeta('spectra/offsets'),
      ])
      this.spectraIntensityMeta = intensityMeta
      this.spectraOffsetsMeta = offsetsMeta
      if (import.meta.env.DEV) {
        console.log('[ZarrOssStore] spectra group found (pixel-major), region comparison uses per-spectrum reads')
      }
    } catch {
      this.spectraIntensityMeta = null
      this.spectraOffsetsMeta = null
      if (import.meta.env.DEV) {
        console.log('[ZarrOssStore] spectra group not available.')
      }
    }
  }

  // ========== data loading: common ==========

  /** Load pixel coordinates. Shape (n_pixels, 3), dtype uint32, one-based. */
  async loadCoordinates(): Promise<Uint32Array> {
    if (this.coordinates) return this.coordinates
    if (this.coordinatesPending) return this.coordinatesPending
    if (!this.coordinatesMeta) throw new Error('[ZarrOssStore] call init() first')

    const pending = this.fetchArrayFull('axes/coordinates', this.coordinatesMeta).then((ab) => {
      const coordinates = new Uint32Array(ab)
      // A disposed store must not retain a large array after its request finishes.
      if (!this._disposed) this.coordinates = coordinates
      return coordinates
    })
    this.coordinatesPending = pending

    try {
      return await pending
    } finally {
      // Clear rejected requests so a later call can retry. Do not clear a newer
      // request if dispose/reinitialization changed the pending reference.
      if (this.coordinatesPending === pending) this.coordinatesPending = null
    }
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
      typed instanceof Float64Array ? typed : new Float64Array(typed as ArrayLike<number>)
    return this.mzAxis
  }

  /** Load row offsets. Returns number[] (converted from int64). */
  async loadOffsets(): Promise<number[]> {
    if (this._offsets) return this._offsets
    if (this.offsetsPending) return this.offsetsPending
    if (!this.offsetsMeta) throw new Error('[ZarrOssStore] call init() first')

    const pending = this.fetchArrayFull(this.offsetsPath, this.offsetsMeta).then((ab) => {
      const offsets = Array.from(new BigInt64Array(ab), (v) => Number(v))
      if (!this._disposed) this._offsets = offsets
      return offsets
    })
    this.offsetsPending = pending

    try {
      return await pending
    } finally {
      if (this.offsetsPending === pending) this.offsetsPending = null
    }
  }

  /** Whether the pixel-major spectra group is available (v1.1 dual-group layout). */
  get hasSpectra(): boolean {
    return !!this.spectraIntensityMeta && !!this.spectraOffsetsMeta
  }

  /** Load spectra offsets (n_pixels+1 rows). v1.0 (no spectra group) returns null. */
  async loadSpectraOffsets(): Promise<number[] | null> {
    if (this._spectraOffsets) return this._spectraOffsets
    if (this.spectraOffsetsPending) return this.spectraOffsetsPending
    if (!this.spectraOffsetsMeta) return null

    const pending = this.fetchArrayFull('spectra/offsets', this.spectraOffsetsMeta).then((ab) => {
      const offsets = Array.from(new BigInt64Array(ab), (v) => Number(v))
      if (!this._disposed) this._spectraOffsets = offsets
      return offsets
    })
    this.spectraOffsetsPending = pending

    try {
      return await pending
    } finally {
      if (this.spectraOffsetsPending === pending) this.spectraOffsetsPending = null
    }
  }

  /**
   * Map a flat per-pixel value array to a 2D row-major matrix via
   * axes/coordinates (one-based → zero-based, out-of-bounds pixels skipped).
   * Shared by ion-image, stats/tic, and computed-TIC paths.
   */
  private mapPixelsToMatrix(
    values: ArrayLike<number>,
    nPixels: number,
    coords: Uint32Array,
  ): Float32Array {
    const [height, width] = this.spatialShape
    const matrix = new Float32Array(height * width)
    for (let j = 0; j < nPixels; j++) {
      const x = coords[j * 3]!
      const y = coords[j * 3 + 1]!
      // one-based → zero-based
      const col = x - this.coordinateBase
      const row = y - this.coordinateBase
      if (row >= 0 && row < height && col >= 0 && col < width) {
        matrix[row * width + col] = values[j]!
      }
    }
    return matrix
  }

  // ========== data loading: continuous mode (ion image + mean spectrum) ==========

  /**
   * Sum ion slices in their shared 1D coordinate order, then map the combined
   * values to a 2D matrix once. A failed or malformed slice is skipped; the
   * method throws only when no requested slice can be loaded.
   */
  async getSummedIonImageByMzIndices(mzIndices: number[]): Promise<Float32Array> {
    if (this._dataMode !== 'continuous') {
      throw new Error(
        '[ZarrOssStore] getSummedIonImageByMzIndices only available in continuous mode',
      )
    }
    if (!mzIndices.length) throw new Error('[ZarrOssStore] no m/z indices were selected')

    const [offsets, coords] = await Promise.all([this.loadOffsets(), this.loadCoordinates()])
    const nPixels = coords.length / 3

    for (const mzIndex of mzIndices) {
      if (mzIndex < 0 || mzIndex >= offsets.length - 1) {
        throw new Error(
          `[ZarrOssStore] mzIndex out of range: ${mzIndex} (total ${offsets.length - 1} ions)`,
        )
      }
    }

    const failures: Error[] = []
    const slices = await Promise.all(
      mzIndices.map(async (mzIndex) => {
        try {
          const start = offsets[mzIndex]!
          const end = offsets[mzIndex + 1]!
          if (end - start !== nPixels) {
            throw new Error(
              `ion slice length mismatch for mzIndex=${mzIndex}: expected ${nPixels}, got ${end - start}`,
            )
          }
          return await this.readIntensitySlice(start, end)
        } catch (e) {
          const failure = e instanceof Error ? e : new Error(String(e))
          failures.push(failure)
          console.warn(`[ZarrOssStore] skip mzIndex=${mzIndex}:`, failure.message)
          return null
        }
      }),
    )

    const sum = new Float32Array(nPixels)
    let successfulSlices = 0
    for (const slice of slices) {
      if (!slice) continue
      successfulSlices++
      for (let i = 0; i < nPixels; i++) sum[i]! += slice[i]!
    }

    if (!successfulSlices) {
      const detail = failures[0]?.message ?? 'unknown ion-slice error'
      throw new Error(`Failed to load ion image data: ${detail}`)
    }

    return this.mapPixelsToMatrix(sum, nPixels, coords)
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
      } catch (e) {
        if (e instanceof OssError && e.code === 'not_found') return null
        throw e
      }
    }
    const ab = await this.fetchArrayFull('stats/mean_spectrum', this.meanSpectrumMeta)
    const dtype = this.meanSpectrumMeta.data_type
    const typed = makeTypedArray(dtype, ab)
    this.meanSpectrum =
      typed instanceof Float32Array ? typed : new Float32Array(typed as ArrayLike<number>)
    return this.meanSpectrum
  }

  // ========== data loading: processed mode (TIC + per-pixel spectrum) ==========

  /**
   * Load pre-computed TIC from stats/tic and map to 2D image.
   *
   * Fast path for Zarr files that ship a pre-computed TIC matrix (both data
   * modes): processed mode uses it for the TIC image, continuous mode for
   * TIC normalization. Returns null if stats/tic does not exist.
   */
  async loadTIC(): Promise<Float32Array | null> {
    // Try to read metadata if not already loaded
    if (!this.ticMeta) {
      try {
        this.ticMeta = await this.readArrayMeta('stats/tic')
      } catch (e) {
        // A malformed array (bad dtype/shape) is a loud error — only a missing
        // stats/tic falls back to computing the TIC from intensity chunks.
        if (e instanceof OssError && e.code === 'not_found') return null
        throw e
      }
    }

    // Read the full stats/tic array (single chunk, small)
    const ab = await this.fetchArrayFull('stats/tic', this.ticMeta)
    const dtype = this.ticMeta.data_type
    const typed = makeTypedArray(dtype, ab)
    this.ticData =
      typed instanceof Float64Array ? typed : new Float64Array(typed as ArrayLike<number>)

    // Map 1D TIC values to 2D image via coordinates
    const coords = await this.loadCoordinates()
    const nPixels = coords.length / 3

    if (this.ticData.length < nPixels) {
      console.warn('[ZarrOssStore] stats/tic length mismatch, falling back to computeTICImage')
      this.ticData = null
      this.ticMeta = null
      return null
    }

    return this.mapPixelsToMatrix(this.ticData, nPixels, coords)
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
    if (this._disposed) return new Float32Array(0)

    const coords = await this.loadCoordinates()
    if (this._disposed) return new Float32Array(0)

    const nPixels = offsets.length - 1

    const cs = this.intensityMeta!.chunk_grid.configuration.chunk_shape[0]!
    const totalChunks = Math.ceil(this.totalIntensityPoints / cs)

    const BATCH_SIZE = 6 // browser concurrent connection limit per origin
    const ticByPixel = new Float32Array(nPixels)
    let cursor = 0 // current pixel index, advances monotonically

    for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
      if (this._disposed) return new Float32Array(0)

      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks)
      // Fetch chunks directly (bypass the LRU cache): each chunk is read once
      // in this scan, so caching it would only evict other chunks. Mirrors
      // streamIonStats.
      const batch: Promise<Float32Array | Float64Array>[] = []
      for (let ci = batchStart; ci < batchEnd; ci++) {
        batch.push(this.fetchAndDecode1DChunk(this.intensityPath, this.intensityMeta!, ci))
      }
      const chunks = await Promise.all(batch)
      if (this._disposed) return new Float32Array(0)

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
    return this.mapPixelsToMatrix(ticByPixel, nPixels, coords)
  }

  /**
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
  async findPixelByPosition(col: number, row: number, tolerance: number = 1.5): Promise<number> {
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

  // ========== internal: OSS key helpers ==========

  private get intensityPath(): string {
    return `${this.dataPath}/intensity`
  }

  private get offsetsPath(): string {
    return `${this.dataPath}/offsets`
  }

  private get dataMzPath(): string {
    return `${this.dataPath}/mz`
  }

  private key(relativePath: string): string {
    const root = this.folderPath
    const rel = relativePath.replace(/^\/+/, '')
    if (!root) return rel
    return root.endsWith('/') ? `${root}${rel}` : `${root}/${rel}`
  }

  private async readJson<T>(relativePath: string): Promise<T> {
    const key = this.key(relativePath)
    const ab = await this.oss.getObjectArrayBuffer(key)
    const text = new TextDecoder('utf-8').decode(new Uint8Array(ab))
    try {
      return JSON.parse(text) as T
    } catch (e) {
      throw new Error(`[ZarrOssStore] failed to parse JSON at ${key}: ${(e as Error).message}`)
    }
  }

  /** Read a zarr v3 array's zarr.json */
  private async readArrayMeta(arrayPath: string): Promise<ZarrV3ArrayMetadata> {
    const meta = await this.readJson<ZarrV3ArrayMetadata>(`${arrayPath}/zarr.json`)
    assertV3Array(meta, arrayPath)
    assertSupportedDtype(meta, arrayPath)
    return meta
  }

  /**
   * Read the data group attributes and set {@link dataPath}.
   *
   * v1.0 stores a single data group at data/. v1.1 splits it into
   * ion_image/ (ion-major → continuous) and/or spectra/ (pixel-major).
   * The first candidate group whose zarr.json carries row_axis + encoding
   * wins; a candidate that is simply absent (not_found) falls through, while
   * a group that exists but lacks the attributes is a hard error (same as
   * the original data/-only behavior).
   */
  private async readDataAttrs(): Promise<DataAttrs> {
    const candidates = ['data', 'ion_image', 'spectra']
    for (const path of candidates) {
      let meta: ZarrV3GroupMetadata
      try {
        meta = await this.readJson<ZarrV3GroupMetadata>(`${path}/zarr.json`)
      } catch (e) {
        if (e instanceof OssError && e.code === 'not_found') continue
        throw e
      }
      if (meta.attributes?.row_axis && meta.attributes?.encoding) {
        // Validate enum values — a writer bug (e.g. encoding: "raw") used to
        // slip through the truthiness check and make every
        // `_dataMode === 'continuous'/'processed'` test silently false,
        // leaving a blank result page with no error.
        const { row_axis, encoding } = meta.attributes
        if (row_axis !== 'pixel' && row_axis !== 'ion') {
          throw new Error(
            `[ZarrOssStore] ${path}/zarr.json invalid row_axis: ${JSON.stringify(row_axis)} (expected "pixel" | "ion")`,
          )
        }
        if (encoding !== 'continuous' && encoding !== 'processed') {
          throw new Error(
            `[ZarrOssStore] ${path}/zarr.json invalid encoding: ${JSON.stringify(encoding)} (expected "continuous" | "processed")`,
          )
        }
        this.dataPath = path
        return { row_axis, encoding }
      }
      throw new Error(
        `[ZarrOssStore] ${path}/zarr.json missing required attributes (row_axis, encoding)`,
      )
    }
    throw new Error(
      '[ZarrOssStore] no data group found (tried data/, ion_image/, spectra/)',
    )
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

  // ========== internal: chunk reading ==========

  /**
   * Read a slice [start, end) from the 1D intensity array.
   * Uses chunk caching and in-flight deduplication.
   */
  private async readIntensitySlice(start: number, end: number): Promise<Float32Array> {
    if (!this.intensityMeta) throw new Error('[ZarrOssStore] call init() first')
    return this.read1DSlice(
      this.intensityPath,
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
    if (!this.dataMzMeta) throw new Error(`[ZarrOssStore] ${this.dataMzPath} not available`)
    return this.read1DSlice(
      this.dataMzPath,
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

    const result = isFloat64 ? new Float64Array(end - start) : new Float32Array(end - start)

    // Fetch chunks in parallel batches (browser concurrent connection limit
    // per origin, mirroring computeTICImage), then assemble in chunk order.
    // Cache + in-flight dedup in getOrFetchChunk keep concurrent fetches safe.
    const BATCH_SIZE = 6
    const chunkCount = endChunk - startChunk + 1
    const chunks: (Float32Array | Float64Array)[] = new Array(chunkCount)

    for (let batchStart = 0; batchStart < chunkCount; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunkCount)
      const batch: Promise<Float32Array | Float64Array>[] = []
      for (let k = batchStart; k < batchEnd; k++) {
        batch.push(this.getOrFetchChunk(arrayPath, meta, startChunk + k, cache, inFlight))
      }
      const fetched = await Promise.all(batch)
      for (let j = 0; j < fetched.length; j++) {
        chunks[batchStart + j] = fetched[j]!
      }
    }

    // Copy into result in index order — identical to sequential assembly
    let resultOffset = 0
    for (let k = 0; k < chunkCount; k++) {
      const chunk = chunks[k]!
      const chunkStart = (startChunk + k) * cs

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
   * Equivalent to the N-D key with a single index — delegated to keep
   * the encoding/separator handling in one place.
   */
  private compute1DChunkKey(meta: ZarrV3ArrayMetadata, chunkIndex: number): string {
    return computeNDChunkKey(meta, [chunkIndex])
  }

  /**
   * Decode a single 1D chunk: decompress, create typed array, normalize to Float32/64.
   */
  private async decode1DChunk(
    meta: ZarrV3ArrayMetadata,
    chunkIndex: number,
    raw: ArrayBuffer,
  ): Promise<Float32Array | Float64Array> {
    const cs = meta.chunk_grid.configuration.chunk_shape[0]!
    const totalLen = meta.shape[0]!
    const bpe = bytesPerElement(meta.data_type)
    const isFloat64 = bpe === 8

    const payload = await decodePayload(meta, raw)

    // Handle edge chunk: it may be smaller than cs (unpadded) or padded to
    // the full chunk_shape by the writer (trailing fill beyond the array's
    // valid length). Only a chunk that is too small is genuinely corrupt; a
    // padded edge chunk is valid data + trailing fill and is truncated here,
    // the same way readFullArray ignores trailing padding.
    const chunkStart = chunkIndex * cs
    const expectedElements = Math.min(cs, totalLen - chunkStart)
    const expectedBytes = expectedElements * bpe
    const actualBytes = payload.byteLength

    if (actualBytes < expectedBytes) {
      throw new Error(
        `[ZarrOssStore] corrupt chunk at chunkIndex=${chunkIndex}: expected ${expectedBytes} bytes, got ${actualBytes}`,
      )
    }

    // Create typed array (truncated to the valid length when the chunk was padded)
    const ab = payload.buffer.slice(payload.byteOffset, payload.byteOffset + expectedBytes)
    const typed = makeTypedArray(meta.data_type, ab as ArrayBuffer)

    // Normalize to Float32Array or Float64Array
    if (isFloat64) {
      return typed instanceof Float64Array ? typed : new Float64Array(typed as ArrayLike<number>)
    }
    return typed instanceof Float32Array ? typed : new Float32Array(typed as ArrayLike<number>)
  }

  /**
   * Read a small array in full (for metadata arrays like offsets, coordinates, mz_axis).
   * Downloads all chunks and concatenates (shared zarrCodecs assembler).
   */
  private async fetchArrayFull(arrayPath: string, meta: ZarrV3ArrayMetadata): Promise<ArrayBuffer> {
    const out = await readFullArray(meta, arrayPath, async (coords) => {
      const chunkKey = computeNDChunkKey(meta, coords)
      const raw = await this.oss.getObjectArrayBuffer(this.key(`${arrayPath}/${chunkKey}`))
      return decodePayload(meta, raw)
    })
    // readFullArray allocates with `new Uint8Array(totalBytes)`, so the
    // underlying buffer is always a plain ArrayBuffer (never SharedArrayBuffer).
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
  }

  // ========== region comparison ==========

  /**
   * Build a 1D pixel-index mask from a 2D raster mask.
   *
   * The intensity array stores each ion's pixel values in the order of
   * axes/coordinates (j-th value ↔ coordinates[j]). A 2D raster mask
   * (indexed by [row * width + col]) must be converted to this 1D
   * coordinates order so the streaming scan can look up mask[j] in O(1).
   */
  async buildPixelMask(raster: Uint8Array): Promise<{ mask: Uint8Array; pixelCount: number }> {
    const coords = await this.loadCoordinates()
    const [height, width] = this.spatialShape
    const nPixels = coords.length / 3
    const mask = new Uint8Array(nPixels)
    let count = 0
    for (let j = 0; j < nPixels; j++) {
      const col = coords[j * 3]! - this.coordinateBase
      const row = coords[j * 3 + 1]! - this.coordinateBase
      if (row < 0 || row >= height || col < 0 || col >= width) continue
      if (raster[row * width + col]!) {
        mask[j] = 1
        count++
      }
    }
    return { mask, pixelCount: count }
  }

  /**
   * Stream through ALL intensity chunks and accumulate per-ion statistics
   * (sum, count of non-zero pixels) for one or more pixel masks.
   *
   * For each non-zero intensity value at global index g:
   *   ion   = the i where offsets[i] <= g < offsets[i+1]  (monotonic cursor)
   *   pixel = g - offsets[ion]  (pixel index j, same j as in the mask)
   *   For each region r: if mask[r][j], accumulate sum/count.
   *
   * Chunks are fetched directly (no LRU cache) to avoid polluting the small
   * cache used by single-ion image loads. In-flight dedup is not needed -
   * each chunk is read exactly once in the sequential scan.
   */
  async streamIonStats(
    masks: Uint8Array[],
    onProgress?: (done: number, total: number) => void,
    isCancelled?: () => boolean,
  ): Promise<{ sum: Float64Array; count: Int32Array }[]> {
    if (this._dataMode !== 'continuous') {
      throw new Error('[ZarrOssStore] streamIonStats only available in continuous mode')
    }
    if (!this.intensityMeta || !this.offsetsMeta) {
      throw new Error('[ZarrOssStore] call init() first')
    }
    if (!masks.length) return []

    const offsets = await this.loadOffsets()
    if (this._disposed) return []
    const nIons = offsets.length - 1
    const maskLen = masks[0]!.length

    // Per-region accumulators
    const results = masks.map(() => ({
      sum: new Float64Array(nIons),
      count: new Int32Array(nIons),
    }))

    const cs = this.intensityMeta.chunk_grid.configuration.chunk_shape[0]!
    const totalChunks = Math.ceil(this.totalIntensityPoints / cs)
    const BATCH_SIZE = 12

    let cursor = 0 // current ion index, advances monotonically

    for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
      if (this._disposed) return results
      if (isCancelled?.()) return results

      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks)
      const batch: Promise<Float32Array | Float64Array>[] = []
      for (let ci = batchStart; ci < batchEnd; ci++) {
        batch.push(this.fetchAndDecode1DChunk(this.intensityPath, this.intensityMeta, ci))
      }
      const chunks = (await Promise.all(batch)) as Float32Array[]
      if (this._disposed) return results
      if (isCancelled?.()) return results

      for (let k = 0; k < chunks.length; k++) {
        const ci = batchStart + k
        const chunk = chunks[k]!
        const chunkStart = ci * cs

        for (let i = 0; i < chunk.length; i++) {
          const globalIdx = chunkStart + i
          if (globalIdx >= this.totalIntensityPoints) break
          const v = chunk[i]!
          if (v === 0 || !Number.isFinite(v)) continue

          // Advance cursor to the ion containing globalIdx
          while (cursor + 1 < nIons && offsets[cursor + 1]! <= globalIdx) {
            cursor++
          }
          const pixelIdx = globalIdx - offsets[cursor]!
          if (pixelIdx < 0 || pixelIdx >= maskLen) continue

          for (let r = 0; r < masks.length; r++) {
            if (masks[r]![pixelIdx]!) {
              results[r]!.sum[cursor]! += v
              results[r]!.count[cursor]!++
            }
          }
        }
      }

      onProgress?.(batchEnd, totalChunks)
      // Yield to keep the UI responsive between batches
      await new Promise((r) => setTimeout(r, 0))
    }

    return results
  }

  /**
   * Region comparison via the pixel-major spectra group (v1.1 dual-group
   * layout): instead of streaming the ENTIRE intensity array (ion-major),
   * fetch only the spectra of the masked pixels — work scales with region
   * size, not dataset size.
   *
   * For each region, per pixel p in the mask:
   *   spectrum = spectra/intensity[offsets[p] : offsets[p+1]]
   *   spectrum[i] is the intensity of m/z bin i (dense, shared axes/mz axis)
   *   → sum[i] += spectrum[i], count[i] += 1 for non-zero finite values.
   *
   * Chunks are scheduled once (deduped across overlapping regions) through a
   * bounded producer-consumer worker pool and read via the spectra chunk cache
   * + in-flight map, so memory stays bounded (~spectraChunkCacheSize chunks).
   * Returns null when the spectra group / mz axis is unavailable or its
   * per-pixel length doesn't match the m/z axis (sparse spectra can't be
   * indexed directly — the caller should not attempt this path).
   */
  async streamRegionStatsBySpectra(
    masks: Uint8Array[],
    onProgress?: (done: number, total: number) => void,
    isCancelled?: () => boolean,
  ): Promise<{ sum: Float64Array; count: Int32Array }[] | null> {
    if (!this.hasSpectra) return null
    if (!masks.length) return []

    const offsets = await this.loadSpectraOffsets()
    if (!offsets || offsets.length < 2) return null
    const mzAxis = await this.loadMzAxis()
    if (!mzAxis) return null
    const nMz = mzAxis.length
    const nPixels = offsets.length - 1
    const spectraMeta = this.spectraIntensityMeta
    if (!spectraMeta) return null

    // Defensive: the accumulation below assumes every pixel's spectrum has
    // exactly nMz values, indexed by m/z position. A length mismatch means the
    // spectra are sparse (or the layout changed) — indexing would misalign.
    for (let p = 0; p < nPixels; p++) {
      if (offsets[p + 1]! - offsets[p]! !== nMz) return null
    }

    // Pre-scan each mask into a pixel-index list
    const pixelLists = masks.map((mask) => {
      const list: number[] = []
      const lim = Math.min(mask.length, nPixels)
      for (let j = 0; j < lim; j++) {
        if (mask[j] === 1) list.push(j)
      }
      return list
    })

    const results = masks.map(() => ({
      sum: new Float64Array(nMz),
      count: new Int32Array(nMz),
    }))

    const totalPixels = pixelLists.reduce((n, list) => n + list.length, 0)
    if (!totalPixels) return results

    // ---- Producer-consumer pipeline over CHUNKS (not pixels) ----
    //
    // The old loop batched N pixels and awaited the whole batch before
    // accumulating (a barrier: download and accumulation never overlap).
    // Instead we schedule by chunk: a bounded pool of workers pull the next
    // chunk from a shared cursor and accumulate it the moment it lands, so
    // downloads and accumulation pipeline. Each chunk is scheduled once even
    // when both regions overlap it (chunkOrder is deduped); the LRU cache
    // (100MB) + in-flight map bound memory, and the worker pool bounds the
    // number of concurrent OSS requests / decoded chunks in flight.
    const cs = spectraMeta.chunk_grid.configuration.chunk_shape[0]!

    // chunk → the (region, pixel spectrum slice) reads it serves. A single
    // pixel's spectrum normally lives in one chunk; when nMz > cs it spans two.
    interface PixelRef {
      region: number
      pixelOffset: number
      localStart: number
      localEnd: number
    }
    const chunkPixels = new Map<number, PixelRef[]>()
    const chunkOrder: number[] = []
    pixelLists.forEach((list, region) => {
      for (const p of list) {
        const start = offsets[p]!
        const end = offsets[p + 1]!
        if (start === end) continue
        const startChunk = Math.floor(start / cs)
        const endChunk = Math.floor((end - 1) / cs)
        for (let ci = startChunk; ci <= endChunk; ci++) {
          const chunkStart = ci * cs
          const localStart = Math.max(start - chunkStart, 0)
          const localEnd = Math.min(end - chunkStart, cs)
          if (localEnd - localStart <= 0) continue
          if (!chunkPixels.has(ci)) {
            chunkPixels.set(ci, [])
            chunkOrder.push(ci)
          }
          chunkPixels.get(ci)!.push({ region, pixelOffset: start, localStart, localEnd })
        }
      }
    })

    const totalChunks = chunkOrder.length
    if (!totalChunks) return results

    // In-flight window (config.json 的 zarr.spectraConcurrency，构造时传入)。
    // 1MB chunks are big enough that ~6-8 concurrent requests saturate even a
    // fast link (bandwidth-delay product); 16 leaves comfortable headroom for
    // latency variance, and larger windows only burst main-thread decode work.
    // Raise to 24-32 only on links ≥1Gbps to the bucket.
    const CONCURRENCY = this.spectraConcurrency
    let next = 0
    let processedChunks = 0
    let failure: Error | null = null

    const processChunk = (ci: number, chunk: Float32Array | Float64Array) => {
      const refs = chunkPixels.get(ci)!
      for (const ref of refs) {
        const { sum, count } = results[ref.region]!
        const end = Math.min(ref.localEnd, chunk.length)
        for (let pos = ref.localStart; pos < end; pos++) {
          const v = chunk[pos]!
          if (v === 0 || !Number.isFinite(v)) continue
          const k = pos + ci * cs - ref.pixelOffset
          sum[k]! += v
          count[k]!++
        }
      }
    }

    const worker = async (): Promise<void> => {
      while (true) {
        if (failure || this._disposed || isCancelled?.()) return
        const i = next++
        if (i >= totalChunks) return
        const ci = chunkOrder[i]!
        let chunk: Float32Array | Float64Array
        try {
          chunk = await this.getOrFetchChunk(
            'spectra/intensity',
            spectraMeta,
            ci,
            this.spectraChunkCache,
            this.inFlightSpectra,
          )
        } catch (e) {
          // Record the first failure and bail; peers see `failure` and exit
          // cleanly on their next await instead of throwing in parallel.
          failure = e instanceof Error ? e : new Error(String(e))
          return
        }
        if (failure || this._disposed || isCancelled?.()) return
        processChunk(ci, chunk)
        processedChunks++
        onProgress?.(processedChunks, totalChunks)
        // Yield every window-full so the UI stays responsive.
        if (processedChunks % CONCURRENCY === 0) {
          await new Promise((r) => setTimeout(r, 0))
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, totalChunks) }, () => worker()),
    )
    if (failure) throw failure

    return results
  }

  // ========== region comparison: processed mode ==========

  /**
   * Stream through ALL intensity + mz chunks (pixel-major processed) and
   * accumulate per-m/z-bin statistics for one or more pixel masks.
   *
   * Processed data has no shared m/z axis - each pixel has its own list of
   * (mz, intensity) pairs. To compare regions we bin all m/z values into
   * uniform bins and accumulate per-bin statistics, producing a synthetic
   * m/z axis from the bin centres.
   *
   * For each non-zero intensity value at global index g:
   *   pixel = the p where offsets[p] <= g < offsets[p+1]  (monotonic cursor)
   *   mz    = dataMz[g]
   *   bin   = Math.round(mz / binWidth)
   *   For each region r: if mask[r][pixel], accumulate sum/count.
   *
   * intensity and data/mz arrays are index-aligned, so the same cursor works
   * for both. Chunks from both arrays are fetched in parallel batches.
   */
  async streamIonStatsProcessed(
    masks: Uint8Array[],
    binWidth: number,
    onProgress?: (done: number, total: number) => void,
    isCancelled?: () => boolean,
  ): Promise<{
    bins: { mz: number; sum: Float64Array; count: Int32Array }[]
    binCount: number
  }> {
    if (this._dataMode !== 'processed') {
      throw new Error('[ZarrOssStore] streamIonStatsProcessed only available in processed mode')
    }
    if (!this.intensityMeta || !this.offsetsMeta || !this.dataMzMeta) {
      throw new Error('[ZarrOssStore] call init() first')
    }
    if (!masks.length) return { bins: [], binCount: 0 }

    const offsets = await this.loadOffsets()
    if (this._disposed) return { bins: [], binCount: 0 }
    const nPixels = offsets.length - 1
    const maskLen = masks[0]!.length

    // Sparse per-region accumulators keyed by bin index
    const nMasks = masks.length
    const sparseMaps: Map<number, { sum: number; count: number }>[] = masks.map(() => new Map())

    const cs = this.intensityMeta.chunk_grid.configuration.chunk_shape[0]!
    const totalChunks = Math.ceil(this.totalIntensityPoints / cs)
    const BATCH_SIZE = 6 // smaller batch: each chunk fetches 2 arrays (intensity + mz)

    let cursor = 0 // current pixel index, advances monotonically

    for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
      if (this._disposed) return { bins: [], binCount: 0 }
      if (isCancelled?.()) return { bins: [], binCount: 0 }

      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks)
      const nChunksInBatch = batchEnd - batchStart

      // Fetch intensity + mz chunks in parallel
      const fetches: Promise<Float32Array | Float64Array>[] = []
      for (let ci = batchStart; ci < batchEnd; ci++) {
        fetches.push(this.fetchAndDecode1DChunk(this.intensityPath, this.intensityMeta, ci))
        fetches.push(this.fetchAndDecode1DChunk(this.dataMzPath, this.dataMzMeta, ci))
      }
      const fetched = await Promise.all(fetches)
      if (this._disposed) return { bins: [], binCount: 0 }
      if (isCancelled?.()) return { bins: [], binCount: 0 }

      for (let k = 0; k < nChunksInBatch; k++) {
        const ci = batchStart + k
        const intensityChunk = fetched[k * 2]! as Float32Array
        const mzChunk = fetched[k * 2 + 1]! as Float64Array
        const chunkStart = ci * cs

        for (let i = 0; i < intensityChunk.length; i++) {
          const globalIdx = chunkStart + i
          if (globalIdx >= this.totalIntensityPoints) break
          const v = intensityChunk[i]!
          if (v === 0 || !Number.isFinite(v)) continue

          const mzVal = mzChunk[i]!
          if (!Number.isFinite(mzVal) || mzVal <= 0) continue

          // Advance cursor to the pixel containing globalIdx
          while (cursor + 1 < nPixels && offsets[cursor + 1]! <= globalIdx) {
            cursor++
          }
          if (cursor < 0 || cursor >= maskLen) continue

          const binKey = Math.round(mzVal / binWidth)

          for (let r = 0; r < nMasks; r++) {
            if (masks[r]![cursor]!) {
              let entry = sparseMaps[r]!.get(binKey)
              if (!entry) {
                entry = { sum: 0, count: 0 }
                sparseMaps[r]!.set(binKey, entry)
              }
              entry.sum += v
              entry.count++
            }
          }
        }
      }

      onProgress?.(batchEnd, totalChunks)
      await new Promise((r) => setTimeout(r, 0))
    }

    // Collect all bin keys across regions, sort to produce a synthetic m/z axis
    const allBinKeys = new Set<number>()
    for (const m of sparseMaps) {
      for (const key of m.keys()) allBinKeys.add(key)
    }
    const sortedBins = Array.from(allBinKeys).sort((a, b) => a - b)
    const binCount = sortedBins.length

    const bins = sortedBins.map((binKey) => ({
      mz: binKey * binWidth,
      sum: new Float64Array(nMasks),
      count: new Int32Array(nMasks),
    }))

    // Fill arrays from sparse maps
    for (let r = 0; r < nMasks; r++) {
      const map = sparseMaps[r]!
      for (let b = 0; b < binCount; b++) {
        const entry = map.get(sortedBins[b]!)
        if (entry) {
          bins[b]!.sum[r] = entry.sum
          bins[b]!.count[r] = entry.count
        }
      }
    }

    return { bins, binCount }
  }
}
