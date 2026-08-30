import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ResultVisualizationLayout from '../ResultVisualizationLayout.vue'

const slots = {
  'left-panel': '<div>annotation-slot</div>',
  viz: '<div>viz-slot</div>',
  compare: '<div>compare-slot</div>',
  'side-panel': '<div>side-slot</div>',
}

describe('ResultVisualizationLayout', () => {
  it('renders every column slot', () => {
    const wrapper = mount(ResultVisualizationLayout, { slots })

    expect(wrapper.text()).toContain('annotation-slot')
    expect(wrapper.text()).toContain('viz-slot')
    expect(wrapper.text()).toContain('compare-slot')
    expect(wrapper.text()).toContain('side-slot')
  })

  it('lets the left column shrink to a rail when collapsed', () => {
    const expanded = mount(ResultVisualizationLayout, { slots })
    const collapsed = mount(ResultVisualizationLayout, {
      props: { leftPanelCollapsed: true },
      slots,
    })

    expect(expanded.html()).toContain('lg:flex-[1_1_0%]')
    expect(collapsed.html()).toContain('lg:flex-none')
  })
})
