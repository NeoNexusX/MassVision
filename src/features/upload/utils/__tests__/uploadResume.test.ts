import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveUploadSession,
  loadUploadSession,
  hasPendingUpload,
  cleanupResumable,
  resetSessionForReupload,
  type UploadSession,
} from '../uploadResume'

const STORAGE_KEY = 'oss_upload_session'

function makeSession(overrides: Partial<UploadSession> = {}): UploadSession {
  return {
    datasetName: 'Rat_Liver_MALDI_40_Positive_9ce4d1',
    fileHash: 'abc123',
    fileId: '42',
    source: {
      imzmlName: 'rat.imzML',
      imzmlSize: 1000,
      ibdName: 'rat.ibd',
      ibdSize: 5_000_000,
    },
    entryNames: { imzmlName: 'Rat.imzML', ibdName: 'Rat.ibd' },
    ossPath: 'datasets/rat.zip',
    ossBucket: 'bucket',
    ossRegion: 'cn-hangzhou',
    stsExpiration: new Date(Date.now() + 3600_000).toISOString(),
    accessKeyId: 'AK',
    accessKeySecret: 'SK',
    stsToken: 'TOKEN',
    multipart: {
      uploadId: 'UP-1',
      partSize: 8 * 1024 * 1024,
      doneParts: [{ number: 1, etag: '"E1"' }],
    },
    ...overrides,
  }
}

describe('uploadResume session', () => {
  beforeEach(() => localStorage.clear())

  it('存取往返保持完整', () => {
    const session = makeSession()
    saveUploadSession(session)
    expect(loadUploadSession()).toEqual(session)
    expect(hasPendingUpload()).toBe(true)
  })

  it('丢弃旧格式会话（OPFS 缓存 + checkpoint 时代）', () => {
    // 旧版本的形状：有 checkpoint、没有 multipart / source
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        datasetName: 'old',
        fileName: 'old.zip',
        fileSize: 123,
        fileHash: 'h',
        fileId: '1',
        ossPath: 'p',
        checkpoint: { uploadId: 'U', doneParts: [] },
      }),
    )
    expect(loadUploadSession()).toBeNull()
    expect(hasPendingUpload()).toBe(false)
  })

  it('STS 过期的会话不算待续传，并被清掉', () => {
    saveUploadSession(makeSession({ stsExpiration: new Date(Date.now() - 1000).toISOString() }))
    expect(hasPendingUpload()).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('损坏的 JSON 不抛异常', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadUploadSession()).toBeNull()
  })

  it('取消后重置分片进度，但会话仍然可续（保留 file_id 与 STS）', () => {
    saveUploadSession(makeSession())
    resetSessionForReupload()

    const session = loadUploadSession()
    expect(session).not.toBeNull()
    expect(session!.fileId).toBe('42')
    expect(session!.multipart.uploadId).toBe('')
    expect(session!.multipart.doneParts).toEqual([])
    // 片长要留着：续传时必须沿用，否则分片边界对不上
    expect(session!.multipart.partSize).toBe(8 * 1024 * 1024)
    expect(hasPendingUpload()).toBe(true)
  })

  it('cleanupResumable 清掉会话，且在没有 OPFS 的环境下不抛错', async () => {
    saveUploadSession(makeSession())
    await expect(cleanupResumable()).resolves.toBeUndefined()
    expect(loadUploadSession()).toBeNull()
  })
})
