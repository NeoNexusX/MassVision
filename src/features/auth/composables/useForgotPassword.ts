import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCountdown } from '@/shared/composables/useCountdown'
import { sendEmailCode } from '@/features/auth/api/authApi'
import { api } from '@/shared/api/httpClient'
import { useToast } from '@/shared/composables/useToast'
import { getConfig } from '@/shared/config/runtimeConfig'
import { SESSION_KEYS } from '@/shared/config'

const patterns = {
  email: '^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$',
  password: '^(?=.*[a-zA-Z])(?=.*\\d).{8,25}$',
  verify_code: '^[0-9]{6}$',
}

export function useForgotPassword() {
  const router = useRouter()
  const { showToast } = useToast()
  const {
    count: countdown,
    isActive: isCountdownActive,
    isExhausted,
    start: startCountdown,
  } = useCountdown(
    getConfig().verification.countdownSeconds,
    SESSION_KEYS.forgotPasswordCodeAttempts,
    getConfig().verification.maxAttempts,
  )

  // ── State ──────────────────────────────────────────────────────────────

  const form = reactive({
    email: '',
    verify_code: '',
    new_password: '',
    confirm_password: '',
  })

  const errors = reactive({
    email: '',
    verify_code: '',
    new_password: '',
    confirm_password: '',
  })

  const loading = reactive({
    sendCode: false,
    reset: false,
  })

  /** 当前步骤：'email' — 输邮箱 → 'reset' — 输验证码和新密码 */
  const step = ref<'email' | 'reset'>('email')

  // ── Password strength ─────────────────────────────────────────────────

  const passwordScore = computed(() => {
    const p = form.new_password
    if (!p) return 0
    const checks = [
      p.length >= 8,
      p.length >= 12,
      /[A-Z]/.test(p),
      /[0-9]/.test(p),
      /[^a-zA-Z0-9]/.test(p),
    ]
    return checks.filter(Boolean).length
  })

  const progressBarClass = computed(() => {
    const classes = [
      'progress-error',
      'progress-warning',
      'progress-warning',
      'progress-success',
      'progress-success',
    ]
    return classes[passwordScore.value - 1] || 'progress-error'
  })

  // ── Validation ────────────────────────────────────────────────────────

  function validateField(field: keyof typeof form) {
    const value = form[field]
    switch (field) {
      case 'email':
        if (!value) errors.email = 'Email is required'
        else if (!new RegExp(patterns.email).test(value)) errors.email = 'Invalid email address'
        else errors.email = ''
        break
      case 'verify_code':
        if (!value) errors.verify_code = 'Verification code is required'
        else if (!new RegExp(patterns.verify_code).test(value)) errors.verify_code = 'Must be 6 digits'
        else errors.verify_code = ''
        break
      case 'new_password':
        if (!value) errors.new_password = 'New password is required'
        else if (!new RegExp(patterns.password).test(value))
          errors.new_password = 'Min 8 chars, letters & numbers required'
        else errors.new_password = ''
        break
      case 'confirm_password':
        if (!value) errors.confirm_password = 'Please confirm your new password'
        else if (value !== form.new_password) errors.confirm_password = 'Passwords do not match'
        else errors.confirm_password = ''
        break
    }
  }

  function clearError(field: keyof typeof form) {
    errors[field] = ''
  }

  function validateStep(): boolean {
    if (step.value === 'email') {
      validateField('email')
      return !errors.email
    } else {
      const fields: (keyof typeof form)[] = ['email', 'verify_code', 'new_password', 'confirm_password']
      fields.forEach(validateField)
      return fields.every((f) => !errors[f])
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────

  /** 发送验证码 → 进入第二步 */
  async function sendCode() {
    if (isExhausted.value) {
      showToast(
        'Maximum verification code requests reached for this session. Please try again later.',
        'error',
      )
      return
    }

    validateField('email')
    if (errors.email) {
      showToast('Please enter a valid email address', 'error')
      return
    }

    loading.sendCode = true
    try {
      await sendEmailCode(form.email, 'reset_password')
      showToast('Verification code sent! Check your email.', 'success')
      startCountdown()
      step.value = 'reset'
    } catch (error: any) {
      console.error('Send code error:', error.message)
      showToast(error.message || 'Failed to send verification code', 'error')
    } finally {
      loading.sendCode = false
    }
  }

  /** 提交重置密码 */
  async function submitReset() {
    if (!validateStep()) {
      showToast('Please fix the errors before submitting', 'error')
      return
    }

    loading.reset = true
    try {
      await api.post('/password_reset', {
        email: form.email,
        verify_code: form.verify_code,
        new_password: form.new_password,
      })
      showToast('Password reset successful! Redirecting to login...', 'success')
      setTimeout(() => {
        router.replace('/login')
      }, 2000)
    } catch (error: any) {
      console.error('Reset password error:', error.message)
      showToast(error.message || 'Failed to reset password', 'error')
    } finally {
      loading.reset = false
    }
  }

  /** 返回上一步 */
  function backToEmail() {
    step.value = 'email'
  }

  return {
    form,
    errors,
    patterns,
    loading,
    step,
    passwordScore,
    progressBarClass,
    countdown,
    isCountdownActive,
    isExhausted,
    validateField,
    clearError,
    sendCode,
    submitReset,
    backToEmail,
  }
}
