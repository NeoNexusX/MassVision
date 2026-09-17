import { beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import IonChannelPanel from '../IonChannelPanel.vue'
import type { IonChannel } from '@/features/vizworkbench/composables/useIonChannels'
import { ION_CHANNEL_COLORS } from '@/features/vizworkbench/utils/ionChannelBlend'
import { i18n, loadCoreMessages, loadFeatureMessages } from '@/i18n'

// 组件模板用 $t：挂载时装上 i18n 实例，并预先加载英文语言包（断言保持英文原文）
beforeAll(() => Promise.all([loadCoreMessages('en'), loadFeatureMessages('vizworkbench')]))

function channel(over: Partial<IonChannel> = {}): IonChannel {
  return {
    id: 1,
    colorIndex: 0,
    color: ION_CHANNEL_COLORS[0]!,
    mzIndex: 10,
    mz: 445.0494,
    matrix: new Float32Array(4),
    loading: false,
    error: null,
    visible: true,
    ...over,
  }
}

function mountPanel(over: Record<string, unknown> = {}) {
  return mount(IonChannelPanel, {
    props: {
      enabled: true,
      channels: [],
      currentMz: 445.0494,
      canAdd: true,
      anyLoading: false,
      maxChannels: 6,
      ...over,
    },
    global: { plugins: [i18n] },
  })
}

describe('IonChannelPanel', () => {
  it('shows the empty-state hint and the current m/z on the add button', () => {
    const w = mountPanel()
    expect(w.text()).toContain('Add the current m/z to start overlaying.')
    // m/z is shown at 6-decimal precision (matches the toolbar's input)
    expect(w.get('button.btn-primary').text()).toContain('445.049400')
  })

  it('emits add-current', async () => {
    const w = mountPanel()
    await w.get('button.btn-primary').trigger('click')
    expect(w.emitted('add-current')).toHaveLength(1)
  })

  it('disables add when canAdd is false', () => {
    const w = mountPanel({ canAdd: false })
    expect(w.get('button.btn-primary').attributes('disabled')).toBeDefined()
  })

  it('disables add while the overlay mode is off', () => {
    const w = mountPanel({ enabled: false })
    expect(w.get('button.btn-primary').attributes('disabled')).toBeDefined()
  })

  it('emits update:enabled from the toggle', async () => {
    const w = mountPanel({ enabled: false })
    await w.get('input[type="checkbox"].toggle').setValue(true)
    expect(w.emitted('update:enabled')?.[0]).toEqual([true])
  })

  it('renders one row per channel with its m/z at 6 decimals', () => {
    const w = mountPanel({ channels: [channel(), channel({ id: 2, colorIndex: 1, mz: 500 })] })
    expect(w.findAll('button[aria-label^="Remove channel"]')).toHaveLength(2)
    expect(w.text()).toContain('445.049400')
    expect(w.text()).toContain('500.000000')
  })

  it('emits remove and toggle-visible per row', async () => {
    const w = mountPanel({ channels: [channel()] })
    await w.get('button[aria-label^="Remove channel"]').trigger('click')
    expect(w.emitted('remove')?.[0]).toEqual([1])

    await w.get('input[type="checkbox"].checkbox').trigger('change')
    expect(w.emitted('toggle-visible')?.[0]).toEqual([1])
  })

  it('shows a retry button instead of the spinner when a channel failed', async () => {
    const w = mountPanel({ channels: [channel({ error: 'boom', matrix: null })] })
    expect(w.find('.loading').exists()).toBe(false)
    const retry = w.get('button.text-error')
    await retry.trigger('click')
    expect(w.emitted('retry')?.[0]).toEqual([1])
  })

  it('shows a spinner while a channel is loading', () => {
    const w = mountPanel({ channels: [channel({ loading: true, matrix: null })] })
    expect(w.find('.loading').exists()).toBe(true)
  })

  it('reports the channel cap', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      channel({ id: i + 1, colorIndex: i, mz: 100 + i }),
    )
    const w = mountPanel({ channels: many, canAdd: false })
    expect(w.text()).toContain('Maximum of 6 channels reached.')
  })

  it('emits clear', async () => {
    const w = mountPanel({ channels: [channel()] })
    const clear = w.findAll('button').find((b) => b.text() === 'Clear')!
    await clear.trigger('click')
    expect(w.emitted('clear')).toHaveLength(1)
  })
})
