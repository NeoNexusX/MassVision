import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// imageUtils 经 getConfig() 读 config.json 的 oss 块；单测不走启动链，mock 掉
vi.mock('@/shared/config/runtimeConfig', () => ({
  getConfig: () => ({
    oss: { previewImageBase: 'https://kawaru-oss.oss-cn-hangzhou.aliyuncs.com' },
  }),
}))

import CollectionCard from '../CollectionCard.vue'
import type { CollectionSummary } from '../../types/collection'

const collection = (over: Partial<CollectionSummary> = {}): CollectionSummary =>
  ({
    id: 1,
    name: 'Human Kidney Atlas',
    title: 'Human kidney MALDI imaging atlas',
    description: null,
    memberCount: 3,
    totalSize: 0,
    ownerUsername: 'lyk',
    organism: ['Human (Homo sapiens)'],
    createdAt: null,
    updatedAt: '2026-09-09T00:00:00',
    publicId: null,
    doi: ['10.1038/s41586-024-00001-x'],
    journalName: 'Nature Methods',
    access: ['https://example.org/access'],
    organismPart: ['Kidney'],
    ionisationSource: ['MALDI'],
    ...over,
  }) as CollectionSummary

const mountCard = (props: Record<string, unknown> = {}) =>
  mount(CollectionCard, {
    props: { collection: collection(), memberIds: [498, 496, 467], ...props },
    global: { stubs: { SvgIcon: true } },
  })

const coverSrc = (wrapper: ReturnType<typeof mountCard>) =>
  wrapper.find('img').attributes('src') ?? ''

describe('CollectionCard cover carousel', () => {
  it('shows the first member’s preview image by default', () => {
    expect(coverSrc(mountCard())).toContain('/images/file_498/preview.jpg_preview')
  })

  it('advances to the next dataset on click and wraps around', async () => {
    const wrapper = mountCard()

    await wrapper.get('button[aria-label="Next dataset"]').trigger('click')
    expect(coverSrc(wrapper)).toContain('/images/file_496/preview.jpg_preview')
    expect(wrapper.text()).toContain('2/3')

    await wrapper.get('button[aria-label="Next dataset"]').trigger('click')
    await wrapper.get('button[aria-label="Next dataset"]').trigger('click')
    // 第三张再点一次回到第一张
    expect(coverSrc(wrapper)).toContain('/images/file_498/preview.jpg_preview')
  })

  it('goes back from the first slide to the last', async () => {
    const wrapper = mountCard()

    await wrapper.get('button[aria-label="Previous dataset"]').trigger('click')

    expect(coverSrc(wrapper)).toContain('/images/file_467/preview.jpg_preview')
    expect(wrapper.text()).toContain('3/3')
  })

  it('hides the arrows when there is at most one dataset', () => {
    const wrapper = mountCard({ memberIds: [498] })

    expect(wrapper.find('button[aria-label="Next dataset"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Previous dataset"]').exists()).toBe(false)
  })

  it('falls back to the placeholder when members are not loaded yet', () => {
    const wrapper = mountCard({ memberIds: undefined })

    expect(wrapper.find('img').exists()).toBe(false)
  })
})

describe('CollectionCard info', () => {
  it('renders title, DOI link and journal', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain('Human kidney MALDI imaging atlas')
    expect(wrapper.find('a[href="https://doi.org/10.1038/s41586-024-00001-x"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Nature Methods')
  })

  it('renders the basic fields and falls back to a dash when empty', () => {
    const wrapper = mountCard()

    for (const label of ['Organism', 'Organism Part', 'Ionisation Source']) {
      expect(wrapper.text()).toContain(label)
    }
    expect(wrapper.text()).toContain('Kidney')

    const empty = mountCard({
      collection: collection({ organism: [], organismPart: [], ionisationSource: [] }),
    })
    expect(empty.findAll('div').filter((d) => d.text() === '—').length).toBeGreaterThanOrEqual(3)
  })

  it('renders the access entry as an external link', () => {
    const wrapper = mountCard()

    const link = wrapper.get('a[href="https://example.org/access"]')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
    expect(link.text()).toContain('Access')
  })

  it('renders a non-URL access entry without an href', () => {
    const wrapper = mountCard({ collection: collection({ access: ['On request'] }) })

    const entry = wrapper.findAll('a').find((a) => a.text().includes('Access'))!
    expect(entry.attributes('href')).toBeUndefined()
  })

  it('hides the access block when the field is empty', () => {
    const wrapper = mountCard({ collection: collection({ access: [] }) })

    expect(wrapper.findAll('a').some((a) => a.text().includes('Access'))).toBe(false)
  })
})
