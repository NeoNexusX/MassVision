import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  buildOverviewShareUrl,
  buildPublicFileShareUrl,
  decodeOverviewFileId,
  encodeOverviewFileId,
} from '../overviewShareLink'

// 只复刻分享链接用到的那两条路由（与 router/index.ts 的 '/s/:encodedId'、
// '/files/:publicId' 一致），避免为一个纯函数拉起整个应用路由表。
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/s/:encodedId', name: 'SharedDatasetOverview', component: { template: '<div/>' } },
    { path: '/files/:publicId', name: 'PublicFile', component: { template: '<div/>' } },
  ],
})

describe('encodeOverviewFileId', () => {
  it('encodes a positive id as URL-safe base64 without padding', () => {
    expect(encodeOverviewFileId(1)).toBe('MQ')
    expect(encodeOverviewFileId('42')).toBe('NDI')
    expect(encodeOverviewFileId(42)).toBe(encodeOverviewFileId('42'))
  })

  it('never emits characters that need escaping in a path segment', () => {
    for (let id = 1; id <= 2000; id++) {
      expect(encodeOverviewFileId(id)).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('rejects anything that is not a positive integer id', () => {
    for (const bad of ['0', '-1', '1.5', '01', '', 'abc', '1 ']) {
      expect(encodeOverviewFileId(bad)).toBeNull()
    }
  })
})

describe('decodeOverviewFileId', () => {
  it('round-trips every encoded id', () => {
    for (const id of ['1', '9', '42', '100', '99999', '1234567890']) {
      expect(decodeOverviewFileId(encodeOverviewFileId(id)!)).toBe(id)
    }
  })

  it('rejects an empty or malformed segment', () => {
    for (const bad of ['', 'a/b', 'aa=', '@@']) {
      expect(decodeOverviewFileId(bad)).toBeNull()
    }
  })

  it('rejects base64 that does not decode to a positive integer', () => {
    expect(decodeOverviewFileId(btoa('abc'))).toBeNull()
    expect(decodeOverviewFileId(btoa('0'))).toBeNull()
    expect(decodeOverviewFileId(btoa('-1').replace(/=+$/, ''))).toBeNull()
  })
})

describe('buildOverviewShareUrl', () => {
  it('builds an absolute /s/<encodedId> link on the current origin', () => {
    expect(buildOverviewShareUrl(router, 42, 'https://massvision.example')).toBe(
      'https://massvision.example/s/NDI',
    )
  })

  it('returns null for an id that cannot be shared', () => {
    expect(buildOverviewShareUrl(router, 'not-an-id', 'https://massvision.example')).toBeNull()
  })
})

describe('buildPublicFileShareUrl', () => {
  it('builds an absolute /files/<publicId> link on the current origin', () => {
    expect(
      buildPublicFileShareUrl(router, 'aB3xK9mPq2Lz7Rf1', 'https://massvision.example'),
    ).toBe('https://massvision.example/files/aB3xK9mPq2Lz7Rf1')
  })

  it('returns null for a missing or malformed publicId', () => {
    for (const bad of ['', null, undefined, 'a b', 'a/b', '还測']) {
      expect(buildPublicFileShareUrl(router, bad, 'https://massvision.example')).toBeNull()
    }
  })
})
