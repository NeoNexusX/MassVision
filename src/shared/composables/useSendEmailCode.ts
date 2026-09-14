import { useCountdown } from '@/shared/composables/useCountdown'
import { sendEmailCode } from '@/shared/auth/authApi'
import { useToast } from '@/shared/composables/useToast'
import { getConfig } from '@/shared/config/runtimeConfig'
import { t } from '@/i18n'

export interface UseSendEmailCodeOptions {
  /** sessionStorage key used by useCountdown for attempt limiting */
  sessionKey: string
  /** `purpose` field sent to the backend ('register' | 'reset_password' | 'update' | ...) */
  purpose: string
  /**
   * Toast text shown after a successful send. Pass a getter (e.g. `() => t('...')`) so the
   * text is resolved at send time in the current UI language, not when the composable is created.
   */
  successMessage: string | (() => string)
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
      showToast(t('auth.code.exhausted'), 'error')
      return
    }

    if (!validate()) return

    setLoading(true)
    try {
      await sendEmailCode(email, purpose)
      showToast(typeof successMessage === 'function' ? successMessage() : successMessage, 'success')
      start()
      onSuccess?.()
    } catch (error: any) {
      onError?.(error)
      showToast(error?.message || t('auth.code.failed'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return { count, isActive, isExhausted, sendCode }
}
