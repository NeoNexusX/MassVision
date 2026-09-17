import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef, type ShallowRef } from 'vue'

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }))

vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('../../api/collectionApi', () => ({
  addMembers: vi.fn(),
  removeMembers: vi.fn(),
  reorderMembers: vi.fn(),
  collectionErrorMessage: (err: any, fallback: string) => err?.message || fallback,
}))

import { addMembers, removeMembers, reorderMembers } from '../../api/collectionApi'
import { useCollectionMembers } from '../useCollectionMembers'
import type { CollectionApiError, CollectionDetail } from '../../types/collection'
import { loadCoreMessages, loadFeatureMessages } from '@/i18n'

const addMembersMock = vi.mocked(addMembers)
const removeMembersMock = vi.mocked(removeMembers)
const reorderMembersMock = vi.mocked(reorderMembers)

function makeDetail(ids: number[]): CollectionDetail {
  return {
    id: 7,
    name: 'X',
    title: null,
    description: null,
    memberCount: ids.length,
    totalSize: 0,
    ownerUsername: 'u',
    organism: [],
    createdAt: null,
    updatedAt: null,
    publicId: null,
    doi: [],
    journalName: null,
    publishTime: null,
    access: [],
    organismPart: [],
    ionisationSource: [],
    metadata: { name: 'X' },
    members: ids.map((id) => ({
      id,
      filename: `f${id}.imzML`,
      size: 0,
      status: 'completed',
      isPublic: true,
      experimentType: 'imzML',
    })),
  }
}

function apiError(status: number, backendMessage: string): CollectionApiError {
  const e = new Error(backendMessage) as CollectionApiError
  e.status = status
  e.backendMessage = backendMessage
  return e
}


// 被测代码用 t() 取文案：预先加载英文语言包，断言保持英文原文
beforeAll(() => Promise.all([loadCoreMessages('en'), loadFeatureMessages('collections')]))

describe('useCollectionMembers', () => {
  let detail: ShallowRef<CollectionDetail | null>
  let refresh: () => Promise<unknown>

  beforeEach(() => {
    showToastMock.mockReset()
    addMembersMock.mockReset()
    removeMembersMock.mockReset()
    reorderMembersMock.mockReset()
    detail = shallowRef<CollectionDetail | null>(makeDetail([1, 2, 3]))
    refresh = vi.fn(async () => undefined)
  })

  it('add writes back the returned detail and clears the reorder override', async () => {
    addMembersMock.mockResolvedValue(makeDetail([1, 2, 3, 4]))
    const ops = useCollectionMembers({ detail, refresh })

    await expect(ops.add([4])).resolves.toBe(true)

    expect(addMembersMock).toHaveBeenCalledWith(7, [4])
    expect(ops.members.value.map((m) => m.id)).toEqual([1, 2, 3, 4])
    expect(showToastMock).toHaveBeenCalledWith('Added', 'success')
  })

  it('add on 409 shows the backend message, refreshes, and reports failure', async () => {
    addMembersMock.mockRejectedValue(apiError(409, 'collection member limit exceeded'))
    const ops = useCollectionMembers({ detail, refresh })

    // 返回 false：调用方据此保持选集弹窗打开（选择仍在，便于重试）
    await expect(ops.add([4])).resolves.toBe(false)

    expect(showToastMock).toHaveBeenCalledWith('collection member limit exceeded', 'error')
    expect(refresh).toHaveBeenCalled()
  })

  it('remove reports the removed/skipped reconciliation and refreshes', async () => {
    removeMembersMock.mockResolvedValue({ collectionId: 7, removed: [1, 2], skipped: [9] })
    const ops = useCollectionMembers({ detail, refresh })

    await ops.remove([1, 2, 9])

    expect(removeMembersMock).toHaveBeenCalledWith(7, [1, 2, 9])
    expect(showToastMock).toHaveBeenCalledWith(
      'Removed 2 · 1 were no longer in the collection',
      'success',
    )
    expect(refresh).toHaveBeenCalled()
  })

  it('reorder optimistically reorders then writes back the full-rewrite response', async () => {
    reorderMembersMock.mockResolvedValue(makeDetail([3, 1, 2]))
    const ops = useCollectionMembers({ detail, refresh })

    await ops.reorder(2, 0)

    // 全量数组按乐观顺序提交
    expect(reorderMembersMock).toHaveBeenCalledWith(7, [3, 1, 2])
    expect(ops.members.value.map((m) => m.id)).toEqual([3, 1, 2])
  })

  it('reorder 409 order conflict refreshes to the server order instead of keeping the optimistic one', async () => {
    reorderMembersMock.mockRejectedValue(apiError(409, 'collection member order conflict'))
    // refresh 模拟拉到服务端最新（成员已变：1 被移走）
    refresh = vi.fn(async () => {
      detail.value = makeDetail([2, 3])
    })
    const ops = useCollectionMembers({ detail, refresh })

    await ops.reorder(0, 2)

    expect(showToastMock).toHaveBeenCalledWith(
      'Members were changed elsewhere. Refreshed to the latest order.',
      'warning',
    )
    // 乐观顺序被服务端版本覆盖
    expect(ops.members.value.map((m) => m.id)).toEqual([2, 3])
  })

  it('reorder network failure rolls back to the server version', async () => {
    reorderMembersMock.mockRejectedValue(new Error('network down'))
    const ops = useCollectionMembers({ detail, refresh })

    await ops.reorder(0, 2)

    expect(refresh).toHaveBeenCalled()
    expect(ops.members.value.map((m) => m.id)).toEqual([1, 2, 3])
  })
})
