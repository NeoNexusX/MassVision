import { beforeAll, afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

// imageUtils 经 getConfig() 读 config.json 的 oss 块；单测不走启动链，mock 掉
vi.mock('@/shared/config/runtimeConfig', () => ({
  getConfig: () => ({
    oss: { previewImageBase: 'https://kawaru-oss.oss-cn-hangzhou.aliyuncs.com' },
  }),
}))

import CollectionCard from '../CollectionCard.vue'
import type { CollectionSummary } from '../../types/collection'
import { i18n, loadCoreMessages, loadFeatureMessages } from '@/i18n'

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
    access: 'https://example.org/access',
    organismPart: ['Kidney'],
    ionisationSource: ['MALDI'],
    ...over,
  }) as CollectionSummary

/** 造成员 imagePath 列表（封面轮播数据源，与 useCollectionCovers 的缓存值同构） */
const paths = (ids: number[]) => ids.map((id) => `images/file_${id}/`)

const mountCard = (props: Record<string, unknown> = {}) =>
  mount(CollectionCard, {
    props: { collection: collection(), imagePaths: paths([498, 496, 467]), ...props },
    global: { plugins: [i18n], stubs: { SvgIcon: true } },
  })

// jsdom 不做真实布局/滚动：伪造 scrollLeft / clientWidth 后派发 scroll 事件，
// 模拟用户在轮播容器里手动滑动到第 index 帧（0 起）
const fakeSwipe = (wrapper: ReturnType<typeof mountCard>, index: number) => {
  const el = wrapper.get('.carousel').element
  Object.defineProperty(el, 'clientWidth', { value: 260, configurable: true })
  el.scrollLeft = 260 * index
  el.dispatchEvent(new Event('scroll'))
}

// 组件模板用 $t：挂载时装上 i18n 实例，并预先加载英文语言包（断言保持英文原文）
beforeAll(() =>
  Promise.all([
    loadCoreMessages('en'),
    loadFeatureMessages('collections'),
    loadFeatureMessages('datasets'),
  ]),
)

describe('CollectionCard cover carousel', () => {
  // jsdom 未实现 Element.scrollIntoView / scrollTo（组件在箭头与成员重置时调用）：
  // mock 掉并按调用断言「滚到了哪一帧」
  const nativeScrollIntoView = Element.prototype.scrollIntoView
  const nativeScrollTo = Element.prototype.scrollTo

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    Element.prototype.scrollTo = vi.fn()
  })
  afterEach(() => {
    if (nativeScrollIntoView) Element.prototype.scrollIntoView = nativeScrollIntoView
    else delete (Element.prototype as Partial<Element>).scrollIntoView
    if (nativeScrollTo) Element.prototype.scrollTo = nativeScrollTo
    else delete (Element.prototype as Partial<Element>).scrollTo
  })

  const scrollIntoView = () => Element.prototype.scrollIntoView as Mock

  it('mounts member frames in order and caps them at five', () => {
    const wrapper = mountCard({ imagePaths: paths([1, 2, 3, 4, 5, 6, 7]) })

    // 7 个成员只挂前 5 帧（封顶图片请求数），每帧 lazy，帧计数按 5 计
    const imgs = wrapper.findAll('.carousel-item img')
    expect(imgs).toHaveLength(5)
    expect(imgs.every((img) => img.attributes('loading') === 'lazy')).toBe(true)
    expect(imgs[0]!.attributes('src')).toContain('/images/file_1/preview.jpg_preview')
    expect(wrapper.text()).toContain('1/5')
  })

  it('scrolls to the next frame on click and counts up', async () => {
    const wrapper = mountCard()

    await wrapper.get('button[aria-label="Next dataset"]').trigger('click')

    // 点 Next 把第 2 个 carousel-item 滚进视口（mock.contexts 记录 this）
    expect(scrollIntoView().mock.contexts[0]).toBe(wrapper.findAll('.carousel-item')[1]!.element)
    expect(wrapper.text()).toContain('2/3')
  })

  it('wraps around from the first frame to the last on prev', async () => {
    const wrapper = mountCard()

    await wrapper.get('button[aria-label="Previous dataset"]').trigger('click')

    expect(scrollIntoView().mock.contexts[0]).toBe(wrapper.findAll('.carousel-item')[2]!.element)
    expect(wrapper.text()).toContain('3/3')
  })

  it('keeps the indicator in sync with manual swipes without jumping', async () => {
    const wrapper = mountCard()

    fakeSwipe(wrapper, 2)
    await nextTick()

    expect(wrapper.text()).toContain('3/3')
    // 只是手动滑动，不应触发程序化滚动
    expect(scrollIntoView()).not.toHaveBeenCalled()
  })

  it('hides the arrows when there is at most one dataset', () => {
    const wrapper = mountCard({ imagePaths: paths([498]) })

    expect(wrapper.find('button[aria-label="Next dataset"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Previous dataset"]').exists()).toBe(false)
  })

  it('resets to the first frame when the member list changes', async () => {
    const wrapper = mountCard()
    fakeSwipe(wrapper, 1)
    await nextTick()
    expect(wrapper.text()).toContain('2/3')

    await wrapper.setProps({ imagePaths: paths([500, 501]) })

    expect(wrapper.text()).toContain('1/2')
    expect(Element.prototype.scrollTo).toHaveBeenCalledWith({ left: 0 })
  })
})

describe('CollectionCard cover fallbacks', () => {
  it('falls back to the placeholder when members are not loaded yet', () => {
    const wrapper = mountCard({ imagePaths: undefined })

    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('shows a pulsing skeleton instead of the placeholder while covers load', () => {
    const wrapper = mountCard({ imagePaths: undefined, coverLoading: true })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
  })
})

describe('CollectionCard info (left column)', () => {
  it.each([
    'doi:10.1000/abc',
    'doi.org/10.1000/abc',
    'http://dx.doi.org/10.1000/abc',
  ])('resolves accepted DOI input %s without duplicating its prefix', (doi) => {
    const wrapper = mountCard({ collection: collection({ doi: [doi] }) })
    const link = wrapper.get('a[href="https://doi.org/10.1000/abc"]')
    expect(link.text()).toContain(doi)
  })

  it('renders title, DOI link and journal', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain('Human kidney MALDI imaging atlas')
    expect(wrapper.find('a[href="https://doi.org/10.1038/s41586-024-00001-x"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Nature Methods')
  })

  it('keeps the Title row with an em dash when the title is missing', () => {
    // 卡片高度靠 Title 行恒定（无值不塌陷）
    const wrapper = mountCard({ collection: collection({ title: null }) })

    expect(wrapper.text()).toContain('Title')
    expect(wrapper.text()).not.toContain('Human kidney MALDI imaging atlas')
    expect(wrapper.findAll('p').filter((p) => p.text() === '—').length).toBeGreaterThan(0)
  })

  it('renders the access entry as an external link', () => {
    const wrapper = mountCard()

    const link = wrapper.get('a[href="https://example.org/access"]')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
    expect(link.text()).toContain('https://example.org/access')
    // Access 已收进中栏左列，右栏不再有第二个入口
    expect(
      wrapper.findAll('a').filter((a) => a.text().includes('https://example.org/access')),
    ).toHaveLength(1)
  })

  it('renders a non-URL access entry without an href', () => {
    const wrapper = mountCard({ collection: collection({ access: 'On request' }) })

    const entry = wrapper.findAll('a').find((a) => a.text().includes('On request'))!
    expect(entry.attributes('href')).toBeUndefined()
  })

  it('keeps the Access row with an em dash when the field is empty', () => {
    const wrapper = mountCard({ collection: collection({ access: null }) })

    expect(wrapper.text()).toContain('Access')
    expect(wrapper.findAll('a').some((a) => a.text().includes('Access'))).toBe(false)
  })
})

describe('CollectionCard info (right column)', () => {
  it('always shows the three field names, empty ones included', () => {
    const wrapper = mountCard()

    for (const label of ['Organism', 'Organism Part', 'Ionisation Source']) {
      expect(wrapper.text()).toContain(label)
    }
    expect(wrapper.text()).toContain('MALDI')
  })

  it('caps each field at two values and tucks the rest into More', () => {
    const wrapper = mountCard({
      collection: collection({
        organism: ['Human', 'Mouse', 'Rat'],
        organismPart: ['Kidney'],
      }),
    })

    // 常显区只有前两个 Organism 值
    expect(wrapper.text()).toContain('Human')
    expect(wrapper.text()).toContain('Mouse')

    const popover = wrapper.get('[popover]')
    expect(popover.text()).toContain('Rat')
    expect(popover.text()).not.toContain('Human')
    // 没超出的字段不进悬浮窗
    expect(popover.text()).not.toContain('Kidney')
    expect(wrapper.get('button[aria-label^="More metadata"]').text()).toContain('(+1)')
  })

  it('hides the More button when no field overflows', () => {
    const wrapper = mountCard()

    expect(wrapper.find('button[aria-label^="More metadata"]').exists()).toBe(false)
    expect(wrapper.find('[popover]').exists()).toBe(false)
  })

  it('wires the More button to the popover and keeps ids unique per card', () => {
    const wrapper = mountCard({
      collection: collection({ organism: ['Human', 'Mouse', 'Rat'] }),
    })

    const button = wrapper.get('button[aria-label^="More metadata"]')
    expect(button.attributes('popovertarget')).toBe('collection-1-more-metadata')
    expect(wrapper.get('[popover]').attributes('id')).toBe('collection-1-more-metadata')
    expect(wrapper.get('[popover]').attributes('role')).toBe('dialog')
  })

  it('binds an explicit anchor so the panel stays put while fading out', () => {
    // 不给显式锚点时，popover 关闭瞬间会失去隐式锚点，position-area 失效，
    // 面板会掉到视口左上角闪一下内容（真机 Chromium 实测）。两条 style 必须成对存在。
    const wrapper = mountCard({
      collection: collection({ organism: ['Human', 'Mouse', 'Rat'] }),
    })

    const buttonStyle = wrapper.get('button[aria-label^="More metadata"]').attributes('style') ?? ''
    const popStyle = wrapper.get('[popover]').attributes('style') ?? ''
    const anchorName = buttonStyle.match(/anchor-name:\s*([^;]+)/)?.[1]?.trim()

    expect(anchorName).toBeTruthy()
    expect(popStyle).toContain(`position-anchor: ${anchorName}`)
  })

  it('falls back to a dash for empty values in both columns', () => {
    const wrapper = mountCard({
      collection: collection({
        title: null,
        doi: [],
        access: null,
        journalName: null,
        organism: [],
        organismPart: [],
        ionisationSource: [],
      }),
    })

    // 左列 4 行 + 右列 3 行（字段名恒显示，空值也算一行）
    expect(wrapper.findAll('*').filter((n) => n.text() === '—').length).toBeGreaterThanOrEqual(7)
  })
})
