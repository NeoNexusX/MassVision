import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CollectionsToolbar from '../CollectionsToolbar.vue'

// SearchInput 是受控共享组件，直接用真实实现驱动 input；
// SvgIcon 依赖 iconify，stub 掉
const mountToolbar = (props: Record<string, unknown> = {}) =>
  mount(CollectionsToolbar, {
    props,
    global: { stubs: { SvgIcon: true } },
  })

const inputValue = (wrapper: ReturnType<typeof mountToolbar>) =>
  (wrapper.get('input').element as HTMLInputElement).value

describe('CollectionsToolbar', () => {
  it('emits the typed query on submit', async () => {
    const wrapper = mountToolbar()

    await wrapper.get('input').setValue('kidney')
    // 不能用 get('button')：输入有内容时 SearchInput 内部的清除按钮在 DOM 中更靠前
    await wrapper.get('button.btn-primary').trigger('click')

    expect(wrapper.emitted('search')?.[0]).toEqual(['kidney'])
  })

  it('clears the search box when the applied search is reset outside', async () => {
    // 场景：已提交搜索后点空态里的 Clear Search——外层 search 清空，
    // 输入框必须跟着清，否则框里留旧词与列表状态不一致
    const wrapper = mountToolbar({ searchApplied: 'kidney' })
    await wrapper.get('input').setValue('kidney')
    expect(inputValue(wrapper)).toBe('kidney')

    await wrapper.setProps({ searchApplied: '' })

    expect(inputValue(wrapper)).toBe('')
  })

  it('does not touch the input when a search is applied', async () => {
    const wrapper = mountToolbar({ searchApplied: '' })
    await wrapper.get('input').setValue('kid')

    await wrapper.setProps({ searchApplied: 'kidney' })

    expect(inputValue(wrapper)).toBe('kid')
  })
})
