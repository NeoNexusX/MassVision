import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 上传链路 ali-oss 客户端构造参数的「捕获」测试。
 *
 * 上传地址不是后端下发的完整 URL，而是 ali-oss 在前端用
 * bucket + endpoint + oss_path 拼出来的。endpoint 来自
 * VITE_OSS_ENDPOINT（裸域名，不带协议），此时 ali-oss 按 secure
 * 决定协议——不设置就回退 http://，产生
 * http://kawaru-oss.oss-accelerate.aliyuncs.com/... 的 mixed-content
 * 隐患（下载端 ossClient.ts 一直显式 secure: true，此处对齐）。
 *
 * 本测试 mock ali-oss 并捕获 new OSS(options)，断言上传客户端带上
 * secure: true 且裸域名 endpoint 原样透传——这就是上传走 https 的充分条件。
 * 上传本体已迁移为流式分片（ossMultipart.openMultipartSession），此处一并
 * mock 掉，只验证会话建立在后端下发的 oss_path 与刚构造的客户端上。
 */

// vi.mock 工厂会被提升到 import 之前执行，捕获容器必须用 vi.hoisted 创建。
const capture = vi.hoisted(() => ({
  /** 每次 new OSS() 的构造参数快照 */
  clientOptions: [] as Array<Record<string, unknown>>,
  /** 每次 new OSS() 的实例（断言传给 openMultipartSession 的就是它） */
  instances: [] as unknown[],
  /** ENV.ossEndpoint 的当前值（getter 让测试分别验证有/无 endpoint 两个分支） */
  envEndpoint: 'oss-accelerate.aliyuncs.com',
  /** openMultipartSession 的 mock（resolve 即视为分片会话建立） */
  openMultipartSession: vi.fn(),
  /** /files/upload 返回的 OSS 凭据 */
  ossData: {
    oss_sts_token: {
      AccessKeyId: 'ak',
      AccessKeySecret: 'sk',
      SecurityToken: 'sts-token',
      Expiration: '2099-01-01T00:00:00Z',
    },
    oss_bucket: 'kawaru-oss',
    oss_path: 'data/479/24b0e2258fe95b7723f6587d92e38c26.zip',
    oss_region_id: 'cn-hangzhou',
  },
}))

vi.mock('ali-oss', () => ({
  default: class OSS {
    constructor(options: Record<string, unknown>) {
      capture.clientOptions.push(options)
      capture.instances.push(this)
    }
  },
}))

vi.mock('../ossMultipart', () => ({
  openMultipartSession: capture.openMultipartSession,
  normalizeEtag: (etag: string) => etag,
}))

vi.mock('@/shared/config', () => ({
  ENV: {
    get ossEndpoint() {
      return capture.envEndpoint
    },
  },
  OSS_UPLOAD: {
    timeout: 30000,
    partSize: 16 * 1024 * 1024,
    maxPartCount: 9999,
    maxInFlightParts: 4,
    maxUploadBytes: 100 * 1024 * 1024 * 1024,
    checkpointSaveIntervalMs: 5000,
  },
}))

vi.mock('@/shared/api/httpClient', () => ({
  auth_api: {
    post: vi.fn(async (url: string) => {
      if (url.endsWith('/files/preflight')) return { data: { file_id: 479, is_reuse: false } }
      if (url.endsWith('/files/upload')) return { data: capture.ossData }
      throw new Error(`unexpected POST: ${url}`)
    }),
  },
}))

vi.mock('../imzmlCompress', () => ({
  prepareUpload: vi.fn(async () => ({
    fileHash: '24b0e2258fe95b7723f6587d92e38c26',
    dispose: vi.fn(),
    startCompress: vi.fn(async () => new File([new ArrayBuffer(1024)], 'dataset.zip')),
  })),
}))

vi.mock('../uploadResume', () => ({
  saveUploadSession: vi.fn(),
  loadUploadSession: vi.fn(() => null),
  cleanupResumable: vi.fn(async () => {}),
  resetSessionForReupload: vi.fn(),
}))

vi.mock('../filenameGenerator', () => ({
  generateDatasetFilename: vi.fn(() => 'mass_dataset'),
}))

import { uploadImzmlZipFileOSS } from '../imzmlOssUpload'

const filePair = {
  imzml: new File([new ArrayBuffer(8)], 'a.imzML'),
  ibd: new File([new ArrayBuffer(16)], 'a.ibd'),
  baseName: 'a',
}

async function runUpload() {
  return uploadImzmlZipFileOSS({ files: filePair })
}

beforeEach(() => {
  capture.clientOptions.length = 0
  capture.instances.length = 0
  capture.openMultipartSession.mockReset().mockResolvedValue({
    uploadId: 'upload-id-1',
    doneParts: [],
    uploadPart: vi.fn(async () => {}),
    complete: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  })
  capture.envEndpoint = 'oss-accelerate.aliyuncs.com'
})

describe('uploadImzmlZipFileOSS → ali-oss client construction', () => {
  it('sets secure:true so a bare-domain endpoint resolves to https', async () => {
    await runUpload()

    expect(capture.clientOptions).toHaveLength(1)
    const opts = capture.clientOptions[0]!

    // 本次修复的核心断言：裸域名 endpoint 下不设 secure 会回退 http://
    expect(opts.secure).toBe(true)
    expect(opts.endpoint).toBe('oss-accelerate.aliyuncs.com')
    expect(opts.bucket).toBe('kawaru-oss')
    expect(opts.region).toBe('oss-cn-hangzhou')
    expect(opts.stsToken).toBe('sts-token')
    expect(opts.authorizationV4).toBe(true)
  })

  it('opens the multipart session on the backend-provided oss_path', async () => {
    await runUpload()

    expect(capture.openMultipartSession).toHaveBeenCalledTimes(1)
    const [client, ossPath, resumeInfo] = capture.openMultipartSession.mock.calls[0]!
    // 上传目标就是后端下发的 oss_path；全新上传不携带续传信息
    expect(ossPath).toBe('data/479/24b0e2258fe95b7723f6587d92e38c26.zip')
    expect(resumeInfo).toBeUndefined()
    // 分片会话用的正是刚构造出来的 ali-oss 客户端
    expect(client).toBe(capture.instances[0])
  })

  it('omits endpoint when VITE_OSS_ENDPOINT is empty (region-based URL)', async () => {
    capture.envEndpoint = ''
    await runUpload()

    const opts = capture.clientOptions[0]!
    expect(opts).not.toHaveProperty('endpoint')
    expect(opts.secure).toBe(true)
  })
})
