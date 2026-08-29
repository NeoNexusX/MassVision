import { describe, expect, it, vi } from 'vitest'
import { buildPreviewImageUrl, buildPreviewImageUrls } from '../imageUtils'

// 预览图 base 运行时经 getConfig() 读 config.json 的 oss 块（loadConfig 里有
// 缺省兜底）；单测不走启动链，这里 mock 掉并返回测试环境域名，保持下方断言。
vi.mock('@/shared/config/runtimeConfig', () => ({
  getConfig: () => ({
    oss: { previewImageBase: 'https://kawaru-oss.oss-cn-hangzhou.aliyuncs.com' },
  }),
}))

const PREFIX = 'https://kawaru-oss.oss-cn-hangzhou.aliyuncs.com/images'

describe('buildPreviewImageUrl', () => {
  it('points at the public OSS path with the _preview style suffix', () => {
    expect(buildPreviewImageUrl('42')).toBe(`${PREFIX}/file_42/preview.jpg_preview`)
  })

  it('accepts numeric ids as well as string ids', () => {
    expect(buildPreviewImageUrl(42)).toBe(buildPreviewImageUrl('42'))
  })
})

describe('buildPreviewImageUrls', () => {
  it('returns the three gallery slots in a fixed order', () => {
    expect(buildPreviewImageUrls('42')).toEqual([
      `${PREFIX}/file_42/preview.jpg_preview`,
      `${PREFIX}/file_42/preview_2.jpg_preview`,
      `${PREFIX}/file_42/preview_3.jpg_preview`,
    ])
  })

  it('keeps the first slot identical to the single-image helper', () => {
    expect(buildPreviewImageUrls('7')[0]).toBe(buildPreviewImageUrl('7'))
  })

  it('scopes every slot to the same dataset folder', () => {
    for (const url of buildPreviewImageUrls(7)) {
      expect(url.startsWith(`${PREFIX}/file_7/`)).toBe(true)
    }
  })
})
