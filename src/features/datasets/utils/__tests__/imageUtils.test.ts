import { describe, expect, it, vi } from 'vitest'
import { buildPreviewImageUrl, buildPreviewImageUrls } from '../imageUtils'

// 预览图 base 运行时经 getConfig() 读 config.json 的 oss 块（loadConfig 里有
// 缺省兜底）；单测不走启动链，这里 mock 掉并返回测试环境域名，保持下方断言。
vi.mock('@/shared/config/runtimeConfig', () => ({
  getConfig: () => ({
    oss: { previewImageBase: 'https://kawaru-oss.oss-cn-hangzhou.aliyuncs.com' },
  }),
}))

const BASE = 'https://kawaru-oss.oss-cn-hangzhou.aliyuncs.com'

describe('buildPreviewImageUrl', () => {
  it('joins the backend image_path dir with the slot and the _preview style', () => {
    expect(buildPreviewImageUrl('images/file_42/')).toBe(`${BASE}/images/file_42/preview.jpg_preview`)
  })

  it('normalizes a missing trailing slash on the dir', () => {
    expect(buildPreviewImageUrl('images/file_42')).toBe(buildPreviewImageUrl('images/file_42/'))
  })

  it('returns null for a missing image_path (placeholder, no request)', () => {
    expect(buildPreviewImageUrl(null)).toBeNull()
    expect(buildPreviewImageUrl('')).toBeNull()
    expect(buildPreviewImageUrl(undefined)).toBeNull()
  })

  it('uses an absolute image_path as-is instead of re-prefixing the base', () => {
    expect(buildPreviewImageUrl('https://cdn.example.com/previews/abc123/')).toBe(
      'https://cdn.example.com/previews/abc123/preview.jpg_preview',
    )
  })

  it('builds the UMAP extra slots from the same dir', () => {
    expect(buildPreviewImageUrl('images/file_42/', 'preview_2.jpg')).toBe(
      `${BASE}/images/file_42/preview_2.jpg_preview`,
    )
    expect(buildPreviewImageUrl('images/file_42/', 'preview_3.jpg')).toBe(
      `${BASE}/images/file_42/preview_3.jpg_preview`,
    )
  })
})

describe('buildPreviewImageUrls', () => {
  it('returns the three gallery slots in a fixed order', () => {
    expect(buildPreviewImageUrls('images/file_42/')).toEqual([
      `${BASE}/images/file_42/preview.jpg_preview`,
      `${BASE}/images/file_42/preview_2.jpg_preview`,
      `${BASE}/images/file_42/preview_3.jpg_preview`,
    ])
  })

  it('keeps the first slot identical to the single-image helper', () => {
    expect(buildPreviewImageUrls('images/file_7/')[0]).toBe(buildPreviewImageUrl('images/file_7/'))
  })

  it('yields three null slots when image_path is empty', () => {
    expect(buildPreviewImageUrls(null)).toEqual([null, null, null])
  })
})
