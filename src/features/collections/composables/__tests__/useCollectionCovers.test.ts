import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref, type Ref } from 'vue'

const { getCollectionMock } = vi.hoisted(() => ({ getCollectionMock: vi.fn() }))

vi.mock('../../api/collectionApi', () => ({ getCollection: getCollectionMock }))

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
    access: [],
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
    getCollectionMock.mockReset()
  })

  it('fetches members per collection id and exposes ordered file ids', async () => {
    getCollectionMock.mockResolvedValueOnce(detailWith([42, 7]))

    const { memberIds } = setup([summary({ id: 1 })])
    await flushPromises()

    expect(getCollectionMock).toHaveBeenCalledWith(1)
    expect(memberIds[1]).toEqual([42, 7])
  })

  // 同一 id 只请求一次：列表重渲染 / 重新赋值不应再打接口
  it('requests each collection at most once', async () => {
    getCollectionMock.mockResolvedValue(detailWith([1]))
    const { collections, memberIds } = setup([summary({ id: 1 })])
    await flushPromises()

    collections.value = [summary({ id: 1 })]
    await flushPromises()

    expect(getCollectionMock).toHaveBeenCalledTimes(1)
    expect(memberIds[1]).toEqual([1])
  })

  // 后端将来若在列表里直接带上 members，就不该再发详情请求
  it('uses members already present on the list row without fetching', async () => {
    const { memberIds } = setup([
      summary({ id: 9, members: detailWith([5, 6]).members }),
    ])
    await flushPromises()

    expect(getCollectionMock).not.toHaveBeenCalled()
    expect(memberIds[9]).toEqual([5, 6])
  })

  it('falls back to an empty list when the detail request fails', async () => {
    getCollectionMock.mockRejectedValueOnce(new Error('boom'))

    const { memberIds } = setup([summary({ id: 3 })])
    await flushPromises()

    expect(memberIds[3]).toEqual([])
  })
})
