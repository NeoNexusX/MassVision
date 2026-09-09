import { describe, expect, it } from 'vitest'
import { addCollection, fetchCollections, updateCollection } from '../collectionsMock'
import type { CollectionDraft } from '../../types/collection'

/**
 * mock store 的成员派生测试：addCollection 由 datasetIds 派生
 * datasetCount/organisms，updateCollection 只动元信息不碰成员。
 *
 * 注意：模块级 collectionsStore 跨测试共享（fetch 有 350ms 假延迟），
 * 断言只做「包含/字段值」这类与既有内容无关的检查，避免顺序耦合。
 */

const draft: CollectionDraft = {
  name: 'Test Panel',
  description: 'picked from the create page',
  isPublic: true,
  datasetIds: ['11', '22', '33'],
  organisms: ['Mouse', 'Human'],
}

describe('collectionsMock', () => {
  it('addCollection derives datasetCount and stores the member ids', () => {
    const created = addCollection(draft, 'tester')

    expect(created.datasetCount).toBe(3)
    expect(created.organisms).toEqual(['Mouse', 'Human'])
    expect(created.datasetIds).toEqual(['11', '22', '33'])
    expect(created.owner).toBe('tester')
    // 存的是副本：外部改 draft.datasetIds 不影响 store
    draft.datasetIds.push('44')
    expect(created.datasetIds).toHaveLength(3)
    draft.datasetIds.pop()
  })

  it('unshifts the new collection so it appears on page 1 (updated_desc)', async () => {
    const created = addCollection(draft, 'tester')
    const page1 = await fetchCollections(
      { search: created.name, sort: 'updated_desc', page: 1, size: 10 },
      'tester',
    )
    expect(page1.data.map((c) => c.id)).toContain(created.id)
  })

  it('updateCollection keeps membership (datasetIds/datasetCount/organisms)', async () => {
    const created = addCollection(draft, 'tester')
    updateCollection(created.id, {
      name: 'Renamed Panel',
      description: 'edited',
      isPublic: false,
      datasetIds: [], // 编辑弹窗透传原集合的 ids；空数组也不应清空成员
      organisms: [],
    })
    const page = await fetchCollections(
      { search: 'Renamed Panel', sort: 'updated_desc', page: 1, size: 10 },
      'tester',
    )
    const edited = page.data.find((c) => c.id === created.id)
    expect(edited?.name).toBe('Renamed Panel')
    expect(edited?.datasetCount).toBe(3)
    expect(edited?.datasetIds).toEqual(['11', '22', '33'])
  })
})
