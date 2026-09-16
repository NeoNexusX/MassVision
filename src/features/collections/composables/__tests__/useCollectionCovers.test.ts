import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref, type Ref } from 'vue'

const { getPublicCollectionMock } = vi.hoisted(() => ({ getPublicCollectionMock: vi.fn() }))

vi.mock('../../api/collectionApi', () => ({ getPublicCollection: getPublicCollectionMock }))

import { useCollectionCovers } from '../useCollectionCovers'
import type { CollectionSummary } from '../../types/collection'

const summary = (over: Partial<CollectionSummary>): CollectionSummary =>
  ({
    id: 1,
    name: 'X',
    title: null,
    description: null,
    memberCount: 0,
    totalSize: 0,
    ownerUsername: 'u',
    organism: [],
    createdAt: null,
    updatedAt: null,
    publicId: null,
    doi: [],
    journalName: null,
    access: null,
    organismPart: [],
    ionisationSource: [],
    ...over,
  }) as CollectionSummary

const detailWith = (ids: number[]) => ({
  members: ids.map((id) => ({
    id,
    filename: `f${id}.imzML`,
    size: 0,
    status: 'completed',
    isPublic: true,
    experimentType: 'imzML',
  })),
})

function setup(initial: CollectionSummary[]) {
  const collections: Ref<CollectionSummary[]> = ref(initial)
  return { collections, ...useCollectionCovers(collections) }
}

describe('useCollectionCovers', () => {
  beforeEach(() => {
    getPublicCollectionMock.mockReset()
  })

  it('fetches members via the row public id and exposes ordered file ids', async () => {
    getPublicCollectionMock.mockResolvedValueOnce(detailWith([42, 7]))

    const { memberIds } = setup([summary({ id: 1, publicId: 'aB3xK9mQ2rT7wY1z' })])
    await flushPromises()

    expect(getPublicCollectionMock).toHaveBeenCalledWith('aB3xK9mQ2rT7wY1z')
    expect(memberIds[1]).toEqual([42, 7])
  })

  // 同一集合只请求一次：列表重渲染 / 重新赋值不应再打接口
  it('requests each collection at most once', async () => {
    getPublicCollectionMock.mockResolvedValue(detailWith([1]))
    const { collections, memberIds } = setup([summary({ id: 1, publicId: 'pub-1' })])
    await flushPromises()

    collections.value = [summary({ id: 1, publicId: 'pub-1' })]
    await flushPromises()

    expect(getPublicCollectionMock).toHaveBeenCalledTimes(1)
    expect(memberIds[1]).toEqual([1])
  })

  // 后端将来若在列表里直接带上 members，就不该再发详情请求
  it('uses members already present on the list row without fetching', async () => {
    const { memberIds } = setup([
      summary({ id: 9, publicId: 'pub-9', members: detailWith([5, 6]).members }),
    ])
    await flushPromises()

    expect(getPublicCollectionMock).not.toHaveBeenCalled()
    expect(memberIds[9]).toEqual([5, 6])
  })

  it('skips fetching when the row carries no public id', async () => {
    const { memberIds } = setup([summary({ id: 3, publicId: null })])
    await flushPromises()

    expect(getPublicCollectionMock).not.toHaveBeenCalled()
    // 无键可查：留空让卡片回退占位图
    expect(memberIds[3]).toEqual([])
  })

  it('falls back to an empty list when the detail request fails', async () => {
    getPublicCollectionMock.mockRejectedValueOnce(new Error('boom'))

    const { memberIds } = setup([summary({ id: 3, publicId: 'pub-3' })])
    await flushPromises()

    expect(memberIds[3]).toEqual([])
  })
})
