import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DatasetPreviewGallery from '../DatasetPreviewGallery.vue'
import { buildPreviewImageUrls } from '@/features/datasets/utils/imageUtils'

// imageUtils 的 base 运行时经 getConfig() 读 config.json 的 oss 块；单测不走
// 启动链，mock 掉并返回测试环境域名（与 imageUtils.test.ts 的 mock 一致）。
vi.mock('@/shared/config/runtimeConfig', () => ({
  getConfig: () => ({
    oss: { previewImageBase: 'https://kawaru-oss.oss-cn-hangzhou.aliyuncs.com' },
  }),
}))

const urls = buildPreviewImageUrls('42')

const mountGallery = () => mount(DatasetPreviewGallery, { props: { fileId: '42' } })

describe('DatasetPreviewGallery', () => {
  it('always renders three slots so the hover-gallery keeps its columns', () => {
    expect(mountGallery().findAll('figure.hover-gallery > div')).toHaveLength(3)
  })

  it('requests only the visible image before the first hover', () => {
    const wrapper = mountGallery()

    const imgs = wrapper.findAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]!.attributes('src')).toBe(urls[0])
  })

  it('fills in the remaining slots on first hover', async () => {
    const wrapper = mountGallery()

    await wrapper.find('figure').trigger('pointerenter')

    expect(wrapper.findAll('img').map((img) => img.attributes('src'))).toEqual(urls)
  })

  it('builds its slots from the fileId prop', async () => {
    const wrapper = mount(DatasetPreviewGallery, { props: { fileId: '7' } })

    await wrapper.find('figure').trigger('pointerenter')

    expect(wrapper.findAll('img').map((img) => img.attributes('src'))).toEqual(
      buildPreviewImageUrls('7'),
    )
  })

  it('degrades only the failing slot to the placeholder svg', async () => {
    const wrapper = mountGallery()

    await wrapper.find('img').trigger('error')
    await wrapper.find('figure').trigger('pointerenter')

    const slots = wrapper.findAll('figure.hover-gallery > div')
    expect(slots[0]!.html()).toContain('<svg')
    expect(slots[0]!.find('img').exists()).toBe(false)
    expect(slots[1]!.find('img').attributes('src')).toBe(urls[1])
    expect(slots[2]!.find('img').attributes('src')).toBe(urls[2])
  })
})
