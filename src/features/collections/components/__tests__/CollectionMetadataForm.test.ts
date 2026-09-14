import { beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import CollectionMetadataForm from '../CollectionMetadataForm.vue'
import { toMetadataDraft } from '../../utils/metadataPatch'
import { i18n, loadCoreMessages, loadFeatureMessages } from '@/i18n'

const draft = () => reactive(toMetadataDraft({ name: 'Mouse kidney MSI' }))

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(CollectionMetadataForm, { props: { draft: draft(), ...props }, global: { plugins: [i18n] } })


// 组件模板用 $t：挂载时装上 i18n 实例，并预先加载英文语言包（断言保持英文原文）
beforeAll(() => Promise.all([loadCoreMessages('en'), loadFeatureMessages('collections')]))

describe('CollectionMetadataForm', () => {
  it('renders every metadata group by default', () => {
    const text = mountForm().text()

    expect(text).toContain('General')
    expect(text).toContain('Citation')
    expect(text).toContain('Sample')
    expect(text).toContain('Acquisition')
    // Spatial 组已随集合级数值字段（pixel_size_* 等）下线
    expect(text).not.toContain('Spatial')
  })

  // 创建页把 name/description 交给专门的卡片，这里不能重复渲染
  it('hides fields listed in excludeKeys but keeps the rest of the group', () => {
    const wrapper = mountForm({ excludeKeys: ['name', 'description'] })

    expect(wrapper.text()).not.toContain('Name')
    expect(wrapper.text()).not.toContain('Description')
    // general 组仍有 member_type / collection_type
    expect(wrapper.text()).toContain('Member Type')
    expect(wrapper.text()).toContain('Collection Type')
  })

  it('offers a reset entry only for auto-managed fields the user has taken over', () => {
    const untouched = mountForm({ autoKeys: ['organism'], lockedKeys: [] })
    expect(untouched.text()).not.toContain('Reset to detected')

    const locked = mountForm({ autoKeys: ['organism'], lockedKeys: ['organism'] })
    expect(locked.text()).toContain('Reset to detected')

    // 不在 autoKeys 里的字段即使被标记也不显示（citation 是人工著录）
    const manual = mountForm({ autoKeys: ['organism'], lockedKeys: ['organism', 'doi'] })
    expect(manual.text()).toContain('Reset to detected')
    expect(manual.findAll('button').map((b) => b.text())).toEqual(['Reset to detected'])
  })

  it('emits reset-field with the field key', async () => {
    const wrapper = mountForm({ autoKeys: ['organism'], lockedKeys: ['organism'] })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('reset-field')).toEqual([['organism']])
  })

  // 重置按钮不能夹在 <label> 里：点它会把焦点/激活传给同一个 label 的控件
  it('keeps the reset button outside the field label', () => {
    const wrapper = mountForm({ autoKeys: ['organism'], lockedKeys: ['organism'] })
    const button = wrapper.find('button')

    expect(button.element.closest('label')).toBeNull()
  })
})
