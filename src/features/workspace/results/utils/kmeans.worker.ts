/**
 * KMeans worker - runs `ml-kmeans` off the main thread.
 *
 * Two input modes (KmeansRequest carries exactly one):
 *  - embedding (v1.1, preferred): the raw float32 `scaled_embedding` +
 *    `coordinates` arrays - cluster the true 3D UMAP vectors, map labels back
 *    to pixels via the (x, y) grid coordinates. No H×W foreground scan.
 *  - raster (v1.0 fallback): the umap_image RGB, whose channels are the
 *    embedding quantized to uint8; background pixels (0,0,0) are skipped.
 *
 * Runs KMeans synchronously here (blocking the worker is fine - it never
 * touches the UI thread), and posts back the rendered labels + RGB with
 * transferable buffers (zero-copy).
 *
 * Determinism: `ml-kmeans` is called with a fixed `seed` and k-means++
 * initialization (seeded via `ml-random`), so the same input + k always yields
 * the same clusters.
 */

import { kmeans } from 'ml-kmeans'
import { kmeansColor } from './regionPalette'

interface KmeansRequest {
  /** Request id echoed back so the host can drop stale responses. */
  id: number
  height: number
  width: number
  k: number
  seed: number
  maxIterations: number
  /** v1.0 fallback: (H×W×3) uint8 raster. Absent when embedding is given. */
  umapRgb?: Uint8Array
  /**
   * v1.1 preferred input: the raw UMAP embedding - coordinates (x, y) uint32
   * pairs + scaled_embedding float32 triplets in [0, 1], `count` points.
   */
  embedding?: {
    coordinates: Uint32Array
    scaledEmbedding: Float32Array
    count: number
  }
}

interface KmeansResponse {
  id: number
  labels: Int32Array
  rgb: Uint8Array
  pointCount: number
  iterations: number
}

interface KmeansError {
  id: number
  error: string
}

// Minimal worker-global typing. The project compiles with the DOM lib only
// (no `webworker` lib), so we type just the surface we use instead of pulling
// in the full webworker lib, which would clash with DOM globals.
interface WorkerGlobalScope {
  onmessage: ((ev: MessageEvent<KmeansRequest>) => void) | null
  postMessage(message: KmeansResponse | KmeansError, transfer: Transferable[]): void
  postMessage(message: KmeansResponse | KmeansError): void
}
const scope = self as unknown as WorkerGlobalScope

scope.onmessage = (e: MessageEvent<KmeansRequest>) => {
  const { id, height, width, k, seed, maxIterations, umapRgb, embedding } = e.data
  try {
    const nPixels = height * width

    // ---- collect points + reverse index back to pixel space ----
    // Both modes produce `data` (one 3D point per tissue pixel, on the 0-255
    // scale so results match the legacy raster path) and `pixelIndex`
    // (point i -> pixel offset y * width + x).
    let count: number
    let data: number[][]
    let pixelIndex: Int32Array
    if (embedding) {
      // v1.1: the embedding arrays already contain exactly the tissue pixels.
      count = embedding.count
      data = new Array(count)
      pixelIndex = new Int32Array(count)
      const { coordinates, scaledEmbedding } = embedding
      for (let i = 0; i < count; i++) {
        data[i] = [
          scaledEmbedding[i * 3]! * 255,
          scaledEmbedding[i * 3 + 1]! * 255,
          scaledEmbedding[i * 3 + 2]! * 255,
        ]
        pixelIndex[i] = coordinates[i * 2 + 1]! * width + coordinates[i * 2]!
      }
    } else if (umapRgb) {
      // v1.0 fallback: foreground pixels of the raster are the points.
      count = 0
      for (let i = 0; i < nPixels; i++) {
        if (umapRgb[i * 3]! !== 0 || umapRgb[i * 3 + 1]! !== 0 || umapRgb[i * 3 + 2]! !== 0) count++
      }
      data = new Array(count)
      pixelIndex = new Int32Array(count)
      let p = 0
      for (let i = 0; i < nPixels; i++) {
        const r = umapRgb[i * 3]!
        const g = umapRgb[i * 3 + 1]!
        const b = umapRgb[i * 3 + 2]!
        if (r === 0 && g === 0 && b === 0) continue
        data[p] = [r, g, b]
        pixelIndex[p] = i
        p++
      }
    } else {
      scope.postMessage({ id, error: '[kmeans] request carries neither embedding nor raster' })
      return
    }

    if (count < 2) {
      scope.postMessage({ id, error: '[kmeans] not enough foreground pixels to cluster' })
      return
    }

    const kk = Math.max(2, Math.min(Math.round(k), count))

    // ---- run KMeans (sync here - this thread is disposable) ----
    const result = kmeans(data, kk, {
      seed,
      maxIterations,
      initialization: 'kmeans++',
    })

    // ---- render labels + RGB ----
    const labels = new Int32Array(nPixels).fill(-1)
    const rgb = new Uint8Array(nPixels * 3)
    for (let i = 0; i < count; i++) {
      const px = pixelIndex[i]!
      const cluster = result.clusters[i]!
      labels[px] = cluster
      const { r, g, b } = kmeansColor(cluster)
      rgb[px * 3] = r
      rgb[px * 3 + 1] = g
      rgb[px * 3 + 2] = b
    }

    // Transfer the output buffers back (zero-copy); the input was a copy.
    scope.postMessage(
      { id, labels, rgb, pointCount: count, iterations: result.iterations },
      [labels.buffer, rgb.buffer],
    )
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
