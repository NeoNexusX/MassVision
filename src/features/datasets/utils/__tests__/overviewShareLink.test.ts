import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  buildOverviewShareUrl,
  buildPublicFileShareUrl,
  decodeLegacyShareId,
  isValidPublicId,
  resolveShareToken,
} from '../overviewShareLink'

// 只复刻分享链接用到的那两条路由（与 router/index.ts 的 '/s/:shareToken'、
// '/files/:publicId' 一致），避免为一个纯函数拉起整个应用路由表。
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/s/:shareToken', name: 'SharedDatasetOverview', component: { template: '<div/>' } },
    { path: '/files/:publicId', name: 'PublicFile', component: { template: '<div/>' } },
  ],
})

describe('isValidPublicId', () => {
  it('accepts exactly 16 alphanumeric chars', () => {
    expect(isValidPublicId('aBcDeFgHiJkLmNoP')).toBe(true)
    expect(isValidPublicId('0123456789abcdef')).toBe(true)
  })

  it('rejects wrong length, symbols, and non-strings', () => {
    for (const bad of ['', 'aBcDeFgHiJkLmNo', 'aBcDeFgHiJkLmNoPQ', 'aBcDeFgHiJkLmNo-', 42, null]) {
      expect(isValidPublicId(bad)).toBe(false)
    }
  })
})

describe('decodeLegacyShareId', () => {
  it('decodes URL-safe base64 numeric ids from historical links', () => {
    expect(decodeLegacyShareId('MQ')).toBe('1')
    expect(decodeLegacyShareId('NDI')).toBe('42')
  })

  it('rejects segments that are not canonical base64 of a positive integer', () => {
    for (const bad of ['', 'a/b', 'aa=', '@@', btoa('abc'), btoa('0'), btoa('1.5')]) {
      expect(decodeLegacyShareId(bad)).toBeNull()
    }
  })
})

describe('resolveShareToken', () => {
  it('treats a 16-char alphanumeric token as a public id (new links)', () => {
    expect(resolveShareToken('aBcDeFgHiJkLmNoP')).toEqual({
      kind: 'publicId',
      value: 'aBcDeFgHiJkLmNoP',
    })
  })

  it('treats canonical base64 numeric tokens as legacy ids (historical links)', () => {
    expect(resolveShareToken('NDI')).toEqual({ kind: 'legacyId', value: '42' })
    expect(resolveShareToken('MQ')).toEqual({ kind: 'legacyId', value: '1' })
  })

  it('prefers the legacy reading for a token that canonically encodes 12 digits', () => {
    // round-trip 判别的既定行为：这类串按 legacy 处理。
    // 真实 16 位 publicId 恰好命中 canonical base64-of-digits 的概率约 1e-19。
    expect(resolveShareToken('MTIzNDU2Nzg5MDEy')).toEqual({
      kind: 'legacyId',
      value: '123456789012',
    })
  })

  it('returns null for anything else — 无效链接直接渲染错误态，不发请求', () => {
    for (const bad of ['', 'abc', 'aBcDeFgHiJkLmNo', 'aBcDeFgHiJkLmNoPQ', 'aBcDeFgHi$JkLmNo']) {
      expect(resolveShareToken(bad)).toBeNull()
    }
  })
})

describe('buildOverviewShareUrl', () => {
  it('builds an absolute /s/<publicId> link on the current origin', () => {
    expect(buildOverviewShareUrl(router, 'aBcDeFgHiJkLmNoP', 'https://massvision.example')).toBe(
      'https://massvision.example/s/aBcDeFgHiJkLmNoP',
    )
  })

  it('returns null for a value that is not a 16-char public id', () => {
    expect(buildOverviewShareUrl(router, '42', 'https://massvision.example')).toBeNull()
    expect(
      buildOverviewShareUrl(router, 'not-a-public-id', 'https://massvision.example'),
    ).toBeNull()
  })
})

describe('buildPublicFileShareUrl', () => {
  it('builds an absolute /files/<publicId> link on the current origin', () => {
    expect(buildPublicFileShareUrl(router, 'aB3xK9mPq2Lz7Rf1', 'https://massvision.example')).toBe(
      'https://massvision.example/files/aB3xK9mPq2Lz7Rf1',
    )
  })

  it('returns null for a missing or malformed publicId', () => {
    for (const bad of ['', null, undefined, 'a b', 'a/b', '还測']) {
      expect(buildPublicFileShareUrl(router, bad, 'https://massvision.example')).toBeNull()
    }
  })
})
