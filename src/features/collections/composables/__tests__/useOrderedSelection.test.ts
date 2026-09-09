import { describe, expect, it } from 'vitest'
import { useOrderedSelection } from '../useOrderedSelection'

/**
 * 有序多选状态机测试：选择顺序、splice 移动语义、边界 no-op。
 * composable 无生命周期钩子，可在组件外直接调用。
 */

interface Item {
  id: string
  label?: string
}

const ids = (sel: ReturnType<typeof useOrderedSelection<Item>>) =>
  sel.selected.value.map((d) => d.id)

describe('useOrderedSelection', () => {
  it('toggle appends at the end, so selection order equals display order', () => {
    const sel = useOrderedSelection<Item>()
    sel.toggle({ id: 'a' })
    sel.toggle({ id: 'b' })
    sel.toggle({ id: 'c' })
    expect(ids(sel)).toEqual(['a', 'b', 'c'])
  })

  it('toggle on a selected item removes it and keeps the others in place', () => {
    const sel = useOrderedSelection<Item>()
    sel.toggle({ id: 'a' })
    sel.toggle({ id: 'b' })
    sel.toggle({ id: 'c' })
    sel.toggle({ id: 'b' })
    expect(ids(sel)).toEqual(['a', 'c'])
  })

  it('isSelected / selectedIds stay in sync after add, remove and clear', () => {
    const sel = useOrderedSelection<Item>()
    sel.toggle({ id: 'a' })
    sel.toggle({ id: 'b' })
    expect(sel.isSelected('a')).toBe(true)
    expect(sel.isSelected('b')).toBe(true)
    expect(sel.isSelected('c')).toBe(false)
    expect(sel.selectedIds.value).toEqual(new Set(['a', 'b']))

    sel.toggle({ id: 'a' })
    expect(sel.isSelected('a')).toBe(false)
    expect(sel.selectedIds.value).toEqual(new Set(['b']))

    sel.clear()
    expect(sel.selectedIds.value.size).toBe(0)
  })

  it('move uses splice semantics in both directions', () => {
    const sel = useOrderedSelection<Item>()
    for (const id of ['a', 'b', 'c', 'd']) sel.toggle({ id })

    sel.move(0, 2) // a after c
    expect(ids(sel)).toEqual(['b', 'c', 'a', 'd'])

    sel.move(3, 1) // d before c
    expect(ids(sel)).toEqual(['b', 'd', 'c', 'a'])
  })

  it('move is a no-op for equal or out-of-range indices', () => {
    const sel = useOrderedSelection<Item>()
    for (const id of ['a', 'b', 'c']) sel.toggle({ id })

    sel.move(1, 1)
    sel.move(-1, 0)
    sel.move(0, 3)
    sel.move(5, 0)
    expect(ids(sel)).toEqual(['a', 'b', 'c'])
  })

  it('moveUp at the top and moveDown at the bottom are no-ops', () => {
    const sel = useOrderedSelection<Item>()
    for (const id of ['a', 'b']) sel.toggle({ id })

    sel.moveUp(0)
    expect(ids(sel)).toEqual(['a', 'b'])
    sel.moveDown(1)
    expect(ids(sel)).toEqual(['a', 'b'])

    sel.moveUp(1)
    expect(ids(sel)).toEqual(['b', 'a'])
    sel.moveDown(0)
    expect(ids(sel)).toEqual(['a', 'b'])
  })

  it('removeById drops the matching entry without touching the rest', () => {
    const sel = useOrderedSelection<Item>()
    for (const id of ['a', 'b', 'c']) sel.toggle({ id })

    sel.removeById('b')
    expect(ids(sel)).toEqual(['a', 'c'])
    sel.removeById('missing')
    expect(ids(sel)).toEqual(['a', 'c'])
  })

  it('accepts an initial selection (for the future Edit reuse)', () => {
    const sel = useOrderedSelection<Item>([
      { id: 'x', label: 'initial' },
      { id: 'y', label: 'initial' },
    ])
    expect(ids(sel)).toEqual(['x', 'y'])
    // 初始数组是拷贝，外部再改不影响内部状态
    sel.toggle({ id: 'x' })
    expect(ids(sel)).toEqual(['y'])
  })
})
