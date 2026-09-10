import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { openMultipartSession, normalizeEtag } from '../ossMultipart'
import { makeAbortReason, abortIntentOf } from '../uploadAbort'
import { OSS_UPLOAD } from '@/shared/config'

type OssClient = Parameters<typeof openMultipartSession>[0]

/** 只实现被用到的几个方法；调用处再断言成 OSS 类型 */
function fakeClient(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  return {
    initMultipartUpload: vi.fn().mockResolvedValue({ uploadId: 'UP-1', bucket: 'b', name: 'n' }),
    uploadPart: vi
      .fn()
      .mockImplementation((_name: string, _uploadId: string, partNo: number) =>
        Promise.resolve({ etag: `"ETAG-${partNo}"`, res: { status: 200, headers: {} } }),
      ),
    completeMultipartUpload: vi.fn().mockResolvedValue({}),
    abortMultipartUpload: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

const asOss = (client: ReturnType<typeof fakeClient>) => client as unknown as OssClient
const oneByte = () => new Blob([new Uint8Array(1)])

describe('normalizeEtag', () => {
  it('去掉引号并统一大小写', () => {
    expect(normalizeEtag('"d41d8cd98f00b204e9800998ecf8427e"')).toBe(
      'D41D8CD98F00B204E9800998ECF8427E',
    )
    expect(normalizeEtag('D41D8CD98F00B204E9800998ECF8427E')).toBe(
      normalizeEtag('"d41d8cd98f00b204e9800998ecf8427e"'),
    )
  })
})

describe('openMultipartSession', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('新会话会 init 一次并记录 uploadId', async () => {
    const client = fakeClient()
    const mp = await openMultipartSession(asOss(client), 'path/to.zip')
    expect(mp.uploadId).toBe('UP-1')
    expect(client.initMultipartUpload).toHaveBeenCalledTimes(1)
  })

  it('续传时接续已有 uploadId，不重新 init', async () => {
    const client = fakeClient()
    const mp = await openMultipartSession(asOss(client), 'path/to.zip', {
      uploadId: 'UP-OLD',
      doneParts: [{ number: 1, etag: '"E1"' }],
    })
    expect(mp.uploadId).toBe('UP-OLD')
    expect(client.initMultipartUpload).not.toHaveBeenCalled()
    expect(mp.doneParts).toEqual([{ number: 1, etag: '"E1"' }])
  })

  it('单片失败会重试，成功后记录 ETag', async () => {
    let calls = 0
    const client = fakeClient({
      uploadPart: vi.fn().mockImplementation(() => {
        calls++
        if (calls < 3) return Promise.reject(new Error('ECONNRESET'))
        return Promise.resolve({ etag: '"E7"', res: { status: 200, headers: {} } })
      }),
    })
    const mp = await openMultipartSession(asOss(client), 'p')
    const uploading = mp.uploadPart(7, oneByte())
    await vi.runAllTimersAsync() // 跳过重试退避
    await uploading

    expect(calls).toBe(3)
    expect(mp.doneParts).toEqual([{ number: 7, etag: '"E7"' }])
  })

  it('重试耗尽后抛出带分片号的错误', async () => {
    const client = fakeClient({
      uploadPart: vi.fn().mockRejectedValue(new Error('503 Service Unavailable')),
    })
    const mp = await openMultipartSession(asOss(client), 'p')
    const settled = mp.uploadPart(3, oneByte()).catch((err: unknown) => err)
    await vi.runAllTimersAsync()

    const err = await settled
    expect((err as Error).message).toMatch(
      /OSS part 3 failed after \d+ attempts: 503 Service Unavailable/,
    )
    expect(client.uploadPart).toHaveBeenCalledTimes(OSS_UPLOAD.partRetries + 1)
  })

  it('用户中止不重试，立刻抛出', async () => {
    const client = fakeClient({
      uploadPart: vi.fn().mockRejectedValue(new DOMException('User Aborted', 'AbortError')),
    })
    const mp = await openMultipartSession(asOss(client), 'p')
    const err = await mp.uploadPart(1, oneByte()).catch((e: unknown) => e)

    expect((err as Error).name).toBe('AbortError')
    expect(client.uploadPart).toHaveBeenCalledTimes(1)
  })

  it('按完成顺序原样提交，不自行排序（排序与去重由 ali-oss 内部负责）', async () => {
    const client = fakeClient()
    const mp = await openMultipartSession(asOss(client), 'p')
    // 故意乱序完成，模拟并发上传
    await mp.uploadPart(3, oneByte())
    await mp.uploadPart(1, oneByte())
    await mp.uploadPart(2, oneByte())
    await mp.complete()

    const parts = client.completeMultipartUpload.mock.calls[0]![2] as Array<{ number: number }>
    expect(parts.map((p) => p.number)).toEqual([3, 1, 2])
    // 且传的就是内部那份账本本身，ali-oss 只读不改（它内部 concat 出副本再排）
    expect(parts).toBe(mp.doneParts)
  })

  it('整片按 [0, blob.size) 提交（分片已切好，不让 ali-oss 二次切）', async () => {
    const client = fakeClient()
    const mp = await openMultipartSession(asOss(client), 'p')
    const blob = new Blob([new Uint8Array(4096)])
    await mp.uploadPart(1, blob)

    const [, , , passedBlob, start, end] = client.uploadPart.mock.calls[0]!
    expect(passedBlob).toBe(blob)
    expect(start).toBe(0)
    expect(end).toBe(4096)
  })
})

describe('重试上报与中止', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('每次重试都上报分片号、次数与原因，恢复后以 null 清除告警', async () => {
    let calls = 0
    const onRetry = vi.fn()
    const client = fakeClient({
      uploadPart: vi.fn().mockImplementation(() => {
        calls++
        if (calls < 3) return Promise.reject(new Error('ECONNRESET'))
        return Promise.resolve({ etag: '"E7"', res: { status: 200, headers: {} } })
      }),
    })
    const mp = await openMultipartSession(asOss(client), 'p', undefined, { onRetry })
    const uploading = mp.uploadPart(7, oneByte())
    await vi.runAllTimersAsync()
    await uploading

    expect(onRetry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ partNo: 7, attempt: 1, reason: 'ECONNRESET' }),
    )
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.objectContaining({ partNo: 7, attempt: 2 }))
    // 恢复后必须显式清除，否则告警会一直挂在界面上
    expect(onRetry).toHaveBeenLastCalledWith(null)
  })

  it('一次成功的分片不产生任何重试上报', async () => {
    const onRetry = vi.fn()
    const client = fakeClient()
    const mp = await openMultipartSession(asOss(client), 'p', undefined, { onRetry })
    await mp.uploadPart(1, oneByte())
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('中止会打断退避等待，不再发起后续尝试', async () => {
    const controller = new AbortController()
    const client = fakeClient({
      uploadPart: vi.fn().mockRejectedValue(new Error('ECONNRESET')),
    })
    const mp = await openMultipartSession(asOss(client), 'p', undefined, {
      signal: controller.signal,
    })
    const settled = mp.uploadPart(1, oneByte()).catch((e: unknown) => e)

    // 让第一次尝试失败并进入退避等待
    await vi.advanceTimersByTimeAsync(0)
    expect(client.uploadPart).toHaveBeenCalledTimes(1)

    controller.abort(makeAbortReason('user-cancel'))
    const err = await settled

    // 意图必须原样传出来，pipeline 的 catch 靠它决定怎么处置会话
    expect(abortIntentOf(err)).toBe('user-cancel')
    expect(client.uploadPart).toHaveBeenCalledTimes(1)
  })

  it('中止后完成的分片不记入 doneParts', async () => {
    const controller = new AbortController()
    const client = fakeClient({
      uploadPart: vi.fn().mockImplementation(() => {
        // 请求已经在飞：ali-oss 打不断它，但它的结果不该被记账
        controller.abort(makeAbortReason('user-cancel'))
        return Promise.resolve({ etag: '"E9"', res: { status: 200, headers: {} } })
      }),
    })
    const mp = await openMultipartSession(asOss(client), 'p', undefined, {
      signal: controller.signal,
    })
    const err = await mp.uploadPart(9, oneByte()).catch((e: unknown) => e)

    expect(abortIntentOf(err)).toBe('user-cancel')
    expect(mp.doneParts).toEqual([])
  })

  it('中止前已发出的信号会让新分片立刻放弃', async () => {
    const controller = new AbortController()
    controller.abort(makeAbortReason('user-cancel'))
    const client = fakeClient()
    const mp = await openMultipartSession(asOss(client), 'p', undefined, {
      signal: controller.signal,
    })
    const err = await mp.uploadPart(1, oneByte()).catch((e: unknown) => e)

    expect(abortIntentOf(err)).toBe('user-cancel')
    expect(client.uploadPart).not.toHaveBeenCalled()
  })
})
