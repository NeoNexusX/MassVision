import type { Router } from 'vue-router'

/** Encode a positive numeric file id as URL-safe Base64. */
export function encodeOverviewFileId(fileId: string | number): string | null {
  const normalized = String(fileId)
  if (!/^[1-9]\d*$/.test(normalized)) return null

  return btoa(normalized).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode and validate a URL-safe Base64 file id. */
export function decodeOverviewFileId(encoded: string): string | null {
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null

  try {
    const base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encoded.length / 4) * 4, '=')
    const fileId = atob(base64)
    return /^[1-9]\d*$/.test(fileId) ? fileId : null
  } catch {
    return null
  }
}

/** Build the absolute, short public Overview share URL. */
export function buildOverviewShareUrl(
  router: Router,
  fileId: string | number,
  origin: string,
): string | null {
  const encodedId = encodeOverviewFileId(fileId)
  if (!encodedId) return null

  const href = router.resolve({
    name: 'SharedDatasetOverview',
    params: { encodedId },
  }).href
  return new URL(href, origin).toString()
}

/**
 * Build the public file share URL /files/{public_id}（免登录公开页）。
 * public_id 是 16 位 base62，仅做宽松字符校验挡住空串/脏值；
 * 与 buildOverviewShareUrl 的 /s/{encodedId}（可枚举数字 id）并存：
 * 新链接优先用本函数，旧链接的解析链路保持不动以兼容存量分享。
 */
export function buildPublicFileShareUrl(
  router: Router,
  publicId: string | null | undefined,
  origin: string,
): string | null {
  if (!publicId || !/^[A-Za-z0-9_-]+$/.test(publicId)) return null

  const href = router.resolve({
    name: 'PublicFile',
    params: { publicId },
  }).href
  return new URL(href, origin).toString()
}
