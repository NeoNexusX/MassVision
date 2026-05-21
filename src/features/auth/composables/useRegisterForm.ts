import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCountdown } from '@/shared/composables/useCountdown'
import { usrSignupApi, sendEmailCode } from '@/features/auth/api/authApi'
import type { UsrSignup } from '@/features/auth/types/auth'
import { useToast } from '@/shared/composables/useToast'
import { positionOptions, researchFieldOptions } from '@/shared/constants/profileOptions'
import { getRegionOptions } from '@/shared/utils/regionOptions'

const regionOptions = getRegionOptions()

export function useRegisterForm() {
  const router = useRouter()
  const { showToast } = useToast()

  const regionOpts = computed(() => regionOptions)

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

  const isOtherResearchField = ref(false)
  const customResearchField = ref('')

  watch(customResearchField, (newVal) => {
    if (isOtherResearchField.value) form.research_field = newVal
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

  const loading = reactive({ register: false, sendCode: false })
  const {
    count: countdown,
    isActive: isCountdownActive,
    isExhausted,
    start: startCountdown,
  } = useCountdown(60, 'register_code_attempts', 3)

  const passwordScore = ref(0)
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

  const validatePasswordStrength = () => {
    const password = form.password
    if (!password) {
      passwordScore.value = 0
      return
    }
    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++
    passwordScore.value = Math.min(score, 5)
  }

  const clearError = (field: keyof typeof errors) => {
    errors[field] = ''
  }

  const validateField = (field: keyof typeof errors) => {
    const value = form[field]
    switch (field) {
      case 'username':
        errors.username = !value
          ? 'Username is required'
          : !new RegExp(patterns.username).test(value)
            ? 'Invalid username (3-30 chars, letters/numbers)'
            : ''
        break
      case 'email':
        errors.email = !value
          ? 'Email is required'
          : !new RegExp(patterns.email).test(value)
            ? 'Invalid email address'
            : ''
        break
      case 'password':
        errors.password = !value
          ? 'Password is required'
          : !new RegExp(patterns.password).test(value)
            ? 'Min 8 chars, letters & numbers required'
            : ''
        validatePasswordStrength()
        break
      case 'confirm_password':
        errors.confirm_password = !value
          ? 'Confirm password is required'
          : value !== form.password
            ? 'Passwords do not match'
            : ''
        break
      case 'verify_code':
        errors.verify_code = !value
          ? 'Code is required'
          : !new RegExp(patterns.verify_code).test(value)
            ? 'Must be 6 digits'
            : ''
        break
      case 'institution':
        errors.institution = !value ? 'Institution is required' : ''
        break
      case 'position':
        errors.position = !value ? 'Please select a position' : ''
        break
      case 'research_field':
        errors.research_field = !value ? 'Research field is required' : ''
        break
      case 'region':
        errors.region = !value ? 'Please select a region' : ''
        break
      case 'orcid':
        errors.orcid =
          value && !new RegExp(patterns.orcid).test(value)
            ? 'Invalid ORCID format (e.g. 0000-0000-0000-0000)'
            : ''
        break
      case 'homepage':
        errors.homepage =
          value && !new RegExp(patterns.url, 'i').test(value) ? 'Invalid URL format' : ''
        break
    }
  }

  const handleResearchFieldChange = (value: string | number | Event) => {
    const nextValue =
      typeof value === 'object' && 'target' in value
        ? (value.target as HTMLSelectElement).value
        : String(value)
    if (nextValue === 'Other') {
      isOtherResearchField.value = true
      form.research_field = customResearchField.value
    } else {
      isOtherResearchField.value = false
      form.research_field = nextValue
    }
    validateField('research_field')
  }

  const sendVerificationCode = async () => {
    if (isExhausted.value) {
      showToast(
        'Maximum verification code requests reached for this session. Please try again later.',
        'error',
      )
      return
    }
    validateField('email')
    if (errors.email) {
      showToast(errors.email, 'error')
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
    ;(Object.keys(form) as Array<keyof typeof errors>).forEach((key) => validateField(key))
    if (Object.values(errors).some((error) => !!error)) {
      showToast('Please fix errors in the form', 'error')
      return
    }
    if (
      !form.username ||
      !form.email ||
      !form.password ||
      !form.institution ||
      !form.position ||
      !form.region
    ) {
      showToast('Please fill in all required fields', 'error')
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
    regionOptions: regionOpts,
    positionOptions,
    researchFieldOptions,
    isOtherResearchField,
    customResearchField,
    countdown,
    isCountdownActive,
    isExhausted,
    passwordScore,
    progressBarClass,
    validateField,
    validatePasswordStrength,
    clearError,
    handleResearchFieldChange,
    sendVerificationCode,
    register,
  }
}
