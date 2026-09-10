import { describe, it, expect } from 'vitest'
import { makeAbortReason, abortIntentOf, isAbortLike, reasonOf } from '../uploadAbort'

describe('中止意图标注', () => {
  it('reason 带 AbortError 的 name，能被通用的中止判断识别', () => {
    const reason = makeAbortReason('user-cancel')
    expect(reason.name).toBe('AbortError')
    expect(isAbortLike(reason)).toBe(true)
  })

  it('两种意图各自可辨', () => {
    expect(abortIntentOf(makeAbortReason('user-cancel'))).toBe('user-cancel')
    expect(abortIntentOf(makeAbortReason('component-unmount'))).toBe('component-unmount')
  })

  it('没标注过的中止返回 null，落到保守分支', () => {
    expect(abortIntentOf(new DOMException('x', 'AbortError'))).toBeNull()
    expect(abortIntentOf(new Error('network'))).toBeNull()
    expect(abortIntentOf(null)).toBeNull()
    expect(abortIntentOf(undefined)).toBeNull()
    expect(abortIntentOf({ intent: 'something-else' })).toBeNull()
  })

  it('ali-oss 的取消事件不是 Error，也要认得', () => {
    expect(isAbortLike({ status: 0, name: 'cancel' })).toBe(true)
    expect(isAbortLike(new Error('ECONNRESET'))).toBe(false)
    expect(isAbortLike(null)).toBe(false)
  })

  it('reasonOf 透传 signal 自带的 reason，无 signal 时退化成 AbortError', () => {
    const controller = new AbortController()
    const reason = makeAbortReason('user-cancel')
    controller.abort(reason)
    expect(reasonOf(controller.signal)).toBe(reason)
    expect((reasonOf(undefined) as Error).name).toBe('AbortError')
  })
})
