import { describe, it, expect } from 'vitest'
import { dispositionFor } from '../imzmlOssUpload'
import { NON_DETERMINISTIC_ZIP } from '../imzmlCompress'
import { makeAbortReason } from '../uploadAbort'

/**
 * 这张决策表就是那个 P0 的全部内容：旧实现只有「不可复现」和「其它」两支，
 * 用户取消落进「其它」，于是刚被作废的 uploadId 又被写回 localStorage。
 */
describe('上传失败后的会话处置', () => {
  it('zip 不可复现 → 整个会话作废', () => {
    expect(dispositionFor(new Error(NON_DETERMINISTIC_ZIP), false)).toBe('discard-session')
    // zipMismatch 标志优先，与错误本身无关
    expect(dispositionFor(new Error('anything'), true)).toBe('discard-session')
  })

  it('用户主动取消 → 作废分片但保留会话，绝不能写回已作废的 uploadId', () => {
    expect(dispositionFor(makeAbortReason('user-cancel'), false)).toBe('reset-parts')
  })

  it('组件卸载 → 原样保留，之后要续传', () => {
    expect(dispositionFor(makeAbortReason('component-unmount'), false)).toBe('keep-session')
  })

  it('网络失败 → 原样保留', () => {
    expect(dispositionFor(new Error('OSS part 3 failed after 5 attempts'), false)).toBe(
      'keep-session',
    )
  })

  it('没标注意图的裸 AbortError → 保守地保留会话', () => {
    expect(dispositionFor(new DOMException('aborted', 'AbortError'), false)).toBe('keep-session')
  })

  it('取消的优先级低于不可复现：两者同时成立时整个会话作废', () => {
    expect(dispositionFor(makeAbortReason('user-cancel'), true)).toBe('discard-session')
  })
})
