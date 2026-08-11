/**
 * Alibaba Cloud OSS client wrapper (browser-side + STS temporary credentials).
 *
 * Key points:
 * - Initialized with an STS token; defaults to secure: true
 * - Exposes a single `getObjectArrayBuffer(key)` that all zarr reads go through
 * - Normalizes CORS / 403 / 404 / token-expired errors so the UI layer can
 *   switch on a single `.code` field
 * - Never prints token cleartext
 */

import type OSS from 'ali-oss'
import type { ZarrAccessResponse } from './types/zarr'

/** Unified error type; the UI layer switches on `.code` to render a hint. */
export class OssError extends Error {
  code: 'cors' | 'forbidden' | 'not_found' | 'token_expired' | 'unknown'
  status?: number
  objectKey: string

  constructor(
    code: OssError['code'],
    message: string,
    objectKey: string,
    status?: number,
  ) {
    super(message)
    this.name = 'OssError'
    this.code = code
    this.objectKey = objectKey
    this.status = status
  }
}

export interface OssClient {
  getObjectArrayBuffer(key: string): Promise<ArrayBuffer>
  listObjects(prefix: string, maxKeys?: number): Promise<string[]>
}

function classifyError(err: unknown, objectKey: string): OssError {
  const anyErr = err as {
    code?: string | number
    status?: number
    message?: string
    name?: string
  }
  const status = anyErr.status
  const code = String(anyErr.code ?? '').toLowerCase()
  const msg = anyErr.message ?? String(err)

  if (status === 404 || code === 'nosuchkey' || code === 'objectnotfound') {
    return new OssError('not_found', `OSS object not found: ${objectKey}`, objectKey, 404)
  }
  if (status === 403 || code === 'forbidden' || code === 'accessdenied') {
    return new OssError(
      'forbidden',
      `OSS access forbidden for ${objectKey}. This may be due to an expired STS token, insufficient permissions, or a missing CORS configuration.`,
      objectKey,
      403,
    )
  }
  if (
    code === 'securitytokenexpired' ||
    code === 'invalidsecuritytoken' ||
    code === 'expiredtoken'
  ) {
    return new OssError(
      'token_expired',
      `STS token expired when accessing ${objectKey}`,
      objectKey,
      status,
    )
  }
  // Browser fetch on CORS rejection typically reports status=0 / NetworkError.
  if (
    code === 'neterror' ||
    code === 'networkerror' ||
    status === 0 ||
    /failed to fetch|networkerror|cors/i.test(msg)
  ) {
    return new OssError(
      'cors',
      `OSS CORS / network error when accessing ${objectKey}. Please check the OSS Bucket CORS configuration.`,
      objectKey,
      status,
    )
  }
  return new OssError('unknown', msg, objectKey, status)
}

export function createOssClient(access: ZarrAccessResponse): OssClient {
  if (!access?.sts_token?.AccessKeyId) {
    throw new Error('[ossClient] invalid ZarrAccessResponse: missing sts_token.AccessKeyId')
  }

  // Deferred: ali-oss is a large dependency — import it lazily on first use
  // instead of at module load time. The client is created once and reused.
  let clientPromise: Promise<OSS> | null = null
  function getClient(): Promise<OSS> {
    if (!clientPromise) {
      clientPromise = import('ali-oss').then(
        (mod) =>
          new mod.default({
            region: `oss-${access.region}`,
            bucket: access.bucket,
            accessKeyId: access.sts_token.AccessKeyId,
            accessKeySecret: access.sts_token.AccessKeySecret,
            stsToken: access.sts_token.SecurityToken,
            authorizationV4: true,
            secure: true,
          }),
      )
    }
    return clientPromise
  }

  async function getObjectArrayBuffer(key: string): Promise<ArrayBuffer> {
    if (!key) throw new Error('[ossClient] getObjectArrayBuffer: key is required')
    const client = await getClient()
    try {
      const result = await client.get(key)
      const content = result.content

      // In the browser, `content` is a Blob.
      if (content instanceof Blob) {
        return await content.arrayBuffer()
      }
      // In Node / Buffer-backed environments, `content` is an ArrayBuffer.
      if (content instanceof ArrayBuffer) {
        return content
      }
      if (content instanceof Uint8Array) {
        return (content.buffer as ArrayBuffer).slice(content.byteOffset, content.byteOffset + content.byteLength)
      }
      // Fallback: try duck-typed arrayBuffer() in case of a custom implementation.
      const anyContent = content as { arrayBuffer?(): Promise<ArrayBuffer> }
      if (anyContent.arrayBuffer) {
        return await anyContent.arrayBuffer()
      }
      throw new Error('[ossClient] unexpected ali-oss get() content type')
    } catch (err) {
      throw classifyError(err, key)
    }
  }

  async function listObjects(prefix: string, maxKeys = 200): Promise<string[]> {
    const client = await getClient()
    try {
      const out: string[] = []
      let marker: string | undefined

      while (out.length < maxKeys) {
        const resp = await client.list(
          { prefix, 'max-keys': String(maxKeys - out.length), marker },
        )
        const objs = resp.objects ?? []
        for (const o of objs) out.push(o.name)
        if (!resp.isTruncated || !resp.nextMarker) break
        marker = resp.nextMarker
      }
      return out
    } catch (err) {
      // List failure should not block the main flow; degrade to an empty list.
      console.warn('[ossClient] listObjects failed:', (err as Error).message)
      return []
    }
  }

  return {
    getObjectArrayBuffer,
    listObjects,
  }
}
