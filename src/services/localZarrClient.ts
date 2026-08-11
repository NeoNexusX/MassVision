/**
 * Local/static zarr client — implements the OssClient interface over plain
 * HTTP fetch, so ZarrOssStore / ClusteringZarrStore can read a zarr directory
 * served as static files (e.g. public/combin.zarr in dev, or any static host)
 * without OSS credentials or a backend.
 *
 * The client is rooted at `baseUrl`: a store key like "axes/mz/c/0" is
 * fetched from `${baseUrl}/axes/mz/c/0`. Reads are whole-file GETs, matching
 * the OSS client's chunk-granularity semantics (zarr chunks are small).
 *
 * Errors are normalized into OssError so the stores' not_found fallback
 * logic (e.g. v1.0 data/ vs v1.1 ion_image/ group detection) works unchanged.
 */

import { OssError, type OssClient } from './zarr/ossClient'

export function createLocalZarrClient(baseUrl: string): OssClient {
  if (!baseUrl) throw new Error('[localZarrClient] baseUrl is required')
  const base = baseUrl.replace(/\/+$/, '')

  async function getObjectArrayBuffer(key: string): Promise<ArrayBuffer> {
    const url = `${base}/${key.replace(/^\/+/, '')}`
    let resp: Response
    try {
      // Accept: octet-stream keeps SPA history-fallback middlewares from
      // answering a missing chunk with index.html (they only rewrite
      // text/html requests), so a missing file reliably surfaces as 404.
      resp = await fetch(url, { headers: { Accept: 'application/octet-stream' } })
    } catch (e) {
      throw new OssError(
        'cors',
        `Local zarr fetch failed: ${url} (${(e as Error).message})`,
        key,
      )
    }
    if (resp.status === 404) {
      throw new OssError('not_found', `Local zarr object not found: ${url}`, key, 404)
    }
    if (!resp.ok) {
      throw new OssError(
        'unknown',
        `Local zarr fetch failed (${resp.status}): ${url}`,
        key,
        resp.status,
      )
    }
    return resp.arrayBuffer()
  }

  // Directory listing is not possible over plain static HTTP; the stores
  // treat listObjects as best-effort, so an empty list is a safe degradation.
  async function listObjects(): Promise<string[]> {
    return []
  }

  return { getObjectArrayBuffer, listObjects }
}
