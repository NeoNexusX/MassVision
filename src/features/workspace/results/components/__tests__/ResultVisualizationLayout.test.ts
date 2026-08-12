import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ResultVisualizationLayout from '../ResultVisualizationLayout.vue'

const slots = {
  'left-panel': '<div>annotation-slot</div>',
  viz: '<div>viz-slot</div>',
  compare: '<div>compare-slot</div>',
  'side-panel': '<div>side-slot</div>',
}

describe('ResultVisualizationLayout feature visibility', () => {
  it('shows optional result areas by default', () => {
    const wrapper = mount(ResultVisualizationLayout, { slots })

    expect(wrapper.text()).toContain('annotation-slot')
    expect(wrapper.text()).toContain('compare-slot')
  })

  it('removes disabled areas while retaining visualization and metadata', () => {
    const wrapper = mount(ResultVisualizationLayout, {
      props: { showLeftPanel: false, showCompare: false },
      slots,
    })

    expect(wrapper.text()).not.toContain('annotation-slot')
    expect(wrapper.text()).not.toContain('compare-slot')
    expect(wrapper.text()).toContain('viz-slot')
    expect(wrapper.text()).toContain('side-slot')
  })
})
