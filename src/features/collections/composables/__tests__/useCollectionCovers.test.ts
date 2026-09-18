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

const detailWith = (imagePaths: (string | null)[]) => ({
  members: imagePaths.map((imagePath, i) => ({
    publicId: `pub${i}abcdefghijk`,
    imagePath,
    filename: `f${i}.imzML`,
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

  it('fetches members via the row public id and exposes ordered imagePaths', async () => {
    getPublicCollectionMock.mockResolvedValueOnce(detailWith(['images/file_42/', 'images/file_7/']))

    const { memberImagePaths } = setup([summary({ id: 1, publicId: 'aB3xK9mQ2rT7wY1z' })])
    await flushPromises()

    expect(getPublicCollectionMock).toHaveBeenCalledWith('aB3xK9mQ2rT7wY1z')
    expect(memberImagePaths[1]).toEqual(['images/file_42/', 'images/file_7/'])
  })

  // 预览未生成的成员保留 null 槽位，由卡片/DatasetThumb 走占位图
  it('keeps null entries for members whose preview is not generated', async () => {
    getPublicCollectionMock.mockResolvedValueOnce(detailWith(['images/file_1/', null]))

    const { memberImagePaths } = setup([summary({ id: 2, publicId: 'aB3xK9mQ2rT7wY1z' })])
    await flushPromises()

    expect(memberImagePaths[2]).toEqual(['images/file_1/', null])
  })

  // 同一集合只请求一次：列表重渲染 / 重新赋值不应再打接口
  it('requests each collection at most once', async () => {
    getPublicCollectionMock.mockResolvedValue(detailWith(['images/file_1/']))
    const { collections, memberImagePaths } = setup([summary({ id: 1, publicId: 'aB3xK9mQ2rT7wY1z' })])
    await flushPromises()

    collections.value = [summary({ id: 1, publicId: 'aB3xK9mQ2rT7wY1z' })]
    await flushPromises()

    expect(getPublicCollectionMock).toHaveBeenCalledTimes(1)
    expect(memberImagePaths[1]).toEqual(['images/file_1/'])
  })

  // 后端将来若在列表里直接带上 members，就不该再发详情请求
  it('uses members already present on the list row without fetching', async () => {
    const { memberImagePaths } = setup([
      summary({ id: 9, publicId: 'aB3xK9mQ2rT7wY1z', members: detailWith(['images/file_5/']).members }),
    ])
    await flushPromises()

    expect(getPublicCollectionMock).not.toHaveBeenCalled()
    expect(memberImagePaths[9]).toEqual(['images/file_5/'])
  })

  it('skips fetching when the row carries no public id', async () => {
    const { memberImagePaths } = setup([summary({ id: 3, publicId: null })])
    await flushPromises()

    expect(getPublicCollectionMock).not.toHaveBeenCalled()
    // 无键可查：留空让卡片回退占位图
    expect(memberImagePaths[3]).toEqual([])
  })

  it('falls back to an empty list when the detail request fails', async () => {
    getPublicCollectionMock.mockRejectedValueOnce(new Error('boom'))

    const { memberImagePaths } = setup([summary({ id: 3, publicId: 'aB3xK9mQ2rT7wY1z' })])
    await flushPromises()

    expect(memberImagePaths[3]).toEqual([])
  })
})
