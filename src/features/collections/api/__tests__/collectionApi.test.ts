import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/api/httpClient', () => ({
  auth_api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  extractBackendError: (err: any, fallback?: string) =>
    err?.response?.data?.detail ?? err?.message ?? fallback ?? 'Collection request failed',
}))

import { api, auth_api } from '@/shared/api/httpClient'
import {
  addMembers,
  createCollection,
  deleteCollection,
  getCollection,
  getPublicCollection,
  listCollections,
  removeMembers,
  reorderMembers,
  updateCollection,
} from '../collectionApi'

const authGet = vi.mocked(auth_api.get)
const authPost = vi.mocked(auth_api.post)
const authPatch = vi.mocked(auth_api.patch)
const authDelete = vi.mocked(auth_api.delete)
const publicGet = vi.mocked(api.get)

const detailBody = {
  id: 7,
  name: 'X',
  member_count: 1,
  total_size: 10,
  owner_username: 'u',
  metadata: { name: 'X' },
  members: [{ file_id: 42, filename: 'a.imzML' }],
}

beforeEach(() => {
  for (const m of [authGet, authPost, authPatch, authDelete, publicGet]) m.mockReset()
})

describe('collectionApi', () => {
  it('listCollections normalizes plain-array / {data} / {items} envelopes', async () => {
    const row = { id: 1, name: 'a', member_count: 0, total_size: 0, owner_username: 'u' }

    authGet.mockResolvedValueOnce({ data: [row] })
    expect(await listCollections()).toHaveLength(1)

    authGet.mockResolvedValueOnce({ data: { data: [row, row] } })
    expect(await listCollections()).toHaveLength(2)

    authGet.mockResolvedValueOnce({ data: { items: [row] } })
    expect(await listCollections()).toHaveLength(1)

    authGet.mockResolvedValueOnce({ data: {} })
    expect(await listCollections()).toEqual([])
  })

  it('getCollection maps the detail response', async () => {
    authGet.mockResolvedValueOnce({ data: detailBody })
    const d = await getCollection(7)
    expect(authGet).toHaveBeenCalledWith('/collections/7')
    expect(d.id).toBe(7)
    expect(d.members).toEqual([{ id: 42, filename: 'a.imzML', size: 0, status: '', isPublic: false, experimentType: null }])
  })

  it('createCollection posts payload and returns mapped detail', async () => {
    authPost.mockResolvedValueOnce({ data: detailBody })
    const d = await createCollection({ name: 'X', description: 'd', file_ids: [42, 7, 15] })
    expect(authPost).toHaveBeenCalledWith('/collections', {
      name: 'X',
      description: 'd',
      file_ids: [42, 7, 15],
    })
    expect(d.memberCount).toBe(1)
  })

  it('updateCollection sends only provided fields via PATCH', async () => {
    authPatch.mockResolvedValueOnce({ data: detailBody })
    await updateCollection(7, { name: 'Y' })
    expect(authPatch).toHaveBeenCalledWith('/collections/7', { name: 'Y' })
  })

  it('deleteCollection returns the raw reconciliation shape', async () => {
    authDelete.mockResolvedValueOnce({ data: { collection_id: 7, deleted: true } })
    const r = await deleteCollection(7)
    expect(r).toEqual({ collection_id: 7, deleted: true })
  })

  it('addMembers posts file_ids and returns full detail', async () => {
    authPost.mockResolvedValueOnce({ data: detailBody })
    await addMembers(7, [42, 7])
    expect(authPost).toHaveBeenCalledWith('/collections/7/members', { file_ids: [42, 7] })
  })

  it('removeMembers sends file_ids in the DELETE body', async () => {
    authDelete.mockResolvedValueOnce({ data: { collection_id: 7, removed: [42], skipped: [99] } })
    const r = await removeMembers(7, [42, 99])
    expect(authDelete).toHaveBeenCalledWith('/collections/7/members', { data: { file_ids: [42, 99] } })
    expect(r).toEqual({ collectionId: 7, removed: [42], skipped: [99] })
  })

  it('reorderMembers patches the full-rewrite order endpoint', async () => {
    authPatch.mockResolvedValueOnce({ data: detailBody })
    await reorderMembers(7, [42, 7, 15])
    expect(authPatch).toHaveBeenCalledWith('/collections/7/members/order', { file_ids: [42, 7, 15] })
  })

  it('getPublicCollection uses the no-auth client', async () => {
    publicGet.mockResolvedValueOnce({ data: detailBody })
    const d = await getPublicCollection('a'.repeat(32))
    expect(publicGet).toHaveBeenCalledWith(`/collections/public/${'a'.repeat(32)}`)
    expect(authGet).not.toHaveBeenCalled()
    expect(d.id).toBe(7)
  })

  it('wraps axios errors into CollectionApiError with status and backend detail', async () => {
    authGet.mockRejectedValueOnce({
      response: { status: 409, data: { detail: 'invalid collection members' } },
      message: 'Request failed with status code 409',
    })
    const err = await getCollection(7).catch((e) => e)
    expect(err.status).toBe(409)
    expect(err.backendMessage).toBe('invalid collection members')
    expect(err.message).toBe('invalid collection members')
  })
})
