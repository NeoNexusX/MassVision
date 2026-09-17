import { describe, expect, it } from 'vitest'
import { useOrderedSelection } from '../useOrderedSelection'

interface Stub {
  publicId: string
  label: string
}

describe('useOrderedSelection', () => {
  it('appends on toggle in selection order and removes when already selected', () => {
    const { selected, isSelected, toggle } = useOrderedSelection<Stub>()

    toggle({ publicId: 'aB3xK9mQ2rT7wY1a', label: 'a' })
    toggle({ publicId: 'aB3xK9mQ2rT7wY1b', label: 'b' })
    toggle({ publicId: 'aB3xK9mQ2rT7wY1c', label: 'c' })
    expect(selected.value.map((d) => d.publicId)).toEqual([
      'aB3xK9mQ2rT7wY1a',
      'aB3xK9mQ2rT7wY1b',
      'aB3xK9mQ2rT7wY1c',
    ])

    toggle({ publicId: 'aB3xK9mQ2rT7wY1b', label: 'b' })
    expect(selected.value.map((d) => d.publicId)).toEqual(['aB3xK9mQ2rT7wY1a', 'aB3xK9mQ2rT7wY1c'])
    expect(isSelected('aB3xK9mQ2rT7wY1b')).toBe(false)
  })

  it('move implements splice semantics and ignores out-of-range/no-op indices', () => {
    const { selected, toggle, move } = useOrderedSelection<Stub>()
    const items: Stub[] = [
      { publicId: 'aB3xK9mQ2rT7wY1a', label: '1' },
      { publicId: 'aB3xK9mQ2rT7wY1b', label: '2' },
      { publicId: 'aB3xK9mQ2rT7wY1c', label: '3' },
    ]
    items.forEach(toggle)

    move(0, 2)
    expect(selected.value.map((d) => d.publicId)).toEqual([
      'aB3xK9mQ2rT7wY1b',
      'aB3xK9mQ2rT7wY1c',
      'aB3xK9mQ2rT7wY1a',
    ])

    move(1, 1)
    expect(selected.value.map((d) => d.publicId)).toEqual([
      'aB3xK9mQ2rT7wY1b',
      'aB3xK9mQ2rT7wY1c',
      'aB3xK9mQ2rT7wY1a',
    ])

    move(-1, 0)
    move(0, 99)
    expect(selected.value.map((d) => d.publicId)).toEqual([
      'aB3xK9mQ2rT7wY1b',
      'aB3xK9mQ2rT7wY1c',
      'aB3xK9mQ2rT7wY1a',
    ])
  })

  it('moveUp/moveDown clamp by no-op at the edges', () => {
    const { selected, toggle, moveUp, moveDown } = useOrderedSelection<Stub>()
    ;[
      { publicId: 'aB3xK9mQ2rT7wY1a', label: '1' },
      { publicId: 'aB3xK9mQ2rT7wY1b', label: '2' },
    ].forEach(toggle)

    moveUp(0)
    expect(selected.value.map((d) => d.publicId)).toEqual(['aB3xK9mQ2rT7wY1a', 'aB3xK9mQ2rT7wY1b'])
    moveDown(1)
    expect(selected.value.map((d) => d.publicId)).toEqual(['aB3xK9mQ2rT7wY1a', 'aB3xK9mQ2rT7wY1b'])
    moveDown(0)
    expect(selected.value.map((d) => d.publicId)).toEqual(['aB3xK9mQ2rT7wY1b', 'aB3xK9mQ2rT7wY1a'])
  })

  it('removeById drops the matching public id', () => {
    const { selected, toggle, removeById } = useOrderedSelection<Stub>()
    toggle({ publicId: 'aB3xK9mQ2rT7wY1a', label: 'a' })
    toggle({ publicId: 'aB3xK9mQ2rT7wY1b', label: 'b' })

    removeById('aB3xK9mQ2rT7wY1a')
    expect(selected.value.map((d) => d.publicId)).toEqual(['aB3xK9mQ2rT7wY1b'])
  })

  it('clear empties the selection', () => {
    const { selected, toggle, clear } = useOrderedSelection<Stub>()
    toggle({ publicId: 'aB3xK9mQ2rT7wY1a', label: 'a' })
    clear()
    expect(selected.value).toEqual([])
  })

  it('starts from the initial items', () => {
    const { selected } = useOrderedSelection<Stub>([{ publicId: 'aB3xK9mQ2rT7wY1z', label: 'x' }])
    expect(selected.value).toEqual([{ publicId: 'aB3xK9mQ2rT7wY1z', label: 'x' }])
  })
})
