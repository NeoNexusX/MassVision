import { beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TagInput from '../TagInput.vue'
import { i18n, loadCoreMessages } from '@/i18n'

const mountTags = (modelValue: string[] = []) =>
  mount(TagInput, { props: { modelValue, name: 'DOI' }, global: { plugins: [i18n] } })

async function type(wrapper: ReturnType<typeof mountTags>, value: string) {
  await wrapper.find('input').setValue(value)
}


// 组件模板用 $t：挂载时装上 i18n 实例，并预先加载英文语言包（断言保持英文原文）
beforeAll(() => Promise.all([loadCoreMessages('en')]))

describe('TagInput', () => {
  it('renders one chip per value', () => {
    const wrapper = mountTags(['10.1000/a', '10.1000/b'])
    expect(wrapper.text()).toContain('10.1000/a')
    expect(wrapper.text()).toContain('10.1000/b')
  })

  it('appends on Enter with trimming', async () => {
    const wrapper = mountTags(['mouse'])
    await type(wrapper, '  Rat ')
    await wrapper.find('input').trigger('keydown.enter')

    expect(wrapper.emitted('update:modelValue')).toEqual([[['mouse', 'Rat']]])
  })

  it('does not emit when the value is a duplicate (case-insensitive)', async () => {
    const wrapper = mountTags(['mouse'])
    await type(wrapper, 'MOUSE')
    await wrapper.find('input').trigger('keydown.enter')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('splits pasted comma-separated values in one commit', async () => {
    const wrapper = mountTags()
    await type(wrapper, 'a, b ,, c')
    await wrapper.find('input').trigger('keydown.enter')

    expect(wrapper.emitted('update:modelValue')).toEqual([[['a', 'b', 'c']]])
  })

  it('removes a chip by its ✕ button', async () => {
    const wrapper = mountTags(['a', 'b', 'c'])
    // chips 渲染顺序 = modelValue 顺序，第二个 ✕ 对应 'b'
    const removeButtons = wrapper.findAll('button')
    await removeButtons[1]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[['a', 'c']]])
  })

  it('backspace on empty input removes the last chip', async () => {
    const wrapper = mountTags(['a', 'b'])
    await wrapper.find('input').trigger('keydown.backspace')

    expect(wrapper.emitted('update:modelValue')).toEqual([[['a']]])
  })

  it('keeps backspace as normal edit while typing', async () => {
    const wrapper = mountTags(['a'])
    await type(wrapper, 'ra')
    await wrapper.find('input').trigger('keydown.backspace')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('commits on blur so a typed value is not lost', async () => {
    const wrapper = mountTags()
    await type(wrapper, 'kidney')
    await wrapper.find('input').trigger('blur')

    expect(wrapper.emitted('update:modelValue')).toEqual([[['kidney']]])
  })
})
