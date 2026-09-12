import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import CollectionMetadataPanel from '../CollectionMetadataPanel.vue'
import { toMetadataDraft } from '../../utils/metadataPatch'
import { METADATA_FIELDS } from '../../constants/metadataFields'
import type { CollectionMetadata } from '../../types/collection'

const metadata: CollectionMetadata = { name: 'Kidney Atlas', doi: ['10.1/x'] }

describe('CollectionMetadataPanel', () => {
  // 公开只读页 / Overview 非编辑态：表格展示，空字段占位「—」
  it('renders every field read-only when no draft is passed', () => {
    const wrapper = mount(CollectionMetadataPanel, { props: { metadata } })
    const text = wrapper.text()

    for (const field of METADATA_FIELDS) expect(text).toContain(field.label)
    expect(text).toContain('10.1/x')
    expect(text).toContain('—')
    expect(text).toContain(`2/${METADATA_FIELDS.length} fields`)
    // 只读态没有任何输入控件
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  // 编辑态：正文换成表驱动表单，只读的 <dl> 让位
  it('swaps its body for the form when a draft is passed', () => {
    const draft = reactive(toMetadataDraft(metadata))
    const wrapper = mount(CollectionMetadataPanel, { props: { metadata, draft } })

    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.find('dl').exists()).toBe(false)
    expect(wrapper.find('h2').text()).toBe('Collection Metadata')
  })

  // 计数读草稿：输入时实时更新（N/M 概览跟着动）
  it('counts filled fields from the draft while editing', () => {
    const draft = reactive(toMetadataDraft({ name: 'Kidney Atlas' }))
    const wrapper = mount(CollectionMetadataPanel, { props: { metadata, draft } })

    // metadata 里 doi 已填，草稿里为空 → 计数以草稿为准
    expect(wrapper.text()).toContain(`1/${METADATA_FIELDS.length} fields`)
  })
})
