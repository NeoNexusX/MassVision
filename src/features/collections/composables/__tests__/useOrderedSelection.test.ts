import { describe, expect, it } from 'vitest'
import { useOrderedSelection } from '../useOrderedSelection'

interface Stub {
  id: number | string
  label: string
}

describe('useOrderedSelection', () => {
  it('appends on toggle in selection order and removes when already selected', () => {
    const { selected, isSelected, toggle } = useOrderedSelection<Stub>()

    toggle({ id: 1, label: 'a' })
    toggle({ id: 2, label: 'b' })
    toggle({ id: 3, label: 'c' })
    expect(selected.value.map((d) => d.id)).toEqual([1, 2, 3])

    toggle({ id: 2, label: 'b' })
    expect(selected.value.map((d) => d.id)).toEqual([1, 3])
    expect(isSelected(2)).toBe(false)
    expect(isSelected('3')).toBe(false) // 类型不同不视为相等
  })

  it('supports number ids (backend collection members)', () => {
    const { selected, toggle, moveUp, removeById } = useOrderedSelection<Stub>()

    toggle({ id: 42, label: 'a' })
    toggle({ id: 7, label: 'b' })
    toggle({ id: 15, label: 'c' })
    moveUp(2)
    expect(selected.value.map((d) => d.id)).toEqual([42, 15, 7])

    removeById(42)
    expect(selected.value.map((d) => d.id)).toEqual([15, 7])
  })

  it('move implements splice semantics and ignores out-of-range/no-op indices', () => {
    const { selected, toggle, move } = useOrderedSelection<Stub>()
    const items: Stub[] = [
      { id: 'a', label: '1' },
      { id: 'b', label: '2' },
      { id: 'c', label: '3' },
    ]
    items.forEach(toggle)

    move(0, 2)
    expect(selected.value.map((d) => d.id)).toEqual(['b', 'c', 'a'])

    move(1, 1)
    expect(selected.value.map((d) => d.id)).toEqual(['b', 'c', 'a'])

    move(-1, 0)
    move(0, 99)
    expect(selected.value.map((d) => d.id)).toEqual(['b', 'c', 'a'])
  })

  it('moveUp/moveDown clamp by no-op at the edges', () => {
    const { selected, toggle, moveUp, moveDown } = useOrderedSelection<Stub>()
    ;[
      { id: 'a', label: '1' },
      { id: 'b', label: '2' },
    ].forEach(toggle)

    moveUp(0)
    expect(selected.value.map((d) => d.id)).toEqual(['a', 'b'])
    moveDown(1)
    expect(selected.value.map((d) => d.id)).toEqual(['a', 'b'])
    moveDown(0)
    expect(selected.value.map((d) => d.id)).toEqual(['b', 'a'])
  })

  it('clear empties the selection', () => {
    const { selected, toggle, clear } = useOrderedSelection<Stub>()
    toggle({ id: 1, label: 'a' })
    clear()
    expect(selected.value).toEqual([])
  })

  it('starts from the initial items', () => {
    const { selected } = useOrderedSelection<Stub>([{ id: 9, label: 'x' }])
    expect(selected.value).toEqual([{ id: 9, label: 'x' }])
  })
})
