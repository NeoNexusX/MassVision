import { computed, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSendEmailCode } from '@/shared/composables/useSendEmailCode'
import { usrSignupApi } from '@/features/auth/api/authApi'
import type { UsrSignup } from '@/features/auth/types/auth'
import { useToast } from '@/shared/composables/useToast'
import { positionOptions, researchFieldOptions } from '@/shared/constants/profileOptions'
import { getRegionOptions } from '@/shared/utils/regionOptions'
import { SESSION_KEYS } from '@/shared/config'
import { VALIDATION_PATTERNS } from '@/features/auth/constants/validationPatterns'
import {
  passwordScore as scorePassword,
  passwordProgressClass,
} from '@/features/auth/utils/passwordStrength'

const regionOptions = getRegionOptions()

const patterns = {
  username: '^[A-Za-z0-9_\\-]{3,30}$',
  email: VALIDATION_PATTERNS.email,
  password: VALIDATION_PATTERNS.password,
  verify_code: VALIDATION_PATTERNS.verify_code,
  url:
    '^(https?:\\/\\/)?' +
    '((([a-z\\d]([a-z\\d\\-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
    '((\\d{1,3}\\.){3}\\d{1,3}))' +
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
    '(\\?[;&a-z\\d%_.~+=-]*)?' +
    '(\\#[-a-z\\d_]*)?$',
  orcid: '^\\d{4}-\\d{4}-\\d{4}-\\d{3}[0-9X]$',
  institution: '^.{5,100}$',
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
    required: 'Institution is required',
    test: {
      re: new RegExp(patterns.institution),
      msg: 'Institution must be 5-100 characters',
    },
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
    sendCode: sendCodeRequest,
  } = useSendEmailCode({
    sessionKey: SESSION_KEYS.registerCodeAttempts,
    purpose: 'register',
    successMessage: 'Verification code sent!',
  })

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

  const loading = reactive({ register: false, sendCode: false })

  const passwordScore = computed(() => scorePassword(form.password))

  const progressBarClass = computed(() => passwordProgressClass(passwordScore.value))

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

  const sendVerificationCode = async () => {
    const accountFields: RegField[] = ['username', 'email', 'password', 'confirm_password']
    await sendCodeRequest(form.email, {
      validate: () => {
        accountFields.forEach((field) => validateField(field))
        if (accountFields.some((field) => errors[field])) {
          showToast('Please complete the account information correctly before sending the code', 'error')
          return false
        }
        return true
      },
      setLoading: (value) => {
        loading.sendCode = value
      },
      onError: (error) => console.error('Send code error:', error.message),
    })
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
    countdown,
    isCountdownActive,
    isExhausted,
    passwordScore,
    progressBarClass,
    validateField,
    clearError,
    sendVerificationCode,
    register,
  }
}
