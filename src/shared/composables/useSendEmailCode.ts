import { useCountdown } from '@/shared/composables/useCountdown'
import { sendEmailCode } from '@/shared/auth/authApi'
import { useToast } from '@/shared/composables/useToast'
import { getConfig } from '@/shared/config/runtimeConfig'

/** Toast shown when the per-session send-attempt limit is reached. */
export const SEND_CODE_EXHAUSTED_MESSAGE =
  'Maximum verification code requests reached for this session. Please try again later.'

/** Fallback toast when the send request fails without an error message. */
export const SEND_CODE_FAILED_MESSAGE = 'Failed to send verification code'

export interface UseSendEmailCodeOptions {
  /** sessionStorage key used by useCountdown for attempt limiting */
  sessionKey: string
  /** `purpose` field sent to the backend ('register' | 'reset_password' | 'update' | ...) */
  purpose: string
  /** Toast text shown after a successful send */
  successMessage: string
}

export interface SendEmailCodeCall {
  /** Site-specific pre-validation; return true to proceed with the send. */
  validate: () => boolean
  /** Toggles the caller's loading flag around the request. */
  setLoading: (loading: boolean) => void
  /** Extra work after a successful send (e.g. advance to the next step). */
  onSuccess?: () => void
  /** Extra error handling (e.g. console logging) before the failure toast. */
  onError?: (error: any) => void
}

/**
 * Shared "send email verification code" flow:
 * exhausted-check → caller pre-validation → sendEmailCode → success toast +
 * countdown start → failure toast. Each call site keeps its own session key,
 * purpose, messages and pre-validation.
 */
export function useSendEmailCode({ sessionKey, purpose, successMessage }: UseSendEmailCodeOptions) {
  const { showToast } = useToast()
  const { count, isActive, isExhausted, start } = useCountdown(
    getConfig().verification.countdownSeconds,
    sessionKey,
    getConfig().verification.maxAttempts,
  )

  const sendCode = async (
    email: string,
    { validate, setLoading, onSuccess, onError }: SendEmailCodeCall,
  ): Promise<void> => {
    if (isExhausted.value) {
      showToast(SEND_CODE_EXHAUSTED_MESSAGE, 'error')
      return
    }

    if (!validate()) return

    setLoading(true)
    try {
      await sendEmailCode(email, purpose)
      showToast(successMessage, 'success')
      start()
      onSuccess?.()
    } catch (error: any) {
      onError?.(error)
      showToast(error?.message || SEND_CODE_FAILED_MESSAGE, 'error')
    } finally {
      setLoading(false)
    }
  }

  return { count, isActive, isExhausted, sendCode }
}
