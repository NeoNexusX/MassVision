import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchInput from '../SearchInput.vue'

describe('SearchInput', () => {
  it('emits update:modelValue on input and search on Enter', async () => {
    const w = mount(SearchInput, { props: { modelValue: '' } })
    const input = w.find('input')
    await input.setValue('kidney')
    expect(w.emitted('update:modelValue')).toEqual([['kidney']])
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('search')).toEqual([['kidney']])
  })

  it('clear button emits an empty value', async () => {
    const w = mount(SearchInput, { props: { modelValue: 'abc' } })
    const btn = w.find('button')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['']])
  })

  it('hides the clear button while empty', () => {
    const w = mount(SearchInput, { props: { modelValue: '' } })
    expect(w.find('button').exists()).toBe(false)
  })
})
