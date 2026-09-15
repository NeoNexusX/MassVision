import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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

  it('hints Enter for free text, but pick-or-type when a vocabulary exists', () => {
    const free = mountTags()
    expect(free.find('input').attributes('placeholder')).toBe('Type and press Enter')

    const withOptions = mount(TagInput, {
      props: { modelValue: [], options: ['Positive'] },
      global: { plugins: [i18n] },
    })
    expect(withOptions.find('input').attributes('placeholder')).toBe(
      'Pick from the list, or type your own and press Enter',
    )
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

describe('TagInput with options', () => {
  const OPTIONS = ['Positive', 'Negative', 'Other']
  const LABELS: Record<string, string> = { Positive: '正离子', Negative: '负离子' }

  // 下拉 Teleport 到 body：挂到 document 上，从 body 查询
  const mountWithOptions = (modelValue: string[] = [], extra: Record<string, unknown> = {}) =>
    mount(TagInput, {
      props: { modelValue, options: OPTIONS, labelOf: (v: string) => LABELS[v] ?? v, ...extra },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })

  const optionEls = () => Array.from(document.body.querySelectorAll('[role="option"]'))

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('opens a filtered menu on focus, hiding the "Other" placeholder entry', async () => {
    const wrapper = mountWithOptions()
    await wrapper.find('input').trigger('focus')
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual(['正离子', '负离子'])

    await type(wrapper, '负')
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual(['负离子'])
    wrapper.unmount()
  })

  it('clicking an option toggles it (select, then deselect)', async () => {
    const wrapper = mountWithOptions(['Negative'])
    await wrapper.find('input').trigger('focus')
    ;(optionEls()[0] as HTMLElement).click()
    await nextTick()
    ;(optionEls()[1] as HTMLElement).click()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([
      [['Negative', 'Positive']],
      [['Positive']],
    ])
    expect(optionEls()[1]!.getAttribute('aria-selected')).toBe('false')
    wrapper.unmount()
  })

  it('arrow keys + Enter pick the highlighted option', async () => {
    const wrapper = mountWithOptions()
    const input = wrapper.find('input')
    await input.trigger('focus')
    await input.trigger('keydown.down')
    await input.trigger('keydown.down')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('update:modelValue')).toEqual([[['Negative']]])
    wrapper.unmount()
  })

  it('free text still works and is aligned to the vocabulary by value or label', async () => {
    const wrapper = mountWithOptions()
    await type(wrapper, 'positive, 负离子, Custom')
    await wrapper.find('input').trigger('keydown.enter')

    expect(wrapper.emitted('update:modelValue')).toEqual([[['Positive', 'Negative', 'Custom']]])
    wrapper.unmount()
  })

  it('renders no menu when options are empty', async () => {
    const wrapper = mountWithOptions([], { options: [] })
    await wrapper.find('input').trigger('focus')
    expect(optionEls()).toHaveLength(0)
    wrapper.unmount()
  })

  it('rejects free text that fails the pattern but lets vocabulary through', async () => {
    const wrapper = mountWithOptions([], { pattern: /^10\.\d+\/\S+$/g })
    await type(wrapper, 'not-a-doi')
    await wrapper.find('input').trigger('keydown.enter')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.text()).toContain('"not-a-doi" is not in a valid format.')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('not-a-doi')

    await type(wrapper, '10.1000/xyz')
    await wrapper.find('input').trigger('keydown.enter')
    await type(wrapper, 'Positive')
    await wrapper.find('input').trigger('keydown.enter')
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [['10.1000/xyz']],
      [['10.1000/xyz', 'Positive']],
    ])
    wrapper.unmount()
  })
})
