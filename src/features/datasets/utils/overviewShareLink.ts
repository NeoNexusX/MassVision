import type { Router } from 'vue-router'

/** 新版分享 token：16 位 public_id，直接明文出现在链接里，不再做 Base64 */
export const PUBLIC_ID_RE = /^[A-Za-z0-9]{16}$/

export function isValidPublicId(value: unknown): value is string {
  return typeof value === 'string' && PUBLIC_ID_RE.test(value)
}

/** 旧版 token 编码：正整数文件 id → URL-safe Base64（仅用于 legacy round-trip 校验） */
function encodeLegacyShareId(fileId: string): string {
  return btoa(fileId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * 旧版分享 token 的解码器：URL-safe Base64 编码的正整数文件 id。
 * 兑换接口 GET /files/id/{file_id}/public_id 已下线，legacy 链接不再发请求、
 * 按无效链接处理；保留解码器仅为把这类链接与 publicId 链接区分开。
 */
export function decodeLegacyShareId(encoded: string): string | null {
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null

  try {
    const base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encoded.length / 4) * 4, '=')
    const fileId = atob(base64)
    if (!/^[1-9]\d*$/.test(fileId)) return null
    // round-trip 校验：只有「数字 id 的规范化 Base64」才判为旧链接。
    // 没有这一步，恰好长得像 Base64 的 16 位 publicId 会被误判成 legacy。
    return encodeLegacyShareId(fileId) === encoded ? fileId : null
  } catch {
    return null
  }
}

export type ShareToken =
  | { kind: 'publicId'; value: string }
  | { kind: 'legacyId'; value: string }

/**
 * 分享路由 token 判别。legacy 优先（round-trip 后与 publicId 的歧义概率趋近于
 * 零），16 位字母数字串按 public_id 处理，其余一律无效 —— 无效链接（含 legacy，
 * 兑换接口已下线）直接渲染「无效分享链接」，不发起任何请求。
 */
export function resolveShareToken(token: string): ShareToken | null {
  const legacy = decodeLegacyShareId(token)
  if (legacy) return { kind: 'legacyId', value: legacy }
  if (isValidPublicId(token)) return { kind: 'publicId', value: token }
  return null
}

/**
 * Build the absolute, short Overview share URL /s/{public_id} from a 16-char
 * public id. 数据集分享统一走这一个入口（overview 页 Share 按钮与列表卡片分享共用）。
 */
export function buildOverviewShareUrl(
  router: Router,
  publicId: string,
  origin: string,
): string | null {
  if (!isValidPublicId(publicId)) return null

  const href = router.resolve({
    name: 'SharedDatasetOverview',
    params: { shareToken: publicId },
  }).href
  return new URL(href, origin).toString()
}
