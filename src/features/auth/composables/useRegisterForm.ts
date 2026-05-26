import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCountdown } from '@/shared/composables/useCountdown'
import { usrSignupApi, sendEmailCode } from '@/features/auth/api/authApi'
import type { UsrSignup } from '@/features/auth/types/auth'
import { useToast } from '@/shared/composables/useToast'
import { positionOptions, researchFieldOptions } from '@/shared/constants/profileOptions'
import { getRegionOptions } from '@/shared/utils/regionOptions'

const regionOptions = getRegionOptions()

const patterns = {
  username: '^[A-Za-z0-9_\\-]{3,30}$',
  email: '^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$',
  password: '^(?=.*[a-zA-Z])(?=.*\\d).{8,25}$',
  verify_code: '^[0-9]{6}$',
  url:
    '^(https?:\\/\\/)?' +
    '((([a-z\\d]([a-z\\d\\-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
    '((\\d{1,3}\\.){3}\\d{1,3}))' +
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
    '(\\?[;&a-z\\d%_.~+=-]*)?' +
    '(\\#[-a-z\\d_]*)?$',
  orcid: '^\\d{4}-\\d{4}-\\d{4}-\\d{3}[0-9X]$',
}

type RegField =
  | 'username'
  | 'email'
  | 'password'
  | 'confirm_password'
  | 'verify_code'
  | 'institution'
  | 'position'
  | 'research_field'
  | 'region'
  | 'orcid'
  | 'homepage'

type Rule = {
  required?: string
  test?: { re: RegExp; msg: string }
  custom?: (value: string, form: Record<RegField, string>) => string
}

const rules: Record<RegField, Rule> = {
  username: {
    required: 'Username is required',
    test: {
      re: new RegExp(patterns.username),
      msg: 'Invalid username (3-30 chars, letters/numbers)',
    },
  },
  email: {
    required: 'Email is required',
    test: {
      re: new RegExp(patterns.email),
      msg: 'Invalid email address'
    },
  },
  password: {
    required: 'Password is required',
    test: {
      re: new RegExp(patterns.password),
      msg: 'Min 8 chars, letters & numbers required'
    },
  },
  confirm_password: {
    required: 'Confirm password is required',
    custom: (value, form) => (value !== form.password ? 'Passwords do not match' : ''),
  },
  verify_code: {
    required: 'Code is required',
    test: { re: new RegExp(patterns.verify_code), msg: 'Must be 6 digits' },
  },
  institution: {
    required: 'Institution is required'
  },
  position: {
    required: 'Please select a position'
  },
  research_field: {
    required: 'Research field is required'
  },
  region: {
    required: 'Please select a region'
  },
  orcid: {
    test: {
      re: new RegExp(patterns.orcid),
      msg: 'Invalid ORCID format (e.g. 0000-0000-0000-0000)',
    },
  },
  homepage: {
    test: {
      re: new RegExp(patterns.url, 'i'),
      msg: 'Invalid URL format'
    },
  },
}

export function useRegisterForm() {
  // External composables
  const router = useRouter()
  const { showToast } = useToast()
  const {
    count: countdown,
    isActive: isCountdownActive,
    isExhausted,
    start: startCountdown,
  } = useCountdown(60, 'register_code_attempts', Number(import.meta.env.APP_MAXATTEMPTS) || 10)

  // State
  const form = reactive({
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    verify_code: '',
    institution: '',
    position: '',
    research_field: '',
    region: '',
    orcid: '',
    homepage: '',
  })

  const errors = reactive({
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    verify_code: '',
    institution: '',
    position: '',
    research_field: '',
    region: '',
    orcid: '',
    homepage: '',
  })

  const isOtherResearchField = ref(false)
  const loading = reactive({ register: false, sendCode: false })

  const passwordScore = computed(() => {
    const p = form.password
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

  // Methods
  const clearError = (field: RegField) => {
    errors[field] = ''
  }

  const validateField = (field: RegField) => {
    const value = form[field]
    const rule = rules[field]
    if (!value) {
      errors[field] = rule.required ?? ''
    } else if (rule.test && !rule.test.re.test(value)) {
      errors[field] = rule.test.msg
    } else if (rule.custom) {
      errors[field] = rule.custom(value, form)
    } else {
      errors[field] = ''
    }
  }

  const handleResearchFieldChange = (value: string | number | Event) => {
    const nextValue = String(value)
    if (nextValue === 'Other') {
      isOtherResearchField.value = true
    } else {
      isOtherResearchField.value = false
      validateField('research_field')
    }
  }

  const sendVerificationCode = async () => {
    if (isExhausted.value) {
      showToast(
        'Maximum verification code requests reached for this session. Please try again later.',
        'error',
      )
      return
    }
    
    const accountFields: RegField[] = ['username', 'email', 'password', 'confirm_password']
    accountFields.forEach((field) => validateField(field))
    
    if (accountFields.some((field) => errors[field])) {
      showToast('Please complete the account information correctly before sending the code', 'error')
      return
    }
    
    loading.sendCode = true
    try {
      await sendEmailCode(form.email)
      showToast('Verification code sent!', 'success')
      startCountdown()
    } catch (error: any) {
      console.error('Send code error:', error.message)
      showToast(error.message || 'Failed to send verification code', 'error')
    } finally {
      loading.sendCode = false
    }
  }

  const register = async () => {
    ; (Object.keys(form) as RegField[]).forEach((key) => validateField(key))
    if (Object.values(errors).some((error) => !!error)) {
      showToast('Please fix errors in the form', 'error')
      return
    }

    loading.register = true
    try {
      const signupData: UsrSignup = {
        username: form.username,
        email: form.email,
        password: form.password,
        verify_code: form.verify_code,
        active: true,
        institution: form.institution,
        position: form.position,
        research_field: form.research_field,
        region: form.region,
        orcid: form.orcid || '',
        homepage: form.homepage || '',
      }
      await usrSignupApi(signupData)
      showToast('Registration successful! Redirecting to login page...', 'success')
      setTimeout(() => {
        router.replace('/login')
      }, 2000)
    } catch (error: any) {
      console.error('Registration failed:', error.message)
      showToast(error.message || 'Registration failed', 'error')
    } finally {
      loading.register = false
    }
  }

  // Watchers
  watch(
    () => form.password,
    () => {
      if (form.confirm_password) validateField('confirm_password')
    },
  )

  return {
    form,
    errors,
    patterns,
    loading,
    regionOptions,
    positionOptions,
    researchFieldOptions,
    isOtherResearchField,
    countdown,
    isCountdownActive,
    isExhausted,
    passwordScore,
    progressBarClass,
    validateField,
    clearError,
    handleResearchFieldChange,
    sendVerificationCode,
    register,
  }
}
