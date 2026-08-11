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
