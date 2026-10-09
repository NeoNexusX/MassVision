import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  anthropicAdapter,
  toAnthropicPayload,
  ANTHROPIC_DEFAULT_BASE,
  ANTHROPIC_DEFAULT_MODEL,
} from '../agentservices/anthropicAdapter'
import { clearUserLlmConfig, saveUserLlmConfig } from '../agentconfig/userLlmConfig'
import type { ChatMessage, StreamChunk, ToolSchema } from '../agenttypes/assistant'

/**
 * anthropicAdapter 单元测试：
 * - toAnthropicPayload 纯函数（system → 顶层、tool_calls → tool_use 块、
 *   并行 tool 结果合并单条 user 回喂）
 * - stream() 的 SSE 事件映射（text/thinking/input_json_delta/stop_reason/
 *   流中 error 事件）与请求头/请求体形状
 */

/** 带 role:"tool" 回喂消息的最小会话（工具循环第二轮的典型形态） */
function toolTurnMessages(): ChatMessage[] {
  return [
    { role: 'system', content: 'sys' },
    { role: 'user', content: '分析一下' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: 'toolu_1', name: 'get_annotation_top', arguments: '{"topN":5}' },
        { id: 'toolu_2', name: 'get_page_state', arguments: 'not-json' },
      ],
    },
    { role: 'tool', content: '[]', tool_call_id: 'toolu_1', name: 'get_annotation_top' },
    { role: 'tool', content: '{}', tool_call_id: 'toolu_2', name: 'get_page_state' },
  ]
}

const testTools: ToolSchema[] = [
  {
    name: 'get_annotation_top',
    description: 'top annotations',
    parameters: { type: 'object', properties: { topN: { type: 'integer' } } },
  },
]

/** 收集流式产出的全部分块 */
async function collect(iter: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = []
  for await (const chunk of iter) out.push(chunk)
  return out
}

/** 把若干 Anthropic SSE 事件拼成一条流（event: 行可省——解析器只认 data:） */
function sseOf(...events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
}

/** 解出 fetch mock 上行的请求体与请求头 */
function sentRequest(mock: ReturnType<typeof vi.fn>, call = 0): {
  url: string
  headers: Record<string, string>
  body: Record<string, any>
} {
  const [url, init] = mock.mock.calls[call] as [string, RequestInit]
  return {
    url,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(init.body as string),
  }
}

beforeEach(() => {
  saveUserLlmConfig({
    provider: 'anthropic',
    baseUrl: 'http://localhost:4567/v1',
    apiKey: 'sk-ant-test',
    model: 'claude-test',
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearUserLlmConfig()
})

// ---- toAnthropicPayload ----

describe('toAnthropicPayload', () => {
  it('lifts system messages to the top-level system field', () => {
    const { system, messages } = toAnthropicPayload([
      { role: 'system', content: 'part A' },
      { role: 'system', content: 'part B' },
      { role: 'user', content: 'hi' },
    ])
    expect(system).toBe('part A\n\npart B')
    expect(messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('converts flat tool_calls to tool_use blocks and parses arguments JSON', () => {
    const { messages } = toAnthropicPayload(toolTurnMessages())
    const assistant = messages[1] as { role: string; content: Array<Record<string, unknown>> }
    expect(assistant.role).toBe('assistant')
    const calls = assistant.content.filter((b) => b.type === 'tool_use')
    expect(calls).toEqual([
      { type: 'tool_use', id: 'toolu_1', name: 'get_annotation_top', input: { topN: 5 } },
      // 非法 JSON 参数 → 空对象（与 agentLoop 的兜底一致）
      { type: 'tool_use', id: 'toolu_2', name: 'get_page_state', input: {} },
    ])
  })

  it('merges consecutive tool results into ONE user message of tool_result blocks', () => {
    const { messages } = toAnthropicPayload(toolTurnMessages())
    // system 提升出 messages：user + assistant(tool_use) + 单条 user(tool_result×2)
    expect(messages).toHaveLength(3)
    const last = messages[2] as { role: string; content: Array<Record<string, unknown>> }
    expect(last.role).toBe('user')
    expect(last.content).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_1', content: '[]' },
      { type: 'tool_result', tool_use_id: 'toolu_2', content: '{}' },
    ])
  })

  it('sanitizes dirty tool names from restored history', () => {
    const { messages } = toAnthropicPayload([
      { role: 'user', content: 'q' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 't1', name: '带换行的名字\n', arguments: '{}' }],
      },
    ])
    const block = (messages[1] as { content: Array<Record<string, unknown>> }).content[0]
    // 全非法字符清洗后为空 → sanitizeToolName 的 unknown_tool 兜底
    expect(block!.name).toBe('unknown_tool')
  })

  it('keeps assistant text alongside tool_use blocks', () => {
    const { messages } = toAnthropicPayload([
      { role: 'user', content: 'q' },
      {
        role: 'assistant',
        content: 'thinking aloud',
        tool_calls: [{ id: 't1', name: 't', arguments: '{}' }],
      },
    ])
    const blocks = (messages[1] as { content: Array<Record<string, unknown>> }).content
    expect(blocks.map((b) => b.type)).toEqual(['text', 'tool_use'])
  })

  it('drops leading assistant messages (Anthropic 400s assistant-first)', () => {
    // localStorage 恢复的历史被裁到最近 20 条后可能 assistant 开头——
    // Anthropic 端点要求首条必须 user，原样发送整会话报废
    const { messages } = toAnthropicPayload([
      { role: 'assistant', content: 'orphan reply' },
      { role: 'user', content: 'next question' },
      { role: 'assistant', content: 'answer' },
    ])
    expect(messages[0]!.role).toBe('user')
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant'])
  })

  it('falls back to a placeholder user message when everything is assistant', () => {
    const { messages } = toAnthropicPayload([{ role: 'assistant', content: 'all alone' }])
    // 空 messages 数组同样会被 400（minItems 1）——垫一条占位
    expect(messages).toEqual([{ role: 'user', content: ' ' }])
  })
})

// ---- stream() ----

describe('anthropicAdapter.stream', () => {
  it('maps text deltas and end_turn to a stop finish', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        sseOf(
          { type: 'message_start', message: { id: 'msg_1' } },
          { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
          { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hel' } },
          { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'lo' } },
          { type: 'content_block_stop', index: 0 },
          { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
          { type: 'message_stop' },
        ),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const chunks = await collect(
      anthropicAdapter.stream(
        { model: '', messages: [{ role: 'user', content: 'hi' }] },
        new AbortController().signal,
      ),
    )

    expect(chunks.filter((c) => c.type === 'text-delta').map((c) => (c as { text: string }).text).join('')).toBe('Hello')
    expect(chunks[chunks.length - 1]).toMatchObject({ type: 'finish', reason: 'stop', receivedContent: true })
  })

  it('maps thinking deltas to reasoning and tool_use blocks to merged tool-call deltas', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        sseOf(
          { type: 'message_start', message: {} },
          { type: 'content_block_start', index: 0, content_block: { type: 'thinking' } },
          { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hmm' } },
          { type: 'content_block_stop', index: 0 },
          { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_9', name: 'get_page_state', input: {} } },
          { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"a":' } },
          { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '1}' } },
          { type: 'content_block_stop', index: 1 },
          { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
          { type: 'message_stop' },
        ),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const chunks = await collect(
      anthropicAdapter.stream(
        { model: '', messages: toolTurnMessages(), tools: testTools },
        new AbortController().signal,
      ),
    )

    expect(chunks.some((c) => c.type === 'reasoning-delta' && c.text === 'hmm')).toBe(true)
    // id/name 首发于 content_block_start，参数随后以 partial_json 增量合并
    const starts = chunks.filter((c) => c.type === 'tool-call-delta' && (c as { id?: string }).id)
    expect(starts).toHaveLength(1)
    expect(starts[0]).toMatchObject({ index: 1, id: 'toolu_9', name: 'get_page_state' })
    const args = chunks
      .filter((c) => c.type === 'tool-call-delta' && (c as { argumentsDelta?: string }).argumentsDelta)
      .map((c) => (c as { argumentsDelta: string }).argumentsDelta)
      .join('')
    expect(args).toBe('{"a":1}')
    expect(chunks[chunks.length - 1]).toMatchObject({ type: 'finish', reason: 'tool-calls', receivedContent: true })
  })

  it('sends Anthropic wire shape: /messages endpoint, x-api-key, system field, input_schema, max_tokens', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(sseOf({ type: 'message_stop' }), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    await collect(
      anthropicAdapter.stream(
        { model: '', messages: toolTurnMessages(), tools: testTools, maxTokens: 999 },
        new AbortController().signal,
      ),
    )

    const { url, headers, body } = sentRequest(fetchMock)
    // 测试环境 import.meta.env.DEV 为 false？——vitest 里 DEV 取决于 mode。
    // url 可能是直连或 /llm-relay 前缀，断言 pathname 即可
    expect(url).toMatch(/\/messages$/)
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(body.model).toBe('claude-test')
    expect(body.max_tokens).toBe(999)
    expect(body.system).toBe('sys')
    expect(body.tools).toEqual([
      {
        name: 'get_annotation_top',
        description: 'top annotations',
        input_schema: { type: 'object', properties: { topN: { type: 'integer' } } },
      },
    ])
    // temperature 有意不上行（Claude 4.7+ 拒绝非默认采样参数）
    expect(body.temperature).toBeUndefined()
    // messages 里不应有 system 角色
    expect((body.messages as Array<{ role: string }>).every((m) => m.role !== 'system')).toBe(true)
  })

  it('defaults max_tokens and model when options carry none', async () => {
    clearUserLlmConfig()
    saveUserLlmConfig({ provider: 'anthropic', baseUrl: '', apiKey: 'sk-ant-test', model: '' })
    const fetchMock = vi.fn(async () =>
      new Response(sseOf({ type: 'message_stop' }), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    await collect(
      anthropicAdapter.stream(
        { model: '', messages: [{ role: 'user', content: 'hi' }] },
        new AbortController().signal,
      ),
    )

    const { url, headers, body } = sentRequest(fetchMock)
    expect(body.max_tokens).toBe(16384)
    expect(body.model).toBe(ANTHROPIC_DEFAULT_MODEL)
    // baseUrl 未填 → 官方默认端点。修复前空 baseUrl 在 dev 下会误入 env 的
    // /llm-proxy（OpenAI 兼容部署分支），x-api-key 打到错误端点必 404/401；
    // 修复后走 /llm-relay 同源转发 + x-llm-target（vitest 默认 mode=test →
    // DEV=true，此处可稳定断言 relay 形态）
    expect(url).toBe('/llm-relay/v1/messages')
    expect(url).not.toContain('/llm-proxy')
    expect(headers['x-llm-target']).toBe(new URL(ANTHROPIC_DEFAULT_BASE).origin)
  })

  it('surfaces a mid-stream error event with its message', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        sseOf({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const chunks = await collect(
      anthropicAdapter.stream(
        { model: '', messages: [{ role: 'user', content: 'hi' }] },
        new AbortController().signal,
      ),
    )

    const finish = chunks[chunks.length - 1] as { type: string; reason?: string; error?: string }
    expect(finish.type).toBe('finish')
    expect(finish.reason).toBe('error')
    expect(finish.error).toContain('Overloaded')
  })

  it('humanizes non-2xx responses (Anthropic error body shape)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const chunks = await collect(
      anthropicAdapter.stream(
        { model: '', messages: [{ role: 'user', content: 'hi' }] },
        new AbortController().signal,
      ),
    )

    const finish = chunks[chunks.length - 1] as { reason?: string; error?: string }
    expect(finish.reason).toBe('error')
    // humanizeHttpError 解析 {"error":{"message"}} —— Anthropic 错误体同形
    expect(finish.error).toContain('HTTP 401')
    expect(finish.error).toContain('invalid x-api-key')
  })
})
