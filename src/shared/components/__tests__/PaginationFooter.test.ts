import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PaginationFooter from '../PaginationFooter.vue'

const baseProps = {
  currentPage: 2,
  totalPages: 5,
  totalItems: 18,
  size: 10,
  pageRange: [1, 2, 3, 4, 5],
  // 显式传入，避免落到 getConfig() 默认值（单测里 config.json 尚未加载）
  pageSizeOptions: [6, 10, 20],
}

const mountFooter = (props: Partial<typeof baseProps> & Record<string, unknown> = {}) =>
  mount(PaginationFooter, { props: { ...baseProps, ...props } })

describe('PaginationFooter', () => {
  it('mirrors pageSizeOptions into the select, in order', () => {
    const options = mountFooter().findAll('select option')

    expect(options.map((o) => o.attributes('value'))).toEqual(['6', '10', '20'])
    expect(options.map((o) => o.text())).toEqual(['6', '10', '20'])
  })

  it('marks the current size as selected', () => {
    expect(mountFooter().find('select').element.value).toBe('10')
  })

  it('emits change-size as a number, not the raw string value', async () => {
    const wrapper = mountFooter()

    await wrapper.find('select').setValue('20')

    expect(wrapper.emitted('change-size')).toEqual([[20]])
  })

  it('shows the page/records summary by default', () => {
    expect(mountFooter().text()).toContain('Page')
    expect(mountFooter().text()).toContain('18')
    expect(mountFooter().text()).toContain('records')
  })

  it('hides the summary when showPageText is false', () => {
    expect(mountFooter({ showPageText: false }).text()).not.toContain('records')
  })

  it('re-emits page navigation from the pagination bar', async () => {
    const wrapper = mountFooter()
    const buttons = wrapper.findAll('button')

    await buttons.find((b) => b.text() === 'Next')!.trigger('click')
    await buttons.find((b) => b.text() === 'Prev')!.trigger('click')
    await buttons.find((b) => b.text() === '4')!.trigger('click')

    expect(wrapper.emitted('go-to-page')).toEqual([[3], [1], [4]])
  })
})
