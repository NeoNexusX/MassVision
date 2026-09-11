import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef, type ShallowRef } from 'vue'

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }))

vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('../../api/collectionApi', () => ({
  updateCollection: vi.fn(),
  collectionErrorMessage: (err: any, fallback: string) => err?.message || fallback,
}))

import { updateCollection } from '../../api/collectionApi'
import { useCollectionEdit } from '../useCollectionEdit'
import type { CollectionDetail } from '../../types/collection'

const updateMock = vi.mocked(updateCollection)

function makeDetail(): CollectionDetail {
  return {
    id: 7,
    name: 'Kidney Atlas',
    title: 'MD',
    description: 'desc',
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
    // metadata 里的 name 是旧值：基线应以顶层 name 为准
    metadata: { name: 'stale', description: 'desc', doi: ['10.1/x'] },
    members: [],
  }
}

describe('useCollectionEdit', () => {
  let detail: ShallowRef<CollectionDetail | null>
  let saved: CollectionDetail[]
  let edit: ReturnType<typeof useCollectionEdit>

  beforeEach(() => {
    showToastMock.mockReset()
    updateMock.mockReset()
    detail = shallowRef(makeDetail())
    saved = []
    edit = useCollectionEdit({ detail, onSaved: (d) => saved.push(d) })
  })

  it('start 用顶层 name/description 初始化草稿，cancel 丢弃它', () => {
    edit.start()
    expect(edit.editing.value).toBe(true)
    expect(edit.draft.value?.name).toBe('Kidney Atlas')
    expect(edit.draft.value?.doi).toEqual(['10.1/x'])
    expect(edit.isDirty.value).toBe(false)

    edit.cancel()
    expect(edit.editing.value).toBe(false)
    expect(edit.draft.value).toBeNull()
  })

  it('只有真正改动过才算脏（改回原值重新变干净）', () => {
    edit.start()
    edit.draft.value!.name = 'Renamed'
    expect(edit.isDirty.value).toBe(true)

    edit.draft.value!.name = 'Kidney Atlas'
    expect(edit.isDirty.value).toBe(false)
  })

  it('save 只提交差量，成功后回写详情并退出编辑态', async () => {
    const updated = { ...makeDetail(), name: 'Renamed' }
    updateMock.mockResolvedValue(updated as any)

    edit.start()
    edit.draft.value!.name = 'Renamed'
    await edit.save()

    expect(updateMock).toHaveBeenCalledWith(7, { name: 'Renamed' })
    expect(saved).toEqual([updated])
    expect(edit.editing.value).toBe(false)
    expect(edit.draft.value).toBeNull()
    expect(showToastMock).toHaveBeenCalledWith('Collection updated', 'success')
  })

  it('name 为空时不发请求，留在页面上给出校验提示', async () => {
    edit.start()
    edit.draft.value!.name = '   '
    await edit.save()

    expect(updateMock).not.toHaveBeenCalled()
    expect(edit.validationError.value).toBe('Name is required.')
    expect(edit.editing.value).toBe(true)
  })

  it('保存失败留在编辑态，草稿不丢可重试', async () => {
    updateMock.mockRejectedValue(new Error('boom'))

    edit.start()
    edit.draft.value!.name = 'Renamed'
    await edit.save()

    expect(edit.editing.value).toBe(true)
    expect(edit.draft.value?.name).toBe('Renamed')
    expect(showToastMock).toHaveBeenCalledWith('boom', 'error')
  })
})
