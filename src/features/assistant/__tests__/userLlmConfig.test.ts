import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearUserLlmConfig,
  loadUserLlmConfig,
  saveUserLlmConfig,
} from '../agentconfig/userLlmConfig'
import {
  humanizeHttpError,
  isLlmConfigured,
  resolveApiKey,
  resolveEndpoint,
  resolveModel,
} from '../agentservices/openaiAdapter'
import { STORAGE_KEYS } from '@/shared/config/storageKeys'

/** 种一份用户配置（测试环境无 VITE_LLM_* env，用户配置是唯一来源）。
 *  raw 控制是否绕过 save 归一化（模拟旧版/损坏记录的原样落盘）。 */
function seedUserConfig(
  baseUrl?: string,
  apiKey?: string,
  model?: string,
  provider?: string,
  raw = false,
): void {
  const value = { baseUrl: baseUrl ?? '', apiKey: apiKey ?? '', model: model ?? '', provider }
  if (raw) {
    // 旧版记录没有 provider 字段——按原样写入（缺键）
    const { provider: _drop, ...legacy } = value
    localStorage.setItem(
      STORAGE_KEYS.assistantLlmConfig,
      JSON.stringify(provider === undefined ? legacy : value),
    )
  } else {
    saveUserLlmConfig(value as ReturnType<typeof loadUserLlmConfig>)
  }
}

describe('userLlmConfig（BYOK 持久化）', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty config when nothing stored', () => {
    expect(loadUserLlmConfig()).toEqual({ baseUrl: '', apiKey: '', model: '', provider: 'openai' })
  })

  it('round-trips and trims values', () => {
    saveUserLlmConfig({ baseUrl: ' https://api.test/v1/ ', apiKey: ' sk-1 ', model: ' m ', provider: 'openai' })
    expect(loadUserLlmConfig()).toEqual({
      baseUrl: 'https://api.test/v1/',
      apiKey: 'sk-1',
      model: 'm',
      provider: 'openai',
    })
  })

  it('round-trips provider=anthropic and rejects dirty provider values', () => {
    saveUserLlmConfig({ baseUrl: '', apiKey: 'sk-1', model: '', provider: 'anthropic' })
    expect(loadUserLlmConfig().provider).toBe('anthropic')
    // 脏值回退 openai
    seedUserConfig('', 'sk-1', '', 'gpt', true)
    expect(loadUserLlmConfig().provider).toBe('openai')
  })

  it('legacy records without provider default to openai (升级前存的记录不炸)', () => {
    seedUserConfig('https://x', 'sk', 'm', undefined, true)
    const cfg = loadUserLlmConfig()
    expect(cfg.provider).toBe('openai')
    expect(cfg.baseUrl).toBe('https://x')
  })

  it('removes the storage key when saving all-empty config', () => {
    seedUserConfig('https://x', 'sk', 'm')
    saveUserLlmConfig({ baseUrl: '', apiKey: '', model: '', provider: 'openai' })
    expect(localStorage.getItem(STORAGE_KEYS.assistantLlmConfig)).toBeNull()
  })

  it('keeps the storage key when only provider=anthropic is set (凭据待填)', () => {
    saveUserLlmConfig({ baseUrl: '', apiKey: '', model: '', provider: 'anthropic' })
    expect(localStorage.getItem(STORAGE_KEYS.assistantLlmConfig)).not.toBeNull()
    expect(loadUserLlmConfig().provider).toBe('anthropic')
  })

  it('clearUserLlmConfig removes the key', () => {
    seedUserConfig('https://x', 'sk', 'm')
    clearUserLlmConfig()
    expect(loadUserLlmConfig()).toEqual({ baseUrl: '', apiKey: '', model: '', provider: 'openai' })
  })

  it('tolerates corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEYS.assistantLlmConfig, '{not json')
    expect(loadUserLlmConfig()).toEqual({ baseUrl: '', apiKey: '', model: '', provider: 'openai' })
  })
})

describe('openaiAdapter resolve*（用户配置 → env 兜底）', () => {
  beforeEach(() => localStorage.clear())

  it('endpoint falls back to env when no user config (env 为空 → 相对路径)', () => {
    expect(resolveEndpoint().url).toBe('/chat/completions')
  })

  it('user baseUrl overrides env and trailing slashes are normalized', () => {
    seedUserConfig('https://api.deepseek.com/v1//')
    // dev（含测试）模式下 BYOK 改走 vite 同源 relay 转发（绕开本机代理），
    // 绝对端点用 resolveEndpoint().absolute 断言
    expect(resolveEndpoint().url).toBe('/llm-relay/v1/chat/completions')
    expect(resolveEndpoint().absolute).toBe('https://api.deepseek.com/v1/chat/completions')
  })

  it('user apiKey overrides env', () => {
    seedUserConfig('', 'sk-user')
    expect(resolveApiKey()).toBe('sk-user')
  })

  it('user model takes priority without touching runtime config', () => {
    // 用户填了 model 时不应读 config.json（测试环境未 loadConfig，读了会抛错）
    seedUserConfig('', '', 'deepseek-reasoner')
    expect(resolveModel()).toBe('deepseek-reasoner')
  })

  it('isLlmConfigured requires both baseUrl and apiKey from either source', () => {
    expect(isLlmConfigured()).toBe(false)
    seedUserConfig('https://api.test')
    expect(isLlmConfigured()).toBe(false)
    seedUserConfig('', 'sk-1')
    expect(isLlmConfigured()).toBe(false)
    seedUserConfig('https://api.test', 'sk-1')
    expect(isLlmConfigured()).toBe(true)
  })

  it('isLlmConfigured: anthropic 只要求密钥（默认端点兜底，env 不适用）', () => {
    seedUserConfig('', '', '', 'anthropic')
    expect(isLlmConfigured()).toBe(false)
    seedUserConfig('', 'sk-ant', '', 'anthropic')
    expect(isLlmConfigured()).toBe(true)
  })
})

describe('humanizeHttpError', () => {
  it('translates 401 with upstream message', () => {
    expect(humanizeHttpError(401, '{"error":{"message":"Invalid key"}}')).toBe(
      'API key rejected (HTTP 401): Invalid key',
    )
  })

  it('translates 404 with Base URL hint', () => {
    expect(humanizeHttpError(404, '')).toBe(
      'Endpoint not found (HTTP 404) — check the API Base URL',
    )
  })

  it('keeps raw status for non-JSON bodies', () => {
    expect(humanizeHttpError(503, 'oops')).toBe('LLM provider error (HTTP 503)')
  })
})
