import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/features/datasets/api/datasetApi', () => ({
  patchFileMetadata: vi.fn(),
}))

import FileMetadataDialog from '../FileMetadataDialog.vue'
import type { File } from '@/features/datasets/types/dataset'

const dataset = {
  id: '7',
  name: 'kidney',
  submitTime: '2026-09-10T00:00:00',
  submitter: 'u',
  status: 'completed',
  isPublic: true,
  organism: 'Mouse',
  spectrumMode: 'profile',
} as File

const mountDialog = (open = false) =>
  mount(FileMetadataDialog, { props: { open, dataset } })

describe('FileMetadataDialog', () => {
  // 回归：dialog 常驻 DOM，关闭态也会渲染模板；draft 未初始化时字段绑定
  // 访问 null 曾导致整个 Dataset Overview 页面崩溃
  it('renders without crashing when closed (draft not initialized)', () => {
    const wrapper = mountDialog(false)

    expect(wrapper.find('dialog.modal').exists()).toBe(true)
    // 守卫生效：关闭态不渲染字段绑定
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('populates the draft when opened (SelectWithOther falls back to Other input)', async () => {
    const wrapper = mountDialog(false)

    await wrapper.setProps({ open: true })
    await nextTick()

    // 'Mouse' 不在 ORGANISMS 词表内 → 组件自动落到 Other 自定义输入回显
    // （该 input 无显式 type 属性，不能用 input[type=text] 选择器）
    const otherInput = wrapper.find('input')
    expect((otherInput.element as HTMLInputElement).value).toBe('Mouse')

    // 'profile' 在枚举内 → 对应下拉直接选中
    const selectValues = wrapper.findAll('select').map((s) => s.element.value)
    expect(selectValues).toContain('profile')
  })
})
