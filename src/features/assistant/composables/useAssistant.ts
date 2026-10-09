/**
 * useAssistant：assistant 的 Vue 桥。
 *
 * - 懒建 cordis context（getAssistantContext 单例）
 * - 订阅 assistant/* 事件 → 响应式状态（messages / streaming / error）
 * - send / stop / clear / retry / quickPrompt
 * - localStorage 历史持久化（≤ MAX_HISTORY_MESSAGES 条，不含 system/context）
 */

import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiChatItem } from '../agenttypes/assistant'
import { QUICK_PROMPTS } from '../plugins/agentLoop'
import { getAssistantContext } from '../plugins'
import { buildPageState } from '../providers/analysisContext'
import { MAX_HISTORY_MESSAGES, MAX_UI_MESSAGES } from '../agentconfig/defaults'
import {
  appendHistoryLines,
  readHistoryLines,
  clearAssistantOpfs,
  rotateSessionId,
} from '../utils/opfsStore'
import { STORAGE_KEYS } from '@/shared/config/storageKeys'
import { t } from '@/i18n'

// ---- 模块级共享状态（多个组件实例共享同一对话） ----

const messages = ref<UiChatItem[]>([])
const streaming = ref(false)
const error = ref<string | null>(null)
/** 当前是否有数据集上下文（结果页已加载 zarr 数据时为 true） */
const hasContext = ref(false)
/** 技能按钮（排在快捷提问之前）：skills 服务就绪后填充 */
const skillButtons = ref<{ name: string; text: string }[]>([])
/** UI 之外还有更早的 OPFS 历史可加载 */
const earlierAvailable = ref(false)

/** 当前正在流式输出的 assistant 消息 id（增量路由目标：总是最新 turn 的占位） */
let currentAssistantId: string | null = null
/** 进行中 turn 的 assistant 占位消息 id，FIFO 配对。
 *  停止后立即发新消息时，旧 turn 的 turn-end 可能晚于新 turn 的 turn-start
 *  触发——按「谁创建谁回收」的队列配对，旧收尾只 finalize 自己的占位，
 *  不会把新占位提前定型/置 null（旧实现会丢掉新 turn 的全部增量）。 */
let pendingAssistantIds: string[] = []
/** 当前 turn 内收到的错误文本（turn-end 时写入配对气泡；error 事件本身
 *  不带 turn 身份，靠「error 后紧跟同 turn 的 turn-end」传递） */
let turnError: string | null = null
/** 是否已绑定事件监听（模块级一次） */
let bound = false

let _idCounter = 0
function nextId(): string {
  return `msg_${Date.now()}_${++_idCounter}`
}

// ---- 技能按钮（curated 顺序） ----

/** 按钮展示顺序：完成度高的成品 skill 在前 */
const SKILL_BUTTON_ORDER = [
  'annotation-review',
  'adduct-isotope-analysis',
  'metabolite-biology',
  'literature-evidence',
  'msi-analysis',
  'ion-image-interpretation',
] as const

/** 技能按钮点击后发出的提示词（驱动模型加载 SKILL.md 并按其模板执行） */
function skillTriggerPrompt(name: string): string {
  return (
    `Load the "${name}" skill with the \`skill\` tool first, then follow its workflow and ` +
    `output template to analyze the current data, and summarize the key findings with ` +
    `explicit judgment criteria.`
  )
}

// ---- 事件绑定（懒，首次调用 useAssistant 时） ----

function bindEvents() {
  if (bound) return
  bound = true

  const ctx = getAssistantContext()

  // 技能目录 → 按钮（skills 服务由异步 fiber 注册，就绪后一次性填充）
  ctx.inject(['skills'], (ctx2) => {
    const catalog = ctx2.skills.catalog()
    const rank = (name: string) => {
      const i = (SKILL_BUTTON_ORDER as readonly string[]).indexOf(name)
      return i === -1 ? SKILL_BUTTON_ORDER.length : i
    }
    skillButtons.value = [...catalog]
      .sort((a, b) => rank(a.name) - rank(b.name))
      .map((s) => ({ name: s.name, text: skillTriggerPrompt(s.name) }))
  })

  // 模型侧历史恢复：agent 服务由异步 fiber 创建，就绪后把 localStorage 恢复的
  // UI 消息转成干净的 user/assistant 对注入（此前 setHistory 无任何调用方，
  // 刷新页面后 UI 显示完整对话而模型上下文为空）。只取非空正文、跳过错误/
  // 截断条目——UI 专用字段无法构成合法的 tool 消息链，严格端点会 400。
  ctx.inject(['agent'], (ctx2) => {
    const restored = messages.value
      .filter((m) => m.content && !m.error && !m.truncated)
      .map((m) => ({ role: m.role, content: m.content }))
    ctx2.agent.setHistory(restored)
  })

  ctx.on('assistant/turn-start', () => {
    streaming.value = true
    error.value = null
    turnError = null
    // 创建流式 assistant 消息占位（入 FIFO 队列，turn-end 按配对回收）
    currentAssistantId = nextId()
    pendingAssistantIds.push(currentAssistantId)
    messages.value.push({
      id: currentAssistantId,
      role: 'assistant',
      content: '',
      pending: true,
      toolCalls: [],
    })
  })

  ctx.on('assistant/message-delta', (text: string) => {
    if (!currentAssistantId) return
    const last = messages.value.find((m) => m.id === currentAssistantId)
    if (last) {
      last.content += text
      // 正文开始 → 思考结束（折叠态保留 reasoning 供查看）
      last.reasoningActive = false
    }
  })

  ctx.on('assistant/reasoning-delta', (text: string) => {
    if (!currentAssistantId) return
    const last = messages.value.find((m) => m.id === currentAssistantId)
    if (last) {
      last.reasoning = (last.reasoning ?? '') + text
      last.reasoningActive = true
    }
  })

  ctx.on('assistant/stream-truncated', () => {
    // 中转站断流：保留已有内容并打截断标记（不弹错误）。正文为空（思考阶段
    // 断流）时把提示语直接放进正文，避免空气泡。
    if (!currentAssistantId) return
    const last = messages.value.find((m) => m.id === currentAssistantId)
    if (last) {
      if (last.content) {
        last.truncated = true
      } else {
        last.content = t('common.assistant.truncated')
        // 同样打截断标：该文案是 UI 提示而非模型产出，否则历史恢复注入
        // 过滤（m.content && !m.error && !m.truncated）会把它当真实助手
        // 发言回灌模型（换语言后旧 locale 文案还会永久烙进历史）
        last.truncated = true
        last.reasoningActive = false
      }
    }
  })

  ctx.on('assistant/tool-call', (name: string) => {
    if (!currentAssistantId) return
    const last = messages.value.find((m) => m.id === currentAssistantId)
    if (last) {
      last.toolCalls!.push({ name, isError: false, preview: '…' })
    }
  })

  ctx.on('assistant/tool-result', (name: string, isError: boolean, preview: string) => {
    if (!currentAssistantId) return
    const last = messages.value.find((m) => m.id === currentAssistantId)
    if (last) {
      // 更新对应工具条目（最后一条同名记录）
      const entry = [...last.toolCalls!].reverse().find((t) => t.name === name)
      if (entry) {
        entry.isError = isError
        entry.preview = preview
      }
    }
  })

  ctx.on('assistant/turn-end', (aborted: boolean) => {
    // FIFO 配对回收本 turn 的占位（而非「当前的」占位——那是竞态下最新
    // turn 的，提前定型会把流式中的气泡冻结在半截内容上）
    const id = pendingAssistantIds.shift()
    if (id) {
      const last = messages.value.find((m) => m.id === id)
      if (last) {
        last.pending = false
        last.reasoningActive = false
        last.interrupted = aborted
        if (turnError && !last.error) last.error = turnError
        // 终极兜底：turn 正常结束（非中断、无错误）但气泡什么内容都没有，
        // 说明走了某条未覆盖的空路径——填一条可读提示，绝不留死空白。
        if (
          !aborted &&
          !last.error &&
          !last.content &&
          !last.reasoning &&
          (last.toolCalls?.length ?? 0) === 0
        ) {
          last.error = t('common.assistant.emptyResponse')
        }
      }
      turnError = null
      // 增量路由指向仍在流式的最新占位（若有）
      currentAssistantId = pendingAssistantIds[pendingAssistantIds.length - 1] ?? null
    }
    streaming.value = pendingAssistantIds.length > 0
    persistTurnToOpfs()
    capUiMessages()
    saveHistory()
  })

  ctx.on('assistant/error', (message: string) => {
    error.value = message
    // 错误文本延后到配对的 turn-end 写入气泡（error 事件不动占位消息，
    // 也不重置 streaming——同 turn 的 turn-end 马上会到）
    turnError = message
  })
}

// ---- OPFS 持久化（完整历史）与 UI 上限 ----

/** 已写入 OPFS 的消息 id。以 id 幂等去重，与数组下标无关——loadEarlier
 *  前插 50 条、重试、中断竞态下旧 turn 收尾晚于新 turn 启动等场景都不会
 *  重复追加或漏写（下标基线在这些场景下全部失效）。 */
const persistedIds = new Set<string>()

/** 把尚未持久化的完整消息（含工具调用/思考/错误标记）整批追加进 OPFS
 *  会话文件。遇到仍在流式输出（pending）的占位即停——它尚未定型，留给
 *  它自己的 turn-end 补写（user 消息永远排在占位之前，因此一定会入档）。
 *  **成功追加后才标记已持久化**：OPFS 写失败（配额/隐私模式/目录被清）时
 *  这些消息保持未标记，下一个 turn 结束会把它们连同新消息整批重试——
 *  先标记后 fire-and-forget 的旧实现会让失败轮次永久静默丢失。 */
function persistTurnToOpfs(): void {
  const fresh: UiChatItem[] = []
  for (const m of messages.value) {
    if (persistedIds.has(m.id)) continue
    if (m.pending) break
    fresh.push(m)
  }
  if (fresh.length === 0) return
  void appendHistoryLines(fresh.map((m) => ({ ...m, pending: false }))).then((ok) => {
    if (ok) for (const m of fresh) persistedIds.add(m.id)
  })
}

/** UI 消息数上限：超出从最旧裁剪（完整内容仍在 OPFS，loadEarlier 可取回）。 */
function capUiMessages(): void {
  if (messages.value.length > MAX_UI_MESSAGES) {
    messages.value.splice(0, messages.value.length - MAX_UI_MESSAGES)
    earlierAvailable.value = true
  }
}

/** 从 OPFS 会话文件取回更早的消息，按 id 去重后前置到 UI（每次最多 50 条）。 */
async function loadEarlier(): Promise<void> {
  const lines = await readHistoryLines()
  const known = new Set(messages.value.map((m) => m.id))
  const older = lines.filter(
    (l): l is UiChatItem =>
      !!l && typeof l === 'object' && 'id' in l && 'role' in l && !known.has((l as UiChatItem).id),
  )
  if (older.length > 0) {
    const batch = older.slice(-50)
    // 回填的消息本来就来自 OPFS——标记已持久化，turn-end 不会重复追加
    for (const m of batch) persistedIds.add(m.id)
    messages.value = [...batch, ...messages.value]
  }
  earlierAvailable.value = older.length > 50
}

// ---- 历史持久化 ----

function saveHistory(): void {
  try {
    const trimmed = messages.value.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
      ...m,
      pending: false,
    }))
    localStorage.setItem(STORAGE_KEYS.assistantHistory, JSON.stringify(trimmed))
  } catch {
    // localStorage 不可用（隐私模式等）时静默跳过
  }
}

function loadHistory(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.assistantHistory)
    if (!raw) return
    const parsed = JSON.parse(raw) as UiChatItem[]
    if (Array.isArray(parsed) && parsed.length > 0) {
      messages.value = parsed
    }
  } catch {
    // 损坏的历史静默丢弃
  }
}

/** 数据集切换后旧对话不再可信（历史 tool 结果属于旧样本，而系统提示的
 *  Dataset Context 按当前 turn 描述新样本）：丢弃 localStorage 历史并清空
 *  OPFS 档案。标志由 VizWorkbench 挂载时写入（该处不能静态 import 本模块，
 *  否则 agent 栈会被拉进 vizworkbench 路由 chunk，见 plugins/index.ts 的
 *  懒加载契约）。幂等：两个消费点（模块初始化 + useAssistant() 调用——后者
 *  覆盖会话内切换数据集而本模块早已加载的场景）谁先到谁消费。
 *  @returns 是否执行了清空（调用方据此同步清掉 agent 侧历史） */
function consumePendingDatasetClear(): boolean {
  let pending = false
  try {
    pending = localStorage.getItem(STORAGE_KEYS.assistantPendingClear) === '1'
    if (pending) {
      localStorage.removeItem(STORAGE_KEYS.assistantPendingClear)
      localStorage.removeItem(STORAGE_KEYS.assistantHistory)
    }
  } catch {
    // localStorage 不可用（隐私模式等）时静默跳过
  }
  if (!pending) return false
  messages.value = []
  persistedIds.clear()
  earlierAvailable.value = false
  void clearAssistantOpfs()
  rotateSessionId()
  return true
}

// 模块级加载一次（先消费数据集切换的待清空标志，再恢复历史——顺序不能反；
// 此刻 agent 尚未创建，bindEvents 的 setHistory 注入的是清空后的空列表，
// 故无需同步模型侧）
consumePendingDatasetClear()
loadHistory()
// localStorage 恢复的消息此前已入档——标记已持久化，避免下个 turn 结束时
// 整批重复追加（id 幂等基线的初始化）
for (const m of messages.value) persistedIds.add(m.id)
// localStorage 只恢复了精简的最近消息；OPFS 里可能有更早的完整历史
// （其中出现过的 id 一并标记，防止 loadEarlier 回填前发生持久化竞态）
void (async () => {
  const lines = await readHistoryLines()
  for (const l of lines) {
    if (l && typeof l === 'object' && typeof (l as UiChatItem).id === 'string') {
      persistedIds.add((l as UiChatItem).id)
    }
  }
  if (lines.length > messages.value.length) earlierAvailable.value = true
})()

// ---- composable 导出 ----

export function useAssistant() {
  // 会话内数据集切换（模块已加载、agent 可能已在跑）：同步清掉模型侧历史，
  // 避免 UI 空而 agent 上下文仍带旧样本的对话
  if (consumePendingDatasetClear()) getAssistantContext().agent?.clearHistory()
  bindEvents()
  const { t } = useI18n()

  /**
   * 快捷提问按钮文案（tKey → 已翻译文本）。
   * key 写成静态字面量而非拼接——@intlify/no-dynamic-keys 禁动态 key，
   * 且集中在此一份，五套聊天视图共用。
   */
  const quickLabels = computed<Record<(typeof QUICK_PROMPTS)[number]['tKey'], string>>(
    () => ({
      summarize: t('common.assistant.quick.summarize'),
      explain: t('common.assistant.quick.explain'),
      preprocess: t('common.assistant.quick.preprocess'),
      report: t('common.assistant.quick.report'),
    }),
  )

  /** 技能按钮文案（技能名 → 已翻译标签；key 同样写死静态字面量） */
  const skillLabels = computed<Record<string, string>>(() => ({
    'annotation-review': t('common.assistant.skillBtns.annotationReview'),
    'adduct-isotope-analysis': t('common.assistant.skillBtns.adductIsotope'),
    'metabolite-biology': t('common.assistant.skillBtns.metaboliteBiology'),
    'literature-evidence': t('common.assistant.skillBtns.literatureEvidence'),
    'msi-analysis': t('common.assistant.skillBtns.msiAnalysis'),
    'ion-image-interpretation': t('common.assistant.skillBtns.ionImage'),
  }))

  /** 刷新上下文可用性（在 send 前调用，或页面数据变化时调用） */
  function refreshContext(): void {
    // 轻量直读（buildPageState 不做矩阵统计）：此处只需要一个布尔徽标，
    // 且每次 send 都会调用，不该跑 buildAnalysisContext 的重统计管线。
    const s = buildPageState()
    hasContext.value = !!(
      s.dataset ||
      s.selectedIon ||
      s.meanSpectrumAvailable ||
      s.kmeans ||
      (s.annotationCount ?? 0) > 0
    )
  }

  async function send(text: string): Promise<void> {
    // 面板常开时跨数据集导航不会重挂 ChatTDesign（consumePendingDatasetClear
    // 的另外两个消费点——模块初始化与 useAssistant()——都不会触发）：
    // 发起提问前再消费一次待清空标志，保证模型上下文与系统提示的
    // Dataset Context 同源，而不是拿旧样本的 tool 结果回答新样本的问题
    if (consumePendingDatasetClear()) getAssistantContext().agent?.clearHistory()
    refreshContext()
    messages.value.push({ id: nextId(), role: 'user', content: text })
    const ctx = getAssistantContext()
    const agent = ctx.agent
    if (!agent) {
      // bootstrap 窗口内 agent 服务尚未注册（异步 fiber）——出可重试的错误气泡，
      // 不能裸调 ctx.agent.send 抛 TypeError 留下无事件的死状态
      const msg = t('common.assistant.somethingWrong')
      messages.value.push({ id: nextId(), role: 'assistant', content: '', error: msg, toolCalls: [] })
      error.value = msg
      saveHistory()
      return
    }
    await agent.send(text)
  }

  function stop(): void {
    getAssistantContext().agent?.stop()
  }

  function clear(): void {
    getAssistantContext().agent?.clearHistory()
    messages.value = []
    error.value = null
    earlierAvailable.value = false
    persistedIds.clear()
    pendingAssistantIds = []
    currentAssistantId = null
    turnError = null
    void clearAssistantOpfs()
    // 轮换会话文件：清空后的新对话不再追加进旧 jsonl（否则单文件无限增长，
    // trimOldSessions 的按量保留也永远只有一个文件可管）
    rotateSessionId()
    saveHistory()
  }

  /** 重试：移除最后的错误回复，重发最后一条 user 消息 */
  async function retry(): Promise<void> {
    // 回合进行中不重试：错误气泡的按钮在流式中仍可点，此刻重发会走
    // agentLoop.send 的 stop+50ms 并发路径（旧 turn 迟到的收尾可能把
    // tool 消息排到新 user 消息之后——见 agentLoop 工具循环的注释）
    if (streaming.value) return
    // 移除末尾的 assistant 错误消息
    while (messages.value.length > 0 && messages.value[messages.value.length - 1]!.role === 'assistant') {
      messages.value.pop()
    }
    const lastUser = [...messages.value].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    await send(lastUser.content)
  }

  const quickPrompts = QUICK_PROMPTS

  return {
    messages,
    streaming,
    error,
    hasContext,
    quickPrompts,
    quickLabels,
    skillButtons,
    skillLabels,
    earlierAvailable,
    loadEarlier,
    send,
    stop,
    clear,
    retry,
    refreshContext,
  }
}
