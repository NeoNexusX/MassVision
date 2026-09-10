import { describe, it, expect, vi } from 'vitest'
import { ZipPartEmitter } from '../zipPartEmitter'

/** 把外发的分片拼回字节，便于断言切分是否精确 */
function flatten(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.byteLength
  }
  return out
}

/** 一个自动 ack 的收集器，模拟「上传立刻成功」 */
function collector(
  partSize: number,
  extra: Partial<ConstructorParameters<typeof ZipPartEmitter>[0]> = {},
) {
  const parts: Array<{ partNo: number; bytes: Uint8Array }> = []
  const emitter: ZipPartEmitter = new ZipPartEmitter({
    partSize,
    maxInFlight: 4,
    maxPartCount: 10000,
    emitPart: (partNo, chunks) => {
      parts.push({ partNo, bytes: flatten(chunks) })
      // 异步 ack，模拟真实上传的微任务边界
      queueMicrotask(() => emitter.ack())
    },
    ...extra,
  })
  return { emitter, parts }
}

describe('ZipPartEmitter', () => {
  it('切出的分片与上游 chunk 边界无关，字节流完全保序', async () => {
    const { emitter, parts } = collector(100)
    // 故意用与片长互质的、不规则的 chunk 大小
    const sizes = [7, 250, 3, 1, 99, 140]
    let counter = 0
    const expected: number[] = []
    for (const size of sizes) {
      const chunk = new Uint8Array(size)
      for (let i = 0; i < size; i++) {
        chunk[i] = counter++ % 256
        expected.push(chunk[i]!)
      }
      await emitter.write(chunk)
    }
    const partCount = await emitter.finish()

    expect(partCount).toBe(5) // 500 字节 → 5 片
    expect(parts.map((p) => p.partNo)).toEqual([1, 2, 3, 4, 5])
    expect(parts.slice(0, 4).every((p) => p.bytes.byteLength === 100)).toBe(true)
    expect(flatten(parts.map((p) => p.bytes))).toEqual(new Uint8Array(expected))
  })

  it('尾片允许小于片长', async () => {
    const { emitter, parts } = collector(100)
    await emitter.write(new Uint8Array(250))
    const partCount = await emitter.finish()

    expect(partCount).toBe(3)
    expect(parts.map((p) => p.bytes.byteLength)).toEqual([100, 100, 50])
  })

  it('输入恰好是片长整数倍时不产生空的尾片', async () => {
    const { emitter, parts } = collector(100)
    await emitter.write(new Uint8Array(200))
    expect(await emitter.finish()).toBe(2)
    expect(parts).toHaveLength(2)
  })

  it('在途分片数不会超过 maxInFlight —— 这是不落盘的前提', async () => {
    const pendingAcks: Array<() => void> = []
    let peak = 0
    const emitter: ZipPartEmitter = new ZipPartEmitter({
      partSize: 10,
      maxInFlight: 2,
      maxPartCount: 10000,
      emitPart: () => {
        peak = Math.max(peak, emitter.inFlightCount)
        pendingAcks.push(() => emitter.ack())
      },
    })

    const writing = emitter.write(new Uint8Array(100)).then(() => emitter.finish())
    // 生产端应当在第 2 片之后就被挡住
    await Promise.resolve()
    expect(pendingAcks).toHaveLength(2)

    // 逐个放行，直到全部完成
    while (pendingAcks.length) {
      pendingAcks.shift()!()
      await new Promise((r) => setTimeout(r, 0))
    }
    await writing
    expect(peak).toBeLessThanOrEqual(2)
  })

  it('续传：已完成的分片不外发，但分片编号保持连续', async () => {
    const verify = vi.fn()
    const { emitter, parts } = collector(100, {
      donePartNumbers: [1, 2],
      verifyPartNo: 1,
      emitVerify: verify,
    })
    await emitter.write(new Uint8Array(500))
    const partCount = await emitter.finish()

    expect(partCount).toBe(5)
    // 1、2 已在 OSS 上，只应外发 3、4、5
    expect(parts.map((p) => p.partNo)).toEqual([3, 4, 5])
    // 只有校验点那一片回传字节
    expect(verify).toHaveBeenCalledTimes(1)
    expect(verify.mock.calls[0]![0]).toBe(1)
  })

  it('超出分片数上限时报错而不是静默截断', async () => {
    const { emitter } = collector(10, { maxPartCount: 3 })
    await expect(emitter.write(new Uint8Array(100))).rejects.toThrow(/3-part OSS limit/)
  })

  it('fail() 会唤醒被背压挡住的生产端并抛出', async () => {
    const emitter: ZipPartEmitter = new ZipPartEmitter({
      partSize: 10,
      maxInFlight: 1,
      maxPartCount: 10000,
      emitPart: () => {
        /* 永不 ack，制造背压 */
      },
    })
    const writing = emitter.write(new Uint8Array(100))
    await Promise.resolve()
    emitter.fail('OSS part 2 failed after 5 attempts')
    await expect(writing).rejects.toThrow(/OSS part 2 failed/)
  })

  it('忽略空 chunk', async () => {
    const { emitter, parts } = collector(10)
    await emitter.write(new Uint8Array(0))
    expect(await emitter.finish()).toBe(0)
    expect(parts).toHaveLength(0)
  })
})
