/**
 * Agent loop 插件：turn / step 循环、abort、事件发射、system prompt 组装。
 *
 * 注入 ctx.agent 服务。每个 turn 包括多个 step（一次 LLM + 可能工具调用），
 * 通过 cordis 事件（assistant/*）向 Vue 层广播状态变化。
 */

import { Context, Service } from 'cordis'
import type { ChatMessage, ToolCall } from '../agenttypes/assistant'
import type { ToolCategory } from '../tools/defineTool'
import { MAX_AGENT_STEPS, MAX_HISTORY_MESSAGES, MAX_EMPTY_STREAM_RETRIES, TOOL_RESULT_CHARS, TOOL_STUB_KEEP, HISTORY_CHAR_BUDGET } from '../agentconfig/defaults'
import { writeArchive } from '../utils/opfsStore'
import { isLlmConfigured, sanitizeToolName } from '../agentservices/openaiAdapter'
import { buildDatasetOverview } from '../providers/analysisContext'
import { renderDataset } from '../tools/frontendContextTools'
import { t } from '@/i18n'

// ---- 声明服务键 ----

declare module 'cordis' {
  interface Context {
    agent: AgentLoop
  }
  /** 本项目自定义事件（assistant/*）逐个显式合并进官方 Events 接口，
   *  emit/on/parallel 的 keyof Events 泛型即可获得完整类型检查。
   *  注意：不要改成 [key: string] 宽索引签名——那会让全项目所有事件名
   *  （含 cordis internal/*）失去拼写检查，事件名 typo 会静默通过编译。 */
  interface Events extends AgentEvents {}
}

// ---- 事件类型（合并进 cordis Events，供 emit/on/parallel 强类型校验） ----

export interface AgentEvents {
  /** turn 开始 */
  'assistant/turn-start': () => void
  /** 新 step 开始 */
  'assistant/step': (step: number) => void
  /** 流式文本增量 */
  'assistant/message-delta': (text: string) => void
  /** 思考流增量（推理模型 reasoning_content） */
  'assistant/reasoning-delta': (text: string) => void
  /** 流式连接中途断开（部分内容已保留） */
  'assistant/stream-truncated': () => void
  /** 工具调用开始 */
  'assistant/tool-call': (name: string, args: unknown) => void
  /** 工具调用结果 */
  'assistant/tool-result': (name: string, isError: boolean, preview: string) => void
  /** 助手消息完成 */
  'assistant/message-done': (message: ChatMessage) => void
  /** turn 结束 */
  'assistant/turn-end': (aborted: boolean) => void
  /** 错误 */
  'assistant/error': (message: string) => void
}

// ---- 快捷问题模板 ----

export interface QuickPrompt {
  /** i18n key 后缀（common.assistant.quick.<tKey>），按钮文案按界面语言显示 */
  tKey: 'summarize' | 'explain' | 'preprocess' | 'report'
  /** 发给模型的实际提问（英文，与界面语言无关） */
  text: string
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    tKey: 'summarize',
    text: 'Please summarize the current dataset — its dimensions, instrument, data mode, and key characteristics.',
  },
  {
    tKey: 'explain',
    text: 'Explain the currently selected ion image: what spatial patterns do you see in the statistics, and what might they indicate biologically?',
  },
  {
    tKey: 'preprocess',
    text: 'Based on the current dataset characteristics, what preprocessing and analysis methods would you recommend?',
  },
  {
    tKey: 'report',
    text: 'Write a brief analysis report for this dataset, including data quality, key ions found, spatial patterns, and biological interpretation.',
  },
]

// ---- AgentLoop 服务 ----

/** 单步 LLM 流的汇总结果（streamOnce 产出） */
interface StepStreamResult {
  assistantContent: string
  reasoningContent: string
  /** 按 index 合并的工具调用分片 */
  toolCallMap: Map<number, ToolCall>
  /** SSE 层检测到连接中途断开（已收部分数据） */
  streamTruncated: boolean
  /** 本轮是否收到过任何实质增量（text/reasoning/tool-call） */
  receivedContent: boolean
  /** finish 报 error（已自行 emit assistant/error），调用方应终止 turn 且不再二次报错 */
  hardError: boolean
  /** 适配器已做过一次非流式重发且未恢复（同一请求已两连败，不值得再叠加重试） */
  fallbackAttempted: boolean
}

export class AgentLoop extends Service {
  /** 当前 turn 的 AbortController */
  private abortController: AbortController | null = null
  /** 当前 turn 的对话历史（不含 system/context） */
  private history: ChatMessage[] = []

  constructor(ctx: Context) {
    super(ctx, 'agent')
  }

  /**
   * 发送 user 消息，启动一个 turn。
   * 不注入任何数据快照——页面状态一律由模型按需调用 get_page_state 等
   * 工具实时读取（避免历史中残留过时快照，且兼容纯工具调用模型）。
   */
  async send(userText: string): Promise<void> {
    if (this.abortController) {
      // 已有进行中的 turn → 先 abort
      this.stop()
      // 等待一小段时间让上一个 turn 彻底结束
      await new Promise((r) => setTimeout(r, 50))
    }

    // BYOK 前置检查：用户自配与 env 默认都没有可用凭据时不发起请求，
    // 走正常错误事件流（turn-start → error → turn-end），让 UI 出可重试的错误气泡
    if (!isLlmConfigured()) {
      this.ctx.emit('assistant/turn-start')
      this.ctx.emit('assistant/error', t('common.assistant.noApiConfigured'))
      this.ctx.emit('assistant/turn-end', false)
      return
    }

    this.abortController = new AbortController()
    const signal = this.abortController.signal

    this.ctx.emit('assistant/turn-start')

    try {
      const userMsg: ChatMessage = { role: 'user', content: userText }
      this.history.push(userMsg)
      // 裁剪历史
      await this.trimHistory()

      await this.runSteps(signal)

      // 正常结束（aborted 时 runSteps 正常 return，此处统一收口）
      this.ctx.emit('assistant/turn-end', signal.aborted)
    } catch (err: any) {
      if (signal.aborted) {
        this.ctx.emit('assistant/turn-end', true)
      } else {
        this.ctx.emit('assistant/error', err?.message || 'Unknown error')
        this.ctx.emit('assistant/turn-end', false)
      }
    } finally {
      // 只清理自己这个 turn 的 controller：旧 turn 的收尾晚于新 turn 启动时，
      // 无条件置 null 会把新 turn 的 controller 报废（stop 失效、并发互串）。
      if (this.abortController?.signal === signal) this.abortController = null
    }
  }

  /** 停止当前 turn */
  stop(): void {
    this.abortController?.abort()
  }

  /** 清空对话历史 */
  clearHistory(): void {
    this.history = []
  }

  /** 获取当前历史（供 useAssistant 持久化） */
  getHistory(): ChatMessage[] {
    return this.history
  }

  /** 恢复历史（供 useAssistant 从 localStorage 加载） */
  setHistory(messages: ChatMessage[]): void {
    this.history = messages
  }

  // ---- 内部实现 ----

  private async runSteps(signal: AbortSignal): Promise<void> {
    const tools = this.ctx.tools.schemas()

    for (let step = 1; step <= MAX_AGENT_STEPS; step++) {
      if (signal.aborted) return

      this.ctx.emit('assistant/step', step)

      // 组装 system prompt 与 messages（重试时保持不变）
      const systemPrompt = this.assembleSystemPrompt()
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...this.history,
      ]

      // 单步流（空流自动重试，见 streamOnce）。拿到结果或明确放弃后统一处理。
      const stepResult = await this.streamOnceWithRetry(messages, tools, signal)
      if (signal.aborted) return
      // 硬错误：streamOnce 已 emit 过具体的 assistant/error，终止 turn 且不二次报错
      if (stepResult === 'hard-error') return
      // 空流重试耗尽 → 报错并终止 turn
      if (!stepResult) {
        this.ctx.emit('assistant/error', t('common.assistant.noData'))
        return
      }

      const { assistantContent, reasoningContent, toolCallMap, streamTruncated } = stepResult

      // 中断流的工具调用不可信（参数可能只有半截）且本轮不会再执行——
      // 一律不写入。悬空的 tool_calls（后面没有 tool 消息应答）会让
      // 本会话后续所有请求被 OpenAI 兼容端点 400 拒掉。
      // 同理，模型流式回传的 id/name 也不可信：name 偶发带换行/点号/中文
      //（或漏发）、id 偶发为空，原样入史回喂会被严格网关按
      // messages[i].tool_calls[j].function.name 400（报错路径常被打码，
      // strictToolCallsError 认不出、折叠兜底不触发），且历史持久化后本会话
      // 每轮都炸。入史前统一清洗 name、补齐 id（工具结果按同一 id 回喂，
      // 配对不受影响；清洗后的 name 仍能命中注册表——带尾换行的名字即复原）。
      const toolCalls: ToolCall[] = streamTruncated
        ? []
        : [...toolCallMap.values()].map((tc, i) => ({
            ...tc,
            id: tc.id || `call_${Date.now()}_${step}_${i}`,
            name: sanitizeToolName(tc.name),
          }))

      // 构建 assistant 消息
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: assistantContent || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        // reasoning 只留 UI 展示用；不发回 API（OpenAI 兼容端点普遍不接受
        // assistant 消息里的 reasoning 字段，部分会直接 400）
        reasoning: reasoningContent || undefined,
      }
      // 只有存在正文或工具调用时才入列：截断在思考阶段（正文为空、工具调用
      // 已被丢弃）时把 {content: null} 且无 tool_calls 的 assistant 消息写进
      // 历史，部分严格的 OpenAI 兼容端点会对此 400，且之后每轮都失败。
      if (assistantContent || toolCalls.length > 0) {
        this.history.push(assistantMsg)
      }
      this.ctx.emit('assistant/message-done', assistantMsg)

      // 中断流 → 按提前结束处理（附截断标记），不再继续工具循环。
      // 思考阶段断流（正文为空）也走这里：UI 会展示截断提示与已有思考。
      if (streamTruncated) {
        this.ctx.emit('assistant/stream-truncated')
        return
      }

      // 无工具调用 → turn 结束
      if (toolCalls.length === 0) {
        return
      }

      // 执行工具调用（串行，只读工具量小）
      for (const tc of toolCalls) {
        if (signal.aborted) return

        let args: unknown
        try {
          args = JSON.parse(tc.arguments)
        } catch {
          args = {}
        }

        this.ctx.emit('assistant/tool-call', tc.name, args)

        const result = await this.ctx.tools.execute({
          callId: tc.id,
          name: tc.name,
          arguments: args,
          signal,
        })

        this.ctx.emit('assistant/tool-result', tc.name, result.isError, result.content.slice(0, 200))

        // 超过截断线的结果全文存 OPFS 存档。content 在 ToolRuntime 里已被
        // 截到 ≤TOOL_RESULT_CHARS——判断是否截断必须看 fullContent（按
        // content.length 判断永远不成立，存档一次都写不进去）。存档成功后
        // 在截断 marker 后附取回指引；历史预算吃紧时本条会被替换为存根，
        // 模型仍可用 read_archived_result(id) 取回全文。
        let toolContent = result.content
        if (result.fullContent) {
          const archived = await writeArchive(tc.id, result.fullContent)
          if (archived) {
            toolContent += `\n[full result archived — call read_archived_result("${tc.id}")]`
          }
        }

        // 中止后不回填工具结果：send() 对旧 turn 只等 50ms，writeArchive 的
        // 串行 OPFS 链路可能远超之——迟到的 tool 消息会排到下一 turn 的
        // user 消息之后（其配对的 tool_calls 在更早处），OpenAI/Anthropic
        // 两种协议都对此 400 且现有折梯/裁剪均无法修复，会话将持续报错
        // 直到清空。execute 内部已把中止转成正常返回，这里必须显式重查。
        if (signal.aborted) return

        // 工具结果消息回列
        this.history.push({
          role: 'tool',
          content: toolContent,
          tool_call_id: tc.id,
          name: tc.name,
        })
      }

      // 裁剪历史
      await this.trimHistory()
    }

    // 超步数：注入提示强制收尾
    const finalMsg: ChatMessage = {
      role: 'assistant',
      content: '(Maximum steps reached. Please summarize your findings based on the information gathered so far.)',
    }
    this.history.push(finalMsg)
    this.ctx.emit('assistant/message-done', finalMsg)
  }

  /**
   * 单步 LLM 流，空流自动重试。
   *
   * 「空流」= 连接成功、未报错，但一个实质增量（text/reasoning/tool-call）都没收到——
   * 中转对带 tool 历史的多步请求静默失败时最常见（拿到工具结果准备总结的那一轮）。
   * 这种失败是瞬时的，直接重发同一批 messages 往往就能恢复，因此最多重试
   * MAX_EMPTY_STREAM_RETRIES 次（指数退避）再放弃；放弃时返回 null，由调用方报 noData。
   * 真截断（收到一半内容被掐）与明确错误不重试，原样上抛。
   *
   * 重试预算的边界：适配器内部还带一层「非流式重发」降级（见 openaiAdapter）。
   * 若该重发已执行且仍为空（fallbackAttempted），说明同一请求已两连败，
   * 本层不再叠加重试——否则最坏会放大成 3×流式 + 3×非流式 = 6 次计费调用。
   *
   * 返回 'hard-error' 哨兵 = 流程内已 emit 过具体错误，调用方只终止、不重报
   * （与「重试耗尽」的 null 区分开，避免错误气泡被泛化的 noData 覆盖）。
   */
  private async streamOnceWithRetry(
    messages: ChatMessage[],
    tools: ReturnType<typeof this.ctx.tools.schemas>,
    signal: AbortSignal,
  ): Promise<StepStreamResult | 'hard-error' | null> {
    for (let attempt = 0; attempt <= MAX_EMPTY_STREAM_RETRIES; attempt++) {
      if (signal.aborted) return null
      if (attempt > 0) {
        // 指数退避：500ms / 1000ms；abort 时立即唤醒，不等退避睡完
        // （否则被中断的旧 turn 会比新 turn 活得更久，收尾事件互相干扰）
        if (signal.aborted) return null
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 500 * attempt)
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer)
              resolve()
            },
            { once: true },
          )
        })
        if (signal.aborted) return null
      }
      const res = await this.streamOnce(messages, tools, signal)
      if (signal.aborted) return null
      // 明确错误已自行 emit，终止整个 turn
      if (res.hardError) return 'hard-error'
      // 收到实质内容 → 成功（无论是否截断）
      if (res.receivedContent) return res
      // 适配器的非流式重发已两连败：放弃重试，交由 noData 报错
      if (res.fallbackAttempted) return null
      // 空流 → 还有重试次数就再来一次
    }
    return null
  }

  /**
   * 单步 LLM 流的最小单元：发一次请求、消费完整流、汇总结果。
   * 不在此处做重试与空流判定（见 streamOnceWithRetry）。
   */
  private async streamOnce(
    messages: ChatMessage[],
    tools: ReturnType<typeof this.ctx.tools.schemas>,
    signal: AbortSignal,
  ): Promise<StepStreamResult> {
    const llm = this.ctx.llm
    let assistantContent = ''
    let reasoningContent = ''
    const toolCallMap = new Map<number, ToolCall>()
    let streamTruncated = false
    /** finish 上报：本轮是否收到过实质增量（区分真截断与空 data 流） */
    let finishReceivedContent = false
    /** finish 上报：适配器的非流式重发已执行且未恢复 */
    let finishFallbackAttempted = false
    let hardError = false

    for await (const chunk of llm.stream(
      {
        model: '', // 适配器内部已 resolve
        messages,
        tools: tools.length > 0 ? tools : undefined,
      },
      signal,
    )) {
      if (signal.aborted) break

      switch (chunk.type) {
        case 'text-delta':
          assistantContent += chunk.text
          this.ctx.emit('assistant/message-delta', chunk.text)
          break

        case 'reasoning-delta':
          // 思考流：转发给 UI（reasoning-active → 正文开始后停用）
          reasoningContent += chunk.text
          this.ctx.emit('assistant/reasoning-delta', chunk.text)
          break

        case 'tool-call-delta': {
          // 合并工具调用 delta
          let tc = toolCallMap.get(chunk.index)
          if (!tc) {
            tc = { id: chunk.id || '', name: chunk.name || '', arguments: '' }
            toolCallMap.set(chunk.index, tc)
          }
          if (chunk.id) tc.id = chunk.id
          if (chunk.name) tc.name = chunk.name
          if (chunk.argumentsDelta) tc.arguments += chunk.argumentsDelta
          break
        }

        case 'finish':
          if (chunk.reason === 'error') {
            this.ctx.emit('assistant/error', chunk.error || 'LLM error')
            hardError = true
          }
          if (chunk.truncated) streamTruncated = true
          finishReceivedContent = chunk.receivedContent ?? false
          finishFallbackAttempted = chunk.fallbackAttempted ?? false
          break
      }
    }

    return {
      assistantContent,
      reasoningContent,
      toolCallMap,
      streamTruncated,
      hardError,
      fallbackAttempted: finishFallbackAttempted,
      receivedContent:
        finishReceivedContent ||
        assistantContent.length > 0 ||
        reasoningContent.length > 0 ||
        toolCallMap.size > 0,
    }
  }

  /** 组装 system prompt：基础 prompt + 静态数据集元数据 + skill catalog + tool list */
  private assembleSystemPrompt(): string {
    const sections: string[] = []

    // 基础 prompt
    sections.push(BASE_SYSTEM_PROMPT)

    // 静态数据集元数据（会话级不变的样本身份证：名称/维度/极性/仪器等）。
    // 只注入随用户操作不变的字段；动态状态（选中离子/kmeans 选择等）一律走
    // get_page_state 等工具实时读取。zarr 未加载时整段缺省。
    const dataset = buildDatasetOverview()
    if (dataset) {
      sections.push(
        '\n## Dataset Context (static session metadata)\n' +
          'The following sample metadata is fixed for this dataset — always relevant, no need to re-query:\n' +
          renderDataset(dataset),
      )
    }

    // 技能目录
    const catalog = this.ctx.skills.catalog()
    if (catalog.length > 0) {
      const lines = ['\n## Available Skills']
      for (const s of catalog) {
        lines.push(`- **${s.name}**: ${s.description}`)
        if (s.whenToUse) lines.push(`  When to use: ${s.whenToUse}`)
      }
      lines.push(
        '\nUse the `skill` tool to load detailed instructions for a skill before performing related analysis.',
      )
      sections.push(lines.join('\n'))
    }

    // 工具列表（按 category 分组：页面数据 → 文件/账户 → 化学信息 → 生物信息
    // → 谱库搜索 → 文献 → 系统，帮助模型按问题域选工具）
    const defs = this.ctx.tools.list()
    if (defs.length > 0) {
      const lines = [
        '\n## Available Tools',
        'The following tools are ALREADY registered and callable by you right now — invoke any of them directly by name; do not assume only some exist. Grouped by domain:',
      ]
      const order: { key: ToolCategory | undefined; heading: string }[] = [
        { key: 'page', heading: 'Page & dataset (live state)' },
        { key: 'files', heading: 'Files & account (backend)' },
        { key: 'chemistry', heading: 'Chemical information (PubChem / offline library / ChEBI)' },
        { key: 'biology', heading: 'Biology (HMDB metabolites / KEGG pathways)' },
        { key: 'spectral', heading: 'Spectral library search (reference MS/MS)' },
        { key: 'literature', heading: 'Literature (PubMed / Europe PMC / OpenAlex)' },
        { key: 'system', heading: 'Assistant internals' },
        { key: undefined, heading: 'Other' },
      ]
      for (const group of order) {
        const tools = defs.filter((d) => d.category === group.key)
        if (tools.length === 0) continue
        lines.push(`\n### ${group.heading}`)
        for (const t of tools) lines.push(`- **${t.name}**: ${t.description}`)
      }
      sections.push(lines.join('\n'))
    }

    return sections.join('\n')
  }

  /** content 是否已带存档指针（执行时附注 / 上一轮压缩存根）。两种存根都以
   *  `…archived…call read_archived_result("id")]` 收尾且位于 content 末尾——
   *  不能用无锚点的 includes('read_archived_result(')：assistant 正文里引用
   *  函数名（"我已用 read_archived_result(...) 取回全文"）会被误判成存根，
   *  该消息从此免于预算压缩，字符预算被架空。 */
  private hasArchivePointer(content: string): boolean {
    return /archived[^\]]*read_archived_result\("[^"]*"\)\]\s*$/.test(content)
  }

  /**
   * 裁剪历史：条数上限（MAX_HISTORY_MESSAGES）+ 字符预算（HISTORY_CHAR_BUDGET）。
   * 预算从最旧开始吃：超长 tool 结果替换为「截断 + OPFS 存档」存根（模型可
   * 用 read_archived_result 取回），更早的长 assistant 回复压成前缀。最近
   * 4 条始终完整保留（当前正在推理的上下文）。
   */
  private async trimHistory(): Promise<void> {
    if (this.history.length > MAX_HISTORY_MESSAGES) {
      let start = this.history.length - MAX_HISTORY_MESSAGES
      // 窗口起点若是 tool 消息，其父 assistant(tool_calls) 已被裁掉——
      // 悬空的 tool 消息会让本会话后续所有请求被 OpenAI 兼容端点 400 拒掉
      //（即 runSteps 里「悬空 tool_calls」注释的镜像情形）。
      while (start < this.history.length && this.history[start]!.role === 'tool') start++
      // 两个必须回退到 user 起点的情形（窗口略超条数上限无害，token 上限
      // 由字符预算兜底）：
      // 1) 跳过 tool 后窗口以 assistant 开头——Anthropic 端点要求首条消息
      //    必须 user，assistant-first 一律 400 且此后每轮都炸（整会话报废）；
      // 2) 单步并行工具调用 ≥ MAX_HISTORY_MESSAGES 时 start 会越过尾端，
      //    slice 出空窗口（两家端点都 400）。
      if (start >= this.history.length) start = this.history.length - 1
      while (start > 0 && this.history[start]!.role !== 'user') start--
      this.history = this.history.slice(start)
    }

    // 字符预算（条数裁剪后仍可能超：一批接近截断线的工具结果 + 长回复）
    let total = 0
    for (const m of this.history) total += m.content?.length ?? 0
    if (total <= HISTORY_CHAR_BUDGET) return

    const keepRecent = 4
    for (let i = 0; i < this.history.length - keepRecent && total > HISTORY_CHAR_BUDGET; i++) {
      const m = this.history[i]!
      if (!m.content) continue
      // 已带存档指针的（执行时存过档 / 上一轮已压过）不再二次压缩——
      // 再压会把指针本身截坏（锚定匹配见 hasArchivePointer）
      if (this.hasArchivePointer(m.content)) continue
      if (m.role === 'tool') {
        // 工具结果 content 上限是 TOOL_RESULT_CHARS，按 >TOOL_RESULT_CHARS
        // 触发永远不成立（20 × 2000 = 40k 仍可能超 60k 预算）。这里对超过
        // TOOL_STUB_KEEP 的结果先存档再压成存根；存档失败不压（压了正文
        // 就永久丢了）。
        if (m.content.length <= TOOL_STUB_KEEP) continue
        const archived = await writeArchive(m.tool_call_id ?? '', m.content)
        if (!archived) continue
        const stub =
          `${m.content.slice(0, TOOL_STUB_KEEP)}\n` +
          `…[truncated for context budget — full result archived, call read_archived_result("${m.tool_call_id}")]`
        total -= m.content.length - stub.length
        m.content = stub
      } else if (m.role === 'assistant') {
        if (m.content.length <= TOOL_RESULT_CHARS) continue
        const stub = `${m.content.slice(0, TOOL_RESULT_CHARS)}\n…[earlier reply truncated for context budget]`
        total -= m.content.length - stub.length
        m.content = stub
      }
    }
  }
}

// ---- 基础 system prompt ----

const BASE_SYSTEM_PROMPT = `You are a Mass Spectrometry Imaging (MSI) data analysis assistant for the SpatialXomics platform.

## Your Role
Help researchers analyze MSI datasets by:
1. Summarizing dataset characteristics (dimensions, instrument, m/z range)
2. Interpreting ion images and spatial patterns
3. Recommending preprocessing and analysis methods
4. Writing analysis reports
5. Retrieving file and process information from the backend

## Guidelines
- Use the available tools to get real data — never guess numbers.
- Your full tool set is listed under "## Available Tools" below; every tool there is already registered and directly callable. Do not assume only some exist.
- When interpreting ion images, connect spatial patterns to possible biological significance.
- For method recommendations, explain why a method is suitable for the specific dataset characteristics.
- Keep explanations clear and accessible to researchers with varying MSI expertise.
- Use the \`skill\` tool to load domain-specific instructions when needed.
- Be concise: aim for 2-4 paragraphs unless the user asks for a detailed report.

## Data Context
Static sample metadata (name, dimensions, polarity, analyzer, ion source, m/z range) is provided
below in the Dataset Context section — treat it as always-current session knowledge.
Dynamic page state (selected ion, clustering selection, annotation focus) is NOT pre-injected:
for any question involving the currently selected data, first call the \`get_page_state\` tool to
see the live page state, then use the specialized \`get_*\` tools (e.g. \`get_ion_image_stats\`,
\`get_annotation_top\`, \`get_kmeans_summary\`) for detailed statistics. Never
assume data from previous turns is still current — the user may have changed the selected ion;
when in doubt, call \`get_page_state\` again.`

// ---- 插件入口 ----

export const agentLoopProvider = (ctx: Context) => {
  // 依赖声明：AgentLoop 内部访问 ctx.llm / ctx.tools / ctx.skills（兄弟服务）。
  // cordis 4 的属性解析要求在自身 fiber 里声明过 inject 才能拿到兄弟服务，
  // 否则抛 "cannot get property X without inject"（见 __tests__/agentLoop.test.ts）。
  // inject 回调会等依赖就绪才执行——bootstrap 的加载顺序（llm → tools → skills
  // → … → agentLoop）下立即满足。
  ctx.inject(['llm', 'tools', 'skills'], (ctx2) => {
    new AgentLoop(ctx2)
  })
}