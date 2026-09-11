import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeAbortReason, abortIntentOf } from '../uploadAbort'

/** jsdom 没有 Worker，这里替一个能被驱动的假实现 */
const state = vi.hoisted(() => ({ current: null as any, autoHash: true }))

vi.mock('@/workers/zip-compress.worker?worker', () => ({
  default: class FakeWorker {
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: (() => void) | null = null
    terminated = false
    posted: any[] = []

    constructor() {
      state.current = this
    }

    postMessage(msg: any) {
      this.posted.push(msg)
      // 'start' 之后立刻回 hash-ready，模拟哈希完成、停在压缩之前。
      // autoHash=false 用来把流程按在哈希阶段不放。
      if (msg.type === 'start' && state.autoHash) {
        queueMicrotask(() =>
          this.onmessage?.({ data: { type: 'hash-ready', hash: 'HASH' } } as MessageEvent),
        )
      }
      // 'compress' 后刻意不回 done：让 promise 悬着，由中止来决定它的结局
    }

    terminate() {
      this.terminated = true
    }
  },
}))

const { prepareUpload } = await import('../imzmlCompress')

const pair = () => ({
  imzml: new File(['<mzML/>'], 'a.imzML'),
  ibd: new File([new Uint8Array(8)], 'a.ibd'),
  baseName: 'a',
})

const compressOpts = {
  entryNames: { imzmlName: 'A.imzML', ibdName: 'A.ibd' },
  partSize: 1024,
  maxInFlightParts: 2,
  maxPartCount: 9999,
  onPart: async () => {},
}

describe('prepareUpload 的中止处理', () => {
  beforeEach(() => {
    state.current = null
    state.autoHash = true
  })

  /**
   * 回归测试。
   *
   * 曾经外层和 startCompress 各注册一个中止监听器，而 cleanup 在 abort 事件
   * 派发途中移除了后者 —— DOM 规定这样的监听器不再被调用，于是这个 promise
   * 永远不 settle，上传流水线挂死在 await 上，用户看到的是一个永远停在
   * 「Aborting…」的界面。没有断言的话，这个 case 会以超时的形式失败。
   */
  it('压缩启动后中止，startCompress 必须 reject 并带出中止意图', async () => {
    const controller = new AbortController()
    const prep = await prepareUpload(pair(), { signal: controller.signal })

    const compressing = prep.startCompress(compressOpts)
    controller.abort(makeAbortReason('user-cancel'))

    const err = await compressing.catch((e: unknown) => e)
    expect(abortIntentOf(err)).toBe('user-cancel')
    expect(state.current.terminated).toBe(true)
  })

  it('组件卸载的意图同样能穿过压缩层', async () => {
    const controller = new AbortController()
    const prep = await prepareUpload(pair(), { signal: controller.signal })

    const compressing = prep.startCompress(compressOpts)
    controller.abort(makeAbortReason('component-unmount'))

    expect(abortIntentOf(await compressing.catch((e: unknown) => e))).toBe('component-unmount')
  })

  it('哈希阶段中止：外层 promise reject，worker 被回收', async () => {
    const controller = new AbortController()
    // 这一轮不让 worker 回 hash-ready，把流程按在哈希阶段
    state.autoHash = false
    const pending = prepareUpload(pair(), { signal: controller.signal })
    await Promise.resolve()

    controller.abort(makeAbortReason('user-cancel'))
    expect(abortIntentOf(await pending.catch((e: unknown) => e))).toBe('user-cancel')
  })

  it('已经中止的 signal：startCompress 立刻 reject，不发压缩指令', async () => {
    const controller = new AbortController()
    const prep = await prepareUpload(pair(), { signal: controller.signal })
    controller.abort(makeAbortReason('user-cancel'))

    const err = await prep.startCompress(compressOpts).catch((e: unknown) => e)
    expect(abortIntentOf(err)).toBe('user-cancel')
    expect(state.current.posted.some((m: any) => m.type === 'compress')).toBe(false)
  })

  it('秒传命中走 dispose，暂停中的 worker 必须被回收', async () => {
    const prep = await prepareUpload(pair())
    expect(state.current.terminated).toBe(false)
    prep.dispose()
    expect(state.current.terminated).toBe(true)
    prep.dispose() // 幂等
    expect(state.current.terminated).toBe(true)
  })
})
