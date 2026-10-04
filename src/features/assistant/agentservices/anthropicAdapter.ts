/**
 * Anthropic（Claude）原生适配器：/v1/messages + SSE 流式。
 *
 * 与 openaiAdapter 同构（手写 fetch + 复用 sseParser，不引 SDK 依赖），
 * 差异全在 wire 格式：
 * - 端点 `{baseUrl}/messages`（baseUrl 填版本化根，如 https://api.anthropic.com/v1），
 *   鉴权 `x-api-key` + `anthropic-version`；浏览器直连官方 API 需显式开 CORS
 *   （anthropic-dangerous-direct-browser-access 头，经 dev relay 时无害）。
 * - system 消息 → 顶层 `system` 字符串（Anthropic 不认 messages 里的 system 角色）。
 * - assistant.tool_calls（扁平 id/name/arguments）→ `tool_use` content 块
 *   （input 是对象——arguments JSON 文本在此处解析）。
 * - role:"tool" 结果消息 → user 消息里的 `tool_result` 块；**连续多个 tool
 *   消息合并进同一条 user**（Anthropic 要求并行调用的结果一次性回喂）。
 * - `max_tokens` 是必填项（GenerateOptions 未带时用默认值）。
 * - temperature 有意不透传：Claude 4.7+ 拒绝非默认采样参数（400）。
 * - SSE 事件流（message_start / content_block_* / message_delta / message_stop）
 *   映射到统一 StreamChunk：text_delta → text、thinking_delta → reasoning、
 *   tool_use 的 input_json_delta → 工具参数增量。
 *
 * 严格端点兼容层（openaiAdapter 的折叠梯子）在此不需要——发出去的就是
 * Anthropic 原生格式，没有转换层可丢字段。
 */

import { parseSseStream } from './sseParser'
import type {
  ChatMessage,
  GenerateOptions,
  LlmAdapter,
  StreamChunk,
} from '../agenttypes/assistant'
import { loadUserLlmConfig } from '../agentconfig/userLlmConfig'
import { devRelayTarget, humanizeHttpError, sanitizeToolName } from './openaiAdapter'

/** baseUrl 未填时的官方端点（版本化根，同 OpenAI 面板的 /v1 约定） */
export const ANTHROPIC_DEFAULT_BASE = 'https://api.anthropic.com/v1'
/** 模型未填时的默认（与 claude-api 参考一致：未指名模型一律用 Opus 最新） */
export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-4-8'
/** Anthropic 的 max_tokens 必填；流式无 HTTP 超时顾虑，给足长报告余量 */
export const ANTHROPIC_MAX_TOKENS_DEFAULT = 16384

// ---- wire 类型（只在本地够用，不进 agenttypes——那是统一内部格式） ----

interface AnthropicBlock {
  type: string
  [key: string]: unknown
}

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicBlock[]
}

/** 内部消息 → Anthropic wire 形态（导出供单测） */
export function toAnthropicPayload(messages: ChatMessage[]): {
  system?: string
  messages: AnthropicMessage[]
} {
  const systemParts: string[] = []
  const out: AnthropicMessage[] = []
  // 连续 tool 消息攒成一条 user（tool_result 块组）；任何非 tool 消息先冲刷
  let pendingToolResults: AnthropicBlock[] = []
  const flushToolResults = () => {
    if (pendingToolResults.length > 0) {
      out.push({ role: 'user', content: pendingToolResults })
      pendingToolResults = []
    }
  }

  for (const m of messages) {
    if (m.role === 'system') {
      // Anthropic：system 不进 messages，拼接为顶层字段
      if (m.content) systemParts.push(m.content)
      continue
    }
    if (m.role === 'tool') {
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: m.tool_call_id ?? '',
        content: m.content ?? '',
      })
      continue
    }
    if (m.role === 'user') {
      flushToolResults()
      out.push({ role: 'user', content: m.content ?? '' })
      continue
    }
    // assistant：正文（如有）+ tool_calls → tool_use 块
    flushToolResults()
    const blocks: AnthropicBlock[] = []
    if (m.content) blocks.push({ type: 'text', text: m.content })
    for (const tc of m.tool_calls ?? []) {
      // arguments 是 JSON 文本；解析失败按空对象（与 agentLoop 的兜底一致）
      let input: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(tc.arguments) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          input = parsed as Record<string, unknown>
        }
      } catch {
        /* 保持空对象 */
      }
      blocks.push({
        type: 'tool_use',
        id: tc.id,
        // 历史里的名字一律过 sanitize（与 openaiAdapter 的 wire 兜底同策略：
        // localStorage 恢复的旧历史可能带脏 name）
        name: sanitizeToolName(tc.name),
        input,
      })
    }
    // agentLoop 不会产出「无正文也无 tool_calls」的 assistant；恢复的历史
    // 也只含非空正文。空 content 块可能被拒，兜一个空白正文块保险。
    if (blocks.length === 0) blocks.push({ type: 'text', text: ' ' })
    out.push({ role: 'assistant', content: blocks })
  }
  flushToolResults()

  // 防御：trimHistory 已保证窗口 user 开头，但 localStorage 恢复的历史被裁到
  // 最近 20 条后仍可能 assistant 开头——Anthropic 对首条非 user 一律 400 且
  // 此后每轮都炸。丢弃开头的 assistant 块（信息损失远小于整会话报废）；
  // 全丢光的极端情形垫一条占位 user，避免空 messages 数组也被 400。
  while (out.length > 0 && out[0]!.role === 'assistant') out.shift()
  if (out.length === 0) out.push({ role: 'user', content: ' ' })

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: out,
  }
}

/** 组装 /v1/messages 请求体 */
function buildAnthropicBody(
  options: GenerateOptions,
  system: string | undefined,
  messages: AnthropicMessage[],
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model,
    max_tokens: options.maxTokens ?? ANTHROPIC_MAX_TOKENS_DEFAULT,
    stream: true,
    messages,
  }
  if (system) body.system = system
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools.map((t) => ({
      name: sanitizeToolName(t.name),
      description: t.description,
      input_schema: t.parameters,
    }))
  }
  // temperature 不透传（见文件头注释）
  return body
}

/**
 * Anthropic 原生适配器。
 *
 * 用法（providers/llm.ts 注册）：
 * ```ts
 * ctx.llm.registerAdapter('anthropic', anthropicAdapter)
 * ```
 * 由 BYOK 配置的 provider 字段选择（见 LlmRuntime.resolveProvider）。
 */
export const anthropicAdapter: LlmAdapter = {
  provider: 'anthropic',

  async *stream(
    options: GenerateOptions,
    signal: AbortSignal,
  ): AsyncIterable<StreamChunk> {
    const user = loadUserLlmConfig()
    // env 默认链是 OpenAI 兼容部署的（deepseek-chat 等），不适用于 Anthropic；
    // 未自配 model 时用 Anthropic 默认。
    const model = user.model || ANTHROPIC_DEFAULT_MODEL
    const apiKey = user.apiKey
    const absolute = `${(user.baseUrl || ANTHROPIC_DEFAULT_BASE).replace(/\/+$/, '')}/messages`
    // dev 转发：Anthropic 永远不该走 env 的 /llm-proxy（那是 OpenAI 兼容部署
    // 的端点，x-api-key/路径都不对，必 404/401）。baseUrl 留空时把官方默认
    // 端点当作 BYOK 目标传入 → devRelayTarget 走 /llm-relay + x-llm-target
    // 分支，经 vite 转发到 api.anthropic.com。
    const relay = devRelayTarget(absolute, user.baseUrl || ANTHROPIC_DEFAULT_BASE)
    const url = relay?.url ?? absolute

    const { system, messages } = toAnthropicPayload(options.messages)

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          // 浏览器直连 api.anthropic.com 的 CORS 开关；经 dev relay 转发时无害
          'anthropic-dangerous-direct-browser-access': 'true',
          ...(relay?.targetOrigin ? { 'x-llm-target': relay.targetOrigin } : {}),
        },
        body: JSON.stringify(buildAnthropicBody({ ...options, model }, system, messages)),
        signal,
      })
    } catch (err) {
      if (signal.aborted) {
        yield { type: 'finish', reason: 'aborted' }
        return
      }
      yield {
        type: 'finish',
        reason: 'error',
        error: `Cannot reach ${absolute} — check the API Base URL (for the official API use ${ANTHROPIC_DEFAULT_BASE}), and that the endpoint allows browser (CORS) access. (${
          (err as Error)?.message || 'network error'
        })`,
      }
      return
    }

    // SPA fallback 防呆（BYOK 地址指到网站上时 200 回 HTML），与 openaiAdapter
    // 同一策略：只拦 HTML，text/plain 等 SSE 变体照常交给解析器
    const contentType = response.headers.get('content-type') || ''
    if (response.ok && /text\/html/i.test(contentType)) {
      yield {
        type: 'finish',
        reason: 'error',
        error:
          `Endpoint returned ${contentType || 'non-SSE content'} instead of an LLM stream. ` +
          `The Base URL likely points at a website, not an API — for the official Anthropic API use ${ANTHROPIC_DEFAULT_BASE}.`,
      }
      return
    }

    let finishReason: 'stop' | 'tool-calls' = 'stop'
    /** SSE 层检测到连接中途断开 */
    let streamTruncated = false
    /** 是否收到过实质增量（与 openaiAdapter 同语义，供空流重试判定） */
    let receivedContent = false

    for await (const event of parseSseStream(response, signal)) {
      if (event.kind === 'error') {
        if (signal.aborted) {
          yield { type: 'finish', reason: 'aborted' }
          return
        }
        const message =
          event.status != null
            ? humanizeHttpError(event.status, event.body || '')
            : event.message
        yield { type: 'finish', reason: 'error', error: message }
        return
      }
      if (event.kind === 'done') {
        if (event.truncated) streamTruncated = true
        break
      }
      if (event.kind !== 'data') continue

      try {
        const parsed = JSON.parse(event.data) as {
          type?: string
          index?: number
          content_block?: { type?: string; id?: string; name?: string }
          delta?: { type?: string; text?: string; thinking?: string; partial_json?: string; stop_reason?: string }
          error?: { message?: string }
        }

        switch (parsed.type) {
          case 'content_block_start': {
            // tool_use 块在 start 事件带 id/name，参数随后以
            // input_json_delta 增量到达——id/name 先行，与 openai 合并器兼容
            const block = parsed.content_block
            if (block?.type === 'tool_use') {
              receivedContent = true
              yield {
                type: 'tool-call-delta',
                index: parsed.index ?? 0,
                id: block.id,
                name: sanitizeToolName(block.name),
              }
            }
            break
          }
          case 'content_block_delta': {
            const delta = parsed.delta
            if (delta?.type === 'text_delta' && delta.text) {
              receivedContent = true
              yield { type: 'text-delta', text: delta.text }
            } else if (delta?.type === 'thinking_delta' && delta.thinking) {
              // 思考增量（adaptive thinking / display:"summarized"）→ 统一 reasoning 流
              receivedContent = true
              yield { type: 'reasoning-delta', text: delta.thinking }
            } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
              yield {
                type: 'tool-call-delta',
                index: parsed.index ?? 0,
                argumentsDelta: delta.partial_json,
              }
            }
            break
          }
          case 'message_delta': {
            // stop_reason：tool_use → 工具循环；end_turn / max_tokens /
            // stop_sequence / refusal（Fable 5 安全拒答，正文通常为空 →
            // 走上层的空流路径）都按 stop 收尾
            const sr = parsed.delta?.stop_reason
            if (sr) finishReason = sr === 'tool_use' ? 'tool-calls' : 'stop'
            break
          }
          case 'message_stop':
            // 正常收尾（等价 openai 的 [DONE]）；流随后会自然关闭
            break
          case 'error': {
            // 流中错误事件（过载等）：Anthropic 错误体 {type:"error",error:{message}}
            yield {
              type: 'finish',
              reason: 'error',
              error: parsed.error?.message || 'LLM stream error',
            }
            return
          }
        }
      } catch {
        // 跳过无法解析的 data 行
      }
    }

    if (signal.aborted) {
      yield { type: 'finish', reason: 'aborted' }
      return
    }

    yield {
      type: 'finish',
      reason: finishReason,
      truncated: streamTruncated,
      receivedContent,
    }
  },
}
