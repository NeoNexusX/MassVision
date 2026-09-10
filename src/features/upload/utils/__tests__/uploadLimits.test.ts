import { describe, it, expect } from 'vitest'
import { OSS_UPLOAD } from '@/shared/config'
import { tooLargeMessage, uploadImzmlZipFileOSS } from '../imzmlOssUpload'

const GB = 1024 ** 3
/** 只需要 size：超限判断在读取任何文件内容之前就发生 */
const fakeFile = (size: number, name: string) => ({ size, name }) as File
const pair = (totalBytes: number) => ({
  imzml: fakeFile(1024, 'a.imzML'),
  ibd: fakeFile(totalBytes - 1024, 'a.ibd'),
  baseName: 'a',
})

describe('上传体积上限', () => {
  it('策略上限必须小于 partSize × maxPartCount 的物理上限', () => {
    const physical = OSS_UPLOAD.partSize * OSS_UPLOAD.maxPartCount
    expect(OSS_UPLOAD.maxUploadBytes).toBeLessThan(physical)
  })

  it('上限就是 100GB，按源文件之和计', () => {
    expect(OSS_UPLOAD.maxUploadBytes).toBe(100 * GB)
  })

  it('超限时在读取文件之前就抛错', async () => {
    await expect(
      uploadImzmlZipFileOSS({ files: pair(101 * GB), onProgress: () => {} }),
    ).rejects.toThrow(/too large/i)
  })

  it('恰好等于上限时不拦', async () => {
    // 不该是超限错误；后续会因为没有真实后端而以别的方式失败
    const err = await uploadImzmlZipFileOSS({ files: pair(100 * GB) }).catch((e: unknown) => e)
    expect(String((err as Error)?.message ?? '')).not.toMatch(/too large/i)
  })

  it('文案同时给出实际大小和上限', () => {
    const msg = tooLargeMessage(120 * GB)
    expect(msg).toContain('120.0 GB')
    expect(msg).toContain('100.0 GB')
  })
})
