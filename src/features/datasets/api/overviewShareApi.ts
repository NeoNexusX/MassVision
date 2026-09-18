import { api, auth_api } from '@/shared/api/httpClient'
import { authStorage } from '@/shared/auth/authStorage'
import { toFilePublicId } from '@/features/datasets/mappers/datasetMapper'
import type { ShareToken } from '@/features/datasets/utils/overviewShareLink'

export interface ShareOverviewResult {
  /** GET /files/{public_id}/metadata 的响应体 */
  metadata: any
  /**
   * legacy 链接（Base64 数字 id）经 /files/id/{file_id}/public_id 兑换出的
   * public_id。调用方据此把地址栏 router.replace 成新格式链接；非 legacy
   * 链接为 undefined。
   */
  exchangedPublicId?: string
}

/**
 * 分享页元数据：后端要求分享内容也需要登录态（匿名访问 401）。
 *
 * - 已登录 → auth_api（带 Authorization；token 失效时由全局 401 处理清凭证并跳登录）
 * - 匿名 → 匿名客户端 + skipAuthRedirect：401 不触发全局跳转，由页面就地渲染
 *   「登录 / 注册」引导（useDatasetDetail.requiresAuth）
 *
 * token 形态：
 * - publicId（新链接）→ 直接取数 GET /files/{public_id}/metadata
 * - legacyId（历史 Base64 数字链接）→ 后端不接受数字 id 直查元数据，先经专用接口
 *   GET /files/id/{file_id}/public_id 兑换成 public_id（响应 {file_id, public_id}，
 *   经 toFilePublicId 校验 16 位契约），再走统一取数。id 不存在/越界由后端 404，
 *   前端按死链处理，不硬编码范围。
 */
export async function getShareOverviewMetadata(token: ShareToken): Promise<ShareOverviewResult> {
  const authed = !!authStorage.getToken()
  const client = authed ? auth_api : api
  const config = authed ? {} : ({ skipAuthRedirect: true } as any)

  let publicId = token.value
  let exchangedPublicId: string | undefined
  if (token.kind === 'legacyId') {
    publicId = toFilePublicId(
      (await client.get(`/files/id/${token.value}/public_id`, config)).data?.public_id,
    )
    exchangedPublicId = publicId
  }

  const res = await client.get(`/files/${publicId}/metadata`, config)
  return { metadata: res.data, exchangedPublicId }
}
