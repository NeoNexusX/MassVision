/**
 * KMeans worker - runs `ml-kmeans` off the main thread.
 *
 * Receives the UMAP raster + k, runs KMeans synchronously here (blocking the
 * worker is fine - it never touches the UI thread), and posts back the
 * rendered labels + RGB with transferable buffers (zero-copy).
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
  umapRgb: Uint8Array
  height: number
  width: number
  k: number
  seed: number
  maxIterations: number
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
  const { id, umapRgb, height, width, k, seed, maxIterations } = e.data
  try {
    const nPixels = height * width

    // ---- collect foreground points ----
    let count = 0
    for (let i = 0; i < nPixels; i++) {
      if (umapRgb[i * 3]! !== 0 || umapRgb[i * 3 + 1]! !== 0 || umapRgb[i * 3 + 2]! !== 0) count++
    }
    if (count < 2) {
      scope.postMessage({ id, error: '[kmeans] not enough foreground pixels to cluster' })
      return
    }

    const kk = Math.max(2, Math.min(Math.round(k), count))

    // Build the point array + a reverse index back to pixel space.
    const data: number[][] = new Array(count)
    const pixelIndex = new Int32Array(count)
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
