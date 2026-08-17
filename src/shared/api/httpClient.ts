import axios, { AxiosError } from 'axios'
import { ENV } from '@/shared/config'
import { authStorage } from '@/shared/auth/authStorage'

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

  // --- FastAPI-style array: [{ loc, msg, type }, ...] ---
  if (Array.isArray(detail)) {
    // Collect non-empty messages from all items
    const messages = detail
      .map((item) => (item as { msg?: string; message?: string })?.msg || (item as { msg?: string; message?: string })?.message || '')
      .filter(Boolean)
    if (messages.length > 0) {
      return messages.join('; ')
    }
    // Fallback: no extractable message in any item
    return safeStringify(detail) || 'Response Failed'
  }

  // --- Plain object: { msg } or { message } or { detail: "..." } ---
  if (typeof detail === 'object') {
    const obj = detail as Record<string, unknown>
    // Recursively unwrap nested detail
    if (obj.detail != null && (typeof obj.detail === 'string' || Array.isArray(obj.detail) || (typeof obj.detail === 'object' && (obj.detail as any)?.msg))) {
      return formatErrorMessage(obj.detail)
    }
    const msg = obj.msg || obj.message
    if (msg && typeof msg === 'string') return msg
    return safeStringify(detail) || 'Response Failed'
  }

  return String(detail) || 'Response Failed'
}

/**
 * Global 401 handler: any authenticated endpoint that rejects the token means
 * the session is dead. Clear the stored credentials so the request
 * interceptor stops attaching the stale token, and bounce to /login once
 * (guarded by a module flag to avoid a redirect storm when several requests
 * fail together). Skipped when a skipAuthRedirect marker is set on the config
 * (e.g. logout itself, or a page that handles 401s on its own).
 */
function handleUnauthorized(error: AxiosError<ErrorResponse>): void {
  if ((error.config as any)?.skipAuthRedirect) return
  if (error.response?.status !== 401) return
  authStorage.clearAuthData()
  if (typeof window === 'undefined') return
  const path = window.location.pathname
  if (path === '/login' || path === '/register' || path === '/forgotpassword') return
  window.location.assign(`/login?redirect=${encodeURIComponent(path + window.location.search)}`)
}

const error_catch = (error: AxiosError<ErrorResponse>) => {
  handleUnauthorized(error)
  if (error.response?.data) {
    const raw = (error.response.data as any) || {}

    // If data is a plain string (e.g., text/plain response), try to parse it as JSON
    let candidate: unknown
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        candidate = parsed?.detail ?? parsed?.message ?? parsed?.msg ?? parsed
      } catch {
        candidate = raw
      }
    } else {
      candidate = raw?.detail ?? raw?.message ?? raw?.msg ?? error.message ?? raw
    }

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
  const token = authStorage.getToken()
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

export function extractBackendError(error: any, fallback?: string): string {
  // Non-axios throws carry no backend payload; use the caller's fallback when given.
  if (fallback !== undefined && !axios.isAxiosError(error)) return fallback
  const candidate =
    error?.response?.data?.detail ??
    error?.response?.data?.message ??
    error?.response?.data?.msg ??
    error?.message
  return formatErrorMessage(candidate)
}

export { auth_api, api }
