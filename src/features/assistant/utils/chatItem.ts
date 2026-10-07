/**
 * UiChatItem 的 UI 展示谓词（纯函数，聊天视图共用）。
 *
 * 此前同一谓词在多套聊天视图里以内联表达式、函数、computed 多种形态各写
 * 一份，条件一旦变化容易漏改。
 */
import type { UiChatItem } from '../agenttypes/assistant'

/** turn 已发起但尚无文本、思考与工具调用 → 显示"正在输入"动画 */
export function isAssistantTyping(m: UiChatItem): boolean {
  return (
    m.role === 'assistant' &&
    !!m.pending &&
    !m.content &&
    !m.reasoning &&
    (m.toolCalls?.length ?? 0) === 0
  )
}
