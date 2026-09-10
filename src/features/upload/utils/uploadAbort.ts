/**
 * 上传中止的「意图」标注。
 *
 * 用户主动取消和组件卸载抛出的都是 `AbortError`，靠 `err.name` 分不开，
 * 但两者对 OSS 分片和续传会话的处置**完全相反**：
 *
 *   user-cancel      → 删掉 OSS 上的分片，清空分片轮次（用户不想传了）
 *   component-unmount → 原样保留分片与会话（非用户意愿的中断，之后要续传）
 *
 * 所以中止时把意图放进 `AbortController.abort(reason)`，由 `signal.reason`
 * 一路带到 pipeline 的 catch 里做分支。`abort()` 不带 reason 时（浏览器内部
 * 触发等）`abortIntentOf` 返回 null，落到保守分支：保留会话。
 */

export type AbortIntent = 'user-cancel' | 'component-unmount'

export interface UploadAbortReason {
  name: 'AbortError'
  intent: AbortIntent
  message: string
}

export function makeAbortReason(intent: AbortIntent): UploadAbortReason {
  return { name: 'AbortError', intent, message: `Upload aborted (${intent})` }
}

/** 取出中止意图；不是我们标注过的中止则返回 null */
export function abortIntentOf(err: unknown): AbortIntent | null {
  const intent = (err as { intent?: unknown } | null)?.intent
  return intent === 'user-cancel' || intent === 'component-unmount' ? intent : null
}

/**
 * 只看 `name` 而不做 `instanceof Error` 判断：中止信号可能来自 DOMException
 * （某些运行时下并不继承 Error）、我们自己的 reason 字面量对象，或 ali-oss
 * 抛出的取消事件（`{ status: 0, name: 'cancel' }`，也不是 Error）。
 * 判错会让「用户已经点了取消」还继续退避重试十几秒。
 */
export function isAbortLike(err: unknown): boolean {
  const name = (err as { name?: unknown } | null)?.name
  return name === 'AbortError' || name === 'cancel'
}

/** 拿信号自带的 reason；没有就退化成一个普通的 AbortError */
export function reasonOf(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException('Aborted by user', 'AbortError')
}
