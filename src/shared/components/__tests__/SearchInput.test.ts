import { beforeAll, describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchInput from '../SearchInput.vue'
import { i18n, loadCoreMessages } from '@/i18n'


// 组件模板用 $t：挂载时装上 i18n 实例，并预先加载英文语言包（断言保持英文原文）
beforeAll(() => Promise.all([loadCoreMessages('en')]))

describe('SearchInput', () => {
  it('emits update:modelValue on input and search on Enter', async () => {
    const w = mount(SearchInput, { props: { modelValue: '' }, global: { plugins: [i18n] } })
    const input = w.find('input')
    await input.setValue('kidney')
    expect(w.emitted('update:modelValue')).toEqual([['kidney']])
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('search')).toEqual([['kidney']])
  })

  it('clear button emits an empty value', async () => {
    const w = mount(SearchInput, { props: { modelValue: 'abc' }, global: { plugins: [i18n] } })
    const btn = w.find('button')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['']])
  })

  it('hides the clear button while empty', () => {
    const w = mount(SearchInput, { props: { modelValue: '' }, global: { plugins: [i18n] } })
    expect(w.find('button').exists()).toBe(false)
  })
})
