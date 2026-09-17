import { beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CollectionFilterPanel from '../CollectionFilterPanel.vue'
import { i18n, loadCoreMessages, loadFeatureMessages } from '@/i18n'

// owner_username 是唯一的动态字段（showOwner 随 mineOnly 切换），
// 用真实 input 驱动；TagInput/SvgIcon 涉及 teleport 与 iconify，stub 掉
const mountPanel = (props: Record<string, unknown> = {}) =>
  mount(CollectionFilterPanel, {
    props,
    global: { plugins: [i18n], stubs: { TagInput: true, SvgIcon: true } },
  })

const ownerInput = (wrapper: ReturnType<typeof mountPanel>) =>
  wrapper
    .findAll('input')
    .find((i) => (i.element as HTMLInputElement).placeholder.includes('Owner'))

const clickApply = (wrapper: ReturnType<typeof mountPanel>) => {
  const buttons = wrapper.findAll('button')
  // 按钮序：Reset 在前、Apply 在后
  return buttons[buttons.length - 1]!.trigger('click')
}

const lastPayload = (wrapper: ReturnType<typeof mountPanel>) => {
  const events = wrapper.emitted('apply')
  const last = events![events!.length - 1]!
  return last[0] as Record<string, unknown>
}

// 组件模板用 $t：挂载时装上 i18n 实例并预载英文语言包（placeholder 按英文断言）
beforeAll(() => Promise.all([loadCoreMessages('en'), loadFeatureMessages('collections')]))

describe('CollectionFilterPanel', () => {
  it('carries the owner filter while visible', async () => {
    const wrapper = mountPanel({ showOwner: true })

    await ownerInput(wrapper)!.setValue('lyk')
    await clickApply(wrapper)

    expect(lastPayload(wrapper).owner_username).toBe('lyk')
  })

  it('drops dynamically hidden fields from the payload instead of keeping them as silent filters', async () => {
    const wrapper = mountPanel({ showOwner: true })
    await ownerInput(wrapper)!.setValue('lyk')
    await clickApply(wrapper)

    // 切到 Mine only：字段隐藏后再 Apply，残留值不得随 payload 发出
    await wrapper.setProps({ showOwner: false })
    await clickApply(wrapper)

    expect(lastPayload(wrapper)).not.toHaveProperty('owner_username')
    // 其余字段不受影响（正常发出空串/空数组）
    expect(lastPayload(wrapper)).toHaveProperty('name')
  })

  it('reset clears visible fields and also drops hidden ones', async () => {
    const wrapper = mountPanel({ showOwner: true })
    await ownerInput(wrapper)!.setValue('lyk')

    await wrapper.setProps({ showOwner: false })
    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 2]!.trigger('click') // Reset

    expect(lastPayload(wrapper)).not.toHaveProperty('owner_username')
  })
})
