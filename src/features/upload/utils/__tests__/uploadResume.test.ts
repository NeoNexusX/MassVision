import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/config', () => ({
  OSS_UPLOAD: { zipFormatVersion: 3, compressIbd: true },
}))

import {
  cleanupResumable,
  loadUploadSession,
  saveUploadSession,
  type UploadSession,
} from '../uploadResume'

const V2_KEY = 'oss_upload_session_v2'
const LEGACY_KEY = 'oss_upload_session'

const validSession = (): UploadSession => ({
  datasetName: 'ds',
  fileHash: 'h',
  filePublicId: 'qW3rT5yU7iO9pA1s',
  zipFormatVersion: 3,
  compressIbd: true,
  source: { imzmlName: 'a.imzML', imzmlSize: 1, ibdName: 'a.ibd', ibdSize: 1 },
  entryNames: { imzmlName: 'a.imzML', ibdName: 'a.ibd' },
  ossPath: 'oss/path',
  ossBucket: 'b',
  ossRegion: 'r',
  stsExpiration: '2999-01-01T00:00:00Z',
  accessKeyId: 'k',
  accessKeySecret: 's',
  stsToken: 't',
  multipart: { uploadId: 'u', partSize: 8, doneParts: [] },
})

beforeEach(() => {
  localStorage.clear()
})

describe('uploadResume public_id migration', () => {
  it('round-trips a v2 session keyed by filePublicId', () => {
    saveUploadSession(validSession())
    expect(loadUploadSession()).toEqual(validSession())
  })

  it('rejects a v2 session that lost its filePublicId', () => {
    const broken: Partial<UploadSession> = { ...validSession() }
    delete broken.filePublicId
    localStorage.setItem(V2_KEY, JSON.stringify(broken))

    expect(loadUploadSession()).toBeNull()
  })

  it('discards and purges legacy sessions stored under the old key with numeric fileId', () => {
    // 旧会话只有数字 fileId，无法推导出 publicId：只清理，不迁移
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ ...validSession(), fileId: 42 }))

    expect(loadUploadSession()).toBeNull()
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('cleanupResumable clears both keys', async () => {
    localStorage.setItem(V2_KEY, JSON.stringify(validSession()))
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ fileId: 42 }))

    await cleanupResumable()

    expect(localStorage.getItem(V2_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })
})
