import axios, { AxiosError } from 'axios'
import { ENV, STORAGE_KEYS } from '@/shared/config'

// Top-level Response body
interface ErrorResponse {
  detail: FastAPIError[]
}

// Response error model definition
interface FastAPIError {
  loc: string[]
  msg: string
  type: string
}

// Normalize backend error shapes into a readable string.
// Handles FastAPI validation arrays ([{ loc, msg, type }]), objects with msg/message,
// and plain strings. Objects/arrays without a message fall back to a safe JSON dump.
export function formatErrorMessage(detail: unknown): string {
  const safeStringify = (o: unknown) => {
    try {
      return JSON.stringify(o)
    } catch {
      return String(o)
    }
  }

  if (detail == null) return 'Unknown Error'

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string; message?: string } | undefined
    return first?.msg || first?.message || safeStringify(detail) || 'Response Failed'
  }

  if (typeof detail === 'object') {
    const obj = detail as { msg?: string; message?: string }
    return obj.msg || obj.message || safeStringify(detail) || 'Response Failed'
  }

  return String(detail) || 'Response Failed'
}

const error_catch = (error: AxiosError<ErrorResponse>) => {
  if (error.response?.data) {
    const raw = (error.response.data as any) || {}
    const candidate = raw?.detail ?? raw?.message ?? raw?.msg ?? error.message ?? raw
    const errorMessage = formatErrorMessage(candidate)
    // set formatted message on the error and also on response.data for callers
    try {
      error.message = errorMessage
    } catch {}
    try {
      ;(error.response.data as any).message = errorMessage
    } catch {}
  }
  return Promise.reject(error)
}

// Authenticated API
const auth_api = axios.create({ baseURL: ENV.apiBase })

// Inject auth token
auth_api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

auth_api.interceptors.response.use((response) => response, error_catch)

// Public API
const api = axios.create({ baseURL: ENV.apiBase })

// Public API response interceptor
api.interceptors.response.use((response) => response, error_catch)

export function extractBackendError(error: any): string {
  const candidate =
    error?.response?.data?.detail ??
    error?.response?.data?.message ??
    error?.response?.data?.msg ??
    error?.message
  return formatErrorMessage(candidate)
}

export { auth_api, api }
