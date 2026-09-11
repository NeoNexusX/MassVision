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
    expect(wrapper.find('input[type="text"]').exists()).toBe(false)
  })

  it('populates the draft inputs when opened', async () => {
    const wrapper = mountDialog(false)

    await wrapper.setProps({ open: true })
    await nextTick()

    const organismInput = wrapper.find('input[type="text"]')
    expect((organismInput.element as HTMLInputElement).value).toBe('Mouse')
    expect(wrapper.find('select').element.value).toBe('profile')
  })
})
