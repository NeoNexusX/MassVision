/**
 * 用户自配 LLM（BYOK：Bring Your Own Key）的持久化与解析。
 *
 * 用户可在助手面板设置里填 API 地址 / 密钥 / 模型名 + 协议类型（provider），
 * 覆盖部署时的 env 默认（VITE_LLM_*）。值存 localStorage（明文——只存在用户
 * 自己的浏览器，不经任何后端，这是 BYOK 的常规做法，设置面板里有对应提示）。
 *
 * 这里是**无 Vue 依赖的纯模块**：services 层的适配器直接 import 读值
 * （依赖方向 services → config），composable 层的 useLlmSettings 在其上包响应式给设置 UI。
 */

import { STORAGE_KEYS } from '@/shared/config/storageKeys'

/** 协议类型：openai = OpenAI 兼容 /chat/completions；anthropic = 原生 /v1/messages */
export type LlmProviderKind = 'openai' | 'anthropic'

/** 用户自配的四项；空字符串表示「未填、走兜底」，provider 缺省 openai（旧记录兼容） */
export interface UserLlmConfig {
  /** OpenAI 兼容基地址，如 https://api.deepseek.com/v1（末尾斜杠会归一化） */
  baseUrl: string
  apiKey: string
  model: string
  provider: LlmProviderKind
}

const EMPTY: UserLlmConfig = { baseUrl: '', apiKey: '', model: '', provider: 'openai' }

/** provider 字段解析：仅认 'anthropic'，其余（缺失/脏值）一律回退 openai */
function normalizeProvider(v: unknown): LlmProviderKind {
  return v === 'anthropic' ? 'anthropic' : 'openai'
}

/** localStorage → 内存。损坏/缺失一律回退全空（与 useAssistant.loadHistory 同策略） */
export function loadUserLlmConfig(): UserLlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.assistantLlmConfig)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<UserLlmConfig>
    return {
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl.trim() : '',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '',
      model: typeof parsed.model === 'string' ? parsed.model.trim() : '',
      // 旧记录无 provider 字段 → openai（行为与升级前完全一致）
      provider: normalizeProvider(parsed.provider),
    }
  } catch {
    return { ...EMPTY }
  }
}

/** 内存 → localStorage；全空（含默认 provider）时直接删除 key（回到 env 兜底） */
export function saveUserLlmConfig(config: UserLlmConfig): void {
  const normalized: UserLlmConfig = {
    baseUrl: config.baseUrl.trim(),
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
    provider: normalizeProvider(config.provider),
  }
  try {
    if (
      !normalized.baseUrl &&
      !normalized.apiKey &&
      !normalized.model &&
      normalized.provider === 'openai'
    ) {
      localStorage.removeItem(STORAGE_KEYS.assistantLlmConfig)
    } else {
      localStorage.setItem(STORAGE_KEYS.assistantLlmConfig, JSON.stringify(normalized))
    }
  } catch {
    // localStorage 不可用（隐私模式等）时静默跳过
  }
}

/** 清除用户配置（回到 env 兜底） */
export function clearUserLlmConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.assistantLlmConfig)
  } catch {
    // 同上
  }
}
