/**
 * 手写 SSE（Server-Sent Events）增量解析器。
 *
 * 从 fetch ReadableStream 读取原始字节，按行切分，识别 `data:` 前缀、
 * `[DONE]` 终态、非 2xx 错误响应，向外产出 `SseEvent`。
 *
 * 不依赖任何第三方库（axios 浏览器端不支持流式），约 70 行。
 */

/** 解析器产出的单条 SSE 事件 */
export type SseEvent =
  | { kind: 'data'; data: string }
  | { kind: 'done'; truncated?: boolean }
  | { kind: 'error'; message: string; status?: number; body?: string }

/**
 * 打开一个 SSE 响应流，返回异步迭代器。
 *
 * @param response — fetch 的 Response 对象（body 为 ReadableStream）
 * @param signal  — 外部 AbortSignal，用于取消读取
 */
export async function* parseSseStream(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  if (!response.ok) {
    let body = ''
    try {
      body = await response.text()
    } catch {
      /* ignore parse errors on error body */
    }
    yield {
      kind: 'error',
      message: `HTTP ${response.status}`,
      status: response.status,
      body: body.slice(0, 1000),
    }
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    yield { kind: 'error', message: 'Response body is not a ReadableStream' }
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''
  /** 是否已产出过 data 事件（用于把「中途断流」与「压根没开始」区分开） */
  let receivedData = false

  try {
    while (true) {
      // 支持外部 abort
      if (signal?.aborted) {
        yield { kind: 'error', message: 'Aborted' }
        return
      }

      const { done, value } = await reader.read()
      if (done) break

      // SSE 规范允许 \r\n / \r / \n 三种换行；统一成 \n 再按事件切分，
      // 否则 \r\n\r\n 分隔的流（部分代理/端点）一个事件都切不出来
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n')

      // 按 \n\n 切分完整事件
      const parts = buffer.split('\n\n')
      // 最后一段可能不完整，留到下次
      buffer = parts.pop() || ''

      for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed) continue

        for (const line of trimmed.split('\n')) {
          const t = line.trim()
          if (!t) continue
          if (t.startsWith('data:')) {
            const data = t.slice(5).trim()
            if (data === '[DONE]') {
              yield { kind: 'done' }
              return
            }
            receivedData = true
            yield { kind: 'data', data }
          }
        }
      }
    }
    // 流读尽（done）后，残留 buffer 里可能还有一个未以空行收尾的完整事件——
    // 部分端点/中转发完最后一个 data 就直接关连接，既不补 \n\n 也不发 [DONE]，
    // 这条增量（常是最后一个 delta 或 finish_reason 收尾）会被静默丢弃。
    // 补一次 flush 走同一行级投递；不完整的半截 JSON 由 adapter 的 try/catch 兜底。
    buffer += decoder.decode()
    for (const line of buffer.split('\n')) {
      const t = line.trim()
      if (!t) continue
      if (t.startsWith('data:')) {
        const data = t.slice(5).trim()
        if (data === '[DONE]') break
        receivedData = true
        yield { kind: 'data', data }
      }
    }
    // （adapter 的 for-await 随迭代器自然退出，与收到 done 等价）
  } catch (err: any) {
    if (err?.name === 'AbortError' || signal?.aborted) {
      yield { kind: 'error', message: 'Aborted' }
    } else if (receivedData) {
      // 中转站偶发断流（ERR_INCOMPLETE_CHUNKED_ENCODING 等）：已收到部分数据。
      // 标记 truncated 让上层把已有内容按「提前结束」处理，而不是整轮报错。
      yield { kind: 'done', truncated: true }
    } else {
      yield { kind: 'error', message: err?.message || 'Unknown stream error' }
    }
  } finally {
    reader.releaseLock()
  }
}