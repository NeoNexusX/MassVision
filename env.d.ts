/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_OSS_ENDPOINT: string
  /** LLM 中转站基地址（OpenAI 兼容，不含 /chat/completions 后缀） */
  readonly VITE_LLM_PROXY_URL: string
  /** LLM 中转站限额子 key（放 env/.env.*.local，不进 git） */
  readonly VITE_LLM_API_KEY: string
  /** 默认模型名 */
  readonly VITE_LLM_MODEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /**
   * index.html 顶部内联脚本提前发起的 config.json 请求，供 runtimeConfig 的 loadConfig() 复用。
   * loadConfig() 取用后会置回 undefined（Response 的 body 只能消费一次）。
   */
  __configPromise?: Promise<Response>
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, unknown>
  export default component
}
