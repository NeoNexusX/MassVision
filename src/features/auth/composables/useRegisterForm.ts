import { computed, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSendEmailCode } from '@/shared/composables/useSendEmailCode'
import { usrSignupApi } from '@/shared/auth/authApi'
import type { UsrSignup } from '@/shared/auth/types'
import { useToast } from '@/shared/composables/useToast'
import { POSITION_OPTIONS, RESEARCH_FIELD_OPTIONS } from '@/shared/constants/profileOptions'
import { getRegionOptions } from '@/shared/utils/regionOptions'
import { SESSION_KEYS } from '@/shared/config'
import { t } from '@/i18n'
import { useLocale } from '@/shared/composables/useLocale'
import { VALIDATION_PATTERNS } from '@/features/auth/constants/validationPatterns'
import {
  passwordScore as scorePassword,
  passwordProgressClass,
} from '@/features/auth/utils/passwordStrength'

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

/** 错误文案写成 getter：规则表在模块顶层，文案必须在校验那一刻按当前界面语言取 */
type Rule = {
  required?: () => string
  test?: { re: RegExp; msg: () => string }
  custom?: (value: string, form: Record<RegField, string>) => string
}

const rules: Record<RegField, Rule> = {
  username: {
    required: () => t('auth.validation.usernameRequired'),
    test: {
      re: new RegExp(patterns.username),
      msg: () => t('auth.validation.usernameInvalid'),
    },
  },
  email: {
    required: () => t('auth.validation.emailRequired'),
    test: {
      re: new RegExp(patterns.email),
      msg: () => t('auth.validation.emailInvalid'),
    },
  },
  password: {
    required: () => t('auth.validation.passwordRequired'),
    test: {
      re: new RegExp(patterns.password),
      msg: () => t('auth.validation.passwordInvalid'),
    },
  },
  confirm_password: {
    required: () => t('auth.validation.confirmPasswordRequired'),
    custom: (value, form) =>
      value !== form.password ? t('auth.validation.passwordMismatch') : '',
  },
  verify_code: {
    required: () => t('auth.validation.verificationCodeRequired'),
    test: { re: new RegExp(patterns.verify_code), msg: () => t('auth.validation.codeInvalid') },
  },
  institution: {
    required: () => t('auth.validation.institutionRequired'),
    test: {
      re: new RegExp(patterns.institution),
      msg: () => t('auth.validation.institutionInvalid'),
    },
  },
  position: {
    required: () => t('auth.validation.positionRequired'),
  },
  research_field: {
    required: () => t('auth.validation.researchFieldRequired'),
  },
  region: {
    required: () => t('auth.validation.regionRequired'),
  },
  orcid: {
    test: {
      re: new RegExp(patterns.orcid),
      msg: () => t('auth.validation.orcidInvalid'),
    },
  },
  homepage: {
    test: {
      re: new RegExp(patterns.url, 'i'),
      msg: () => t('auth.validation.urlInvalid'),
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
    successMessage: () => t('auth.code.sent'),
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

  // 国家名随界面语言变化；提交的始终是 ISO 代码，切语言不会丢失已选值
  const regionOptions = computed(() => getRegionOptions())

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
      errors[field] = rule.required?.() ?? ''
    } else if (rule.test && !rule.test.re.test(value)) {
      errors[field] = rule.test.msg()
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
          showToast(t('auth.toast.completeAccountFirst'), 'error')
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
      showToast(t('auth.toast.fixFormErrors'), 'error')
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
      showToast(t('auth.toast.registerSuccess'), 'success')
      setTimeout(() => {
        router.replace('/login')
      }, 2000)
    } catch (error: any) {
      console.error('Registration failed:', error.message)
      showToast(error.message || t('auth.toast.registerFailed'), 'error')
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

  // 错误文案是校验那一刻按当时语言生成的字符串；切语言后把正在显示的错误按新语言重算
  const { locale } = useLocale()
  watch(locale, () => {
    ;(Object.keys(errors) as RegField[]).forEach((field) => {
      if (errors[field]) validateField(field)
    })
  })

  return {
    form,
    errors,
    patterns,
    loading,
    regionOptions,
    positionOptions: POSITION_OPTIONS,
    researchFieldOptions: RESEARCH_FIELD_OPTIONS,
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
