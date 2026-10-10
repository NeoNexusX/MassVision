import { describe, expect, it } from 'vitest'
import { parseSseStream } from '../agentservices/sseParser'

/**
 * SSE 解析器单元测试：
 * 覆盖正常文本流、跨 chunk 断行、[DONE] 终态、非 2xx 错误、外部 abort。
 */
describe('parseSseStream', () => {
  /** 构造一个模拟 Response，body 为给定文本的 ReadableStream */
  function mockResponse(
    text: string,
    ok = true,
    status = 200,
  ): Response {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text))
        controller.close()
      },
    })
    return new Response(stream, { status, statusText: ok ? 'OK' : 'Error' })
  }

  /** 构造一个分块发送的 Response（模拟网络分片） */
  function mockChunkedResponse(chunks: string[], ok = true): Response {
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
        controller.close()
      },
    })
    return new Response(stream, { status: ok ? 200 : 500 })
  }

  /** 收集所有事件 */
  async function collect(stream: AsyncIterable<any>): Promise<any[]> {
    const result: any[] = []
    for await (const event of stream) {
      result.push(event)
    }
    return result
  }

  it('parses a single data line', async () => {
    const events = await collect(
      parseSseStream(mockResponse('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n')),
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ kind: 'data', data: '{"choices":[{"delta":{"content":"hello"}}]}' })
  })

  it('parses multiple data lines in one event', async () => {
    const events = await collect(
      parseSseStream(mockResponse('data: hello\n\n data: world\n\n')),
    )
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ kind: 'data', data: 'hello' })
    expect(events[1]).toEqual({ kind: 'data', data: 'world' })
  })

  it('recognizes [DONE] and stops', async () => {
    const events = await collect(
      parseSseStream(mockResponse('data: {"c":"a"}\n\ndata: [DONE]\n\ndata: should-not-appear\n\n')),
    )
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ kind: 'data', data: '{"c":"a"}' })
    expect(events[1]).toEqual({ kind: 'done' })
  })

  it('handles chunked data where a line is split across chunks', async () => {
    const events = await collect(
      parseSseStream(
        mockChunkedResponse([
          'data: {"cho',
          'ices":[{"delta":{"content":"split"}}]}\n\n',
        ]),
      ),
    )
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('data')
    expect(events[0].data).toContain('"split"')
  })

  it('yields error for non-2xx response', async () => {
    const events = await collect(
      parseSseStream(mockResponse('{"error":"unauthorized"}', false, 401)),
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'error', status: 401 })
  })

  it('yields error on abort signal', async () => {
    const controller = new AbortController()
    const stream = new ReadableStream({
      start(ctrl) {
        // 先发一个 chunk，然后立即 abort
        ctrl.enqueue(new TextEncoder().encode('data: first\n\n'))
        controller.abort()
      },
    })
    const response = new Response(stream, { status: 200 })

    const events = await collect(parseSseStream(response, controller.signal))
    // 第一个 chunk 可能已产出，也可能在 abort 后才被读取
    expect(events.some((e) => e.kind === 'error')).toBe(true)
  })

  it('handles empty lines and whitespace', async () => {
    const events = await collect(
      parseSseStream(mockResponse('\n\n  data: hello  \n\n\n\n')),
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ kind: 'data', data: 'hello' })
  })

  it('handles multiple data: lines in a single event', async () => {
    // 多行 data: 属于同一个事件，逐行产出
    const events = await collect(
      parseSseStream(mockResponse('data: line1\ndata: line2\n\n')),
    )
    expect(events).toHaveLength(2)
    expect(events[0].data).toBe('line1')
    expect(events[1].data).toBe('line2')
  })

  it('marks mid-stream drop after partial data as truncated done', async () => {
    // 中转站断流（ERR_INCOMPLETE_CHUNKED_ENCODING 等价物）：已收到部分 data 后
    // reader 抛异常 → 产出 done+truncated（上层保留部分内容），而非 error
    const stream = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(new TextEncoder().encode('data: {"partial":true}\n\n'))
        // 异步掐断（enqueue 的数据可先被读走）
        setTimeout(() => ctrl.error(new TypeError('network error')), 10)
      },
    })
    const events = await collect(parseSseStream(new Response(stream, { status: 200 })))
    expect(events[0]).toEqual({ kind: 'data', data: '{"partial":true}' })
    expect(events[events.length - 1]).toMatchObject({ kind: 'done', truncated: true })
    expect(events.some((e) => e.kind === 'error')).toBe(false)
  })

  it('yields error when stream fails before any data', async () => {
    // 一个字节都没收到就断 → 仍是 error（配置问题/网络不通）
    const stream = new ReadableStream({
      start(ctrl) {
        setTimeout(() => ctrl.error(new TypeError('network error')), 10)
      },
    })
    const events = await collect(parseSseStream(new Response(stream, { status: 200 })))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'error' })
  })

  it('handles CRLF line endings (spec-legal \\r\\n separators)', async () => {
    // 部分代理/端点用 \r\n 作 SSE 行结束符——事件分隔符是 \r\n\r\n
    const events = await collect(
      parseSseStream(mockResponse('data: {"a":1}\r\n\r\ndata: [DONE]\r\n\r\n')),
    )
    expect(events).toEqual([
      { kind: 'data', data: '{"a":1}' },
      { kind: 'done' },
    ])
  })

  it('treats clean end without [DONE] as silent end (no extra events)', async () => {
    // 服务端正常 close 但没发 [DONE]（部分兼容端点的行为）：不产出额外事件
    const events = await collect(
      parseSseStream(mockResponse('data: {"a":1}\n\n')),
    )
    expect(events).toEqual([{ kind: 'data', data: '{"a":1}' }])
  })

  it('flushes a final event that lacks the trailing blank line at EOF', async () => {
    // 部分端点/中转发完最后一个 data 就直接关连接，不补 \n\n 也不发 [DONE]：
    // 这条增量（常是最后一个 delta 或 finish_reason 收尾）必须补投递，不能丢
    const events = await collect(
      parseSseStream(mockResponse('data: {"a":1}\n\ndata: {"b":2}')),
    )
    expect(events).toEqual([
      { kind: 'data', data: '{"a":1}' },
      { kind: 'data', data: '{"b":2}' },
    ])
  })
})