/**
 * On-demand reader for the UMAP clustering zarr (format:
 * `massflow_feature_analysis`), stored in Alibaba Cloud OSS.
 *
 * This is a SEPARATE format from the ion-image zarr (massflow.msi_zarr) read
 * by ZarrOssStore, so it gets its own lightweight reader. The two share the
 * low-level codec/typed-array primitives via ./zarrCodecs.
 *
 * Layout (arrays may be single- or multi-chunk; both are reassembled):
 *   <root>/zarr.json                - group
 *   <root>/umap_image/              - (H, W, 3) uint8, pre-rendered RGB
 *
 * The RGB image is drawn directly as an overlay (alpha controlled by the UI);
 * background pixels (0,0,0) are treated as transparent by the caller.
 * KMeans is computed locally in the browser, so this reader does NOT fetch
 * the backend kmeans_image / kmeans_label_image arrays.
 */

import { createOssClient } from '../zarr/ossClient'
import type { OssClient } from '../zarr/ossClient'
import type { ZarrAccessResponse } from '../zarr/types/zarr'
import type { ClusteringImage } from './types/clustering'
import type { ZarrV3ArrayMetadata, ZarrV3GroupMetadata } from '../zarr/types/zarrV3'
import { assertV3Array, computeNDChunkKey } from '../zarr/zarrMetadata'
import { decodePayload } from '../zarr/zarrDecode'
import { readFullArray } from '../zarr/zarrReader'

/** Root group attributes of the clustering zarr. */
interface ClusteringRootAttrs {
  format: string
}

/**
 * Client-based byte source for non-OSS backends (e.g. a local/static zarr
 * served over HTTP — see localZarrClient.ts). `folderPath` is the key prefix
 * prepended to every path; pass '' (or omit) when the client is already
 * rooted at the parent of the zarr root.
 */
export interface ClusteringClientSource {
  client: OssClient
  folderPath?: string
}

export interface ClusteringStoreOptions {
  /**
   * Subdirectory (relative to folderPath) holding the actual zarr root.
   * OSS layout: the backend's folder_path points one level above a
   * "umap_kmeans_result.zarr/" subdir. v1.1 local datasets embed the UMAP
   * group inside the main zarr at "analysis/umap".
   */
  zarrRoot?: string
  /** Expected root `format` attribute; pass false to skip the check. */
  expectFormat?: string | false
}

export class ClusteringZarrStore {
  private oss: OssClient
  private folderPath: string
  private readonly zarrRoot: string
  private readonly expectFormat: string | false
  private _disposed = false

  constructor(
    source: ZarrAccessResponse | ClusteringClientSource,
    options: ClusteringStoreOptions = {},
  ) {
    if ('client' in source) {
      this.oss = source.client
      this.folderPath = source.folderPath ?? ''
    } else {
      this.oss = createOssClient(source)
      this.folderPath = source.folder_path
    }
    this.zarrRoot = options.zarrRoot ?? 'umap_kmeans_result.zarr'
    this.expectFormat = options.expectFormat ?? 'massflow_feature_analysis'
  }

  dispose(): void {
    this._disposed = true
  }

  /**
   * Read the root group zarr.json and validate the format.
   */
  async init(): Promise<void> {
    const root = await this.readJson<ZarrV3GroupMetadata>('zarr.json')
    if (root.zarr_format !== 3 || root.node_type !== 'group') {
      throw new Error(
        `[ClusteringZarrStore] unsupported root zarr format/node_type: ${root.zarr_format}/${root.node_type}`,
      )
    }
    if (this.expectFormat !== false) {
      const attrs = root.attributes as unknown as ClusteringRootAttrs | undefined
      if (attrs?.format !== this.expectFormat) {
        throw new Error(
          `[ClusteringZarrStore] unsupported format: ${attrs?.format ?? '(missing)'}, expected ${this.expectFormat}`,
        )
      }
    }
  }

  /** Load the pre-rendered UMAP RGB image (H, W, 3) uint8. */
  async loadUmapImage(): Promise<ClusteringImage> {
    return this.loadRgbImage('umap_image')
  }

  // ========== internal ==========

  private async loadRgbImage(arrayPath: string): Promise<ClusteringImage> {
    const meta = await this.readArrayMeta(arrayPath)
    if (meta.data_type !== 'uint8') {
      throw new Error(`[ClusteringZarrStore] ${arrayPath}: expected uint8, got ${meta.data_type}`)
    }
    if (meta.shape.length !== 3 || meta.shape[2] !== 3) {
      throw new Error(
        `[ClusteringZarrStore] ${arrayPath}: expected (H, W, 3), got (${meta.shape.join(', ')})`,
      )
    }
    const data = await this.readArrayFull(arrayPath, meta)
    const [height, width, channels] = meta.shape
    return { data, height: height!, width: width!, channels: channels! }
  }

  private async readArrayMeta(arrayPath: string): Promise<ZarrV3ArrayMetadata> {
    const meta = await this.readJson<ZarrV3ArrayMetadata>(`${arrayPath}/zarr.json`)
    assertV3Array(meta, arrayPath)
    return meta
  }

  /**
   * Read a whole array as one contiguous row-major buffer (single- and
   * multi-chunk arrays alike) via the shared zarrCodecs assembler.
   */
  private async readArrayFull(
    arrayPath: string,
    meta: ZarrV3ArrayMetadata,
  ): Promise<Uint8Array> {
    return readFullArray(meta, arrayPath, async (coords) => {
      const chunkKey = computeNDChunkKey(meta, coords)
      const raw = await this.oss.getObjectArrayBuffer(this.key(`${arrayPath}/${chunkKey}`))
      if (this._disposed) throw new Error('[ClusteringZarrStore] disposed during read')
      return decodePayload(meta, raw)
    })
  }

  private key(relativePath: string): string {
    // The actual zarr group sits inside a subdirectory (zarrRoot) of the
    // folderPath. Prepend both once here so the rest of the store uses
    // plain array names.
    const root = this.folderPath
    const rel = `${this.zarrRoot}/${relativePath.replace(/^\/+/, '')}`
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
      throw new Error(
        `[ClusteringZarrStore] failed to parse JSON at ${key}: ${(e as Error).message}`,
      )
    }
  }
}
