import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/api/httpClient', () => ({
  auth_api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const { getTokenMock } = vi.hoisted(() => ({ getTokenMock: vi.fn() }))

vi.mock('@/shared/auth/authStorage', () => ({
  authStorage: { getToken: getTokenMock },
}))

import { api, auth_api } from '@/shared/api/httpClient'
import { getShareOverviewMetadata } from '../overviewShareApi'

const anonGet = vi.mocked(api.get)
const authGet = vi.mocked(auth_api.get)

const PID = 'aB3xK9mQ2rT7wY1z'
const EXCHANGE_BODY = { file_id: 42, public_id: PID }

beforeEach(() => {
  anonGet.mockReset()
  authGet.mockReset()
  getTokenMock.mockReset()
})

describe('getShareOverviewMetadata（分享内容需要登录态）', () => {
  it('fetches new public-id links directly with the auth client, no exchange', async () => {
    getTokenMock.mockReturnValue('token-1')
    authGet.mockResolvedValue({ data: {} })

    const result = await getShareOverviewMetadata({ kind: 'publicId', value: PID })

    expect(authGet).toHaveBeenCalledWith(`/files/${PID}/metadata`, {})
    expect(anonGet).not.toHaveBeenCalled()
    // 新链接没有兑换发生：调用方不会触发地址栏升级
    expect(result.exchangedPublicId).toBeUndefined()
    expect(result.metadata).toEqual({})
  })

  it('uses the anonymous client with skipAuthRedirect when signed out', async () => {
    getTokenMock.mockReturnValue(null)
    anonGet.mockResolvedValue({ data: {} })

    await getShareOverviewMetadata({ kind: 'publicId', value: PID })

    // skipAuthRedirect 挡掉全局 401 跳转，页面才能就地渲染登录/注册引导
    expect(anonGet).toHaveBeenCalledWith(
      `/files/${PID}/metadata`,
      expect.objectContaining({ skipAuthRedirect: true }),
    )
    expect(authGet).not.toHaveBeenCalled()
  })

  it('exchanges a legacy numeric id for its public_id before fetching metadata (signed in)', async () => {
    getTokenMock.mockReturnValue('token-1')
    authGet.mockResolvedValueOnce({ data: EXCHANGE_BODY }).mockResolvedValueOnce({ data: {} })

    const result = await getShareOverviewMetadata({ kind: 'legacyId', value: '42' })

    expect(authGet).toHaveBeenNthCalledWith(1, '/files/id/42/public_id', {})
    expect(authGet).toHaveBeenNthCalledWith(2, `/files/${PID}/metadata`, {})
    // 兑换出的 public_id 交还调用方，驱动地址栏升级
    expect(result.exchangedPublicId).toBe(PID)
    expect(result.metadata).toEqual({})
  })

  it('keeps the anonymous skipAuthRedirect behavior for the legacy exchange too', async () => {
    getTokenMock.mockReturnValue(null)
    anonGet.mockResolvedValueOnce({ data: EXCHANGE_BODY }).mockResolvedValueOnce({ data: {} })

    const result = await getShareOverviewMetadata({ kind: 'legacyId', value: '42' })

    expect(anonGet).toHaveBeenNthCalledWith(
      1,
      '/files/id/42/public_id',
      expect.objectContaining({ skipAuthRedirect: true }),
    )
    expect(anonGet).toHaveBeenNthCalledWith(
      2,
      `/files/${PID}/metadata`,
      expect.objectContaining({ skipAuthRedirect: true }),
    )
    expect(result.exchangedPublicId).toBe(PID)
  })
})
