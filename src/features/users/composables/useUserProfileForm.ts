import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentUser, sendEmailCode, updateUserProfile } from '@/features/auth/api/authApi'
import { useToast } from '@/shared/composables/useToast'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { extractBackendError } from '@/shared/api/httpClient'
import { useCountdown } from '@/shared/composables/useCountdown'
import { useUserQuota } from '@/shared/composables/useUserQuota'
import { positionOptions } from '@/shared/constants/profileOptions'
import { getRegionOptions } from '@/shared/utils/regionOptions'
import { SESSION_KEYS } from '@/shared/config'
import { getConfig } from '@/shared/config/runtimeConfig'
import type { UsrProfileUpdate } from '@/features/auth/types/auth'

const regionOptions = getRegionOptions()

export function useUserProfileForm() {
  // External composables
  const router = useRouter()
  const { showToast } = useToast()
  const authStore = useAuthStore()
  const { quota, fetchQuota } = useUserQuota()
  const {
    count: codeCooldown,
    isActive: isCooldownActive,
    isExhausted,
    start: startCodeCooldown,
  } = useCountdown(
    getConfig().verification.countdownSeconds,
    SESSION_KEYS.profileEmailCode,
    getConfig().verification.maxAttempts,
  )

  // State
  const loading = ref(false)
  const formData = reactive({
    username: '',
    email: '',
    identity: '',
    institution: '',
    position: '',
    research_field: '',
    region: '',
    orcid: '',
    homepage: '',
  })

  const isEmailModalOpen = ref(false)
  const newEmail = ref('')
  const emailCode = ref('')
  const sendingCode = ref(false)

  // ── Password change modal ────────────────────────────────────────────────
  const isPasswordModalOpen = ref(false)
  const newPassword = ref('')
  const confirmPassword = ref('')
  const savingPassword = ref(false)

  // Computed

  // Methods
  const applyUserData = (data: any) => {
    formData.username = data.username || ''
    formData.email = data.email || ''
    formData.identity = data.identity || ''
    formData.institution = data.institution || ''
    formData.position = data.position || ''
    formData.research_field = data.research_field || ''
    formData.region = data.region || ''
    formData.orcid = data.orcid || ''
    formData.homepage = data.homepage || ''
  }

  const handleLogout = async () => {
    await authStore.logout()
    router.push('/login')
  }

  const openEmailModal = () => {
    newEmail.value = ''
    emailCode.value = ''
    isEmailModalOpen.value = true
  }

  const closeEmailModal = () => {
    isEmailModalOpen.value = false
  }

  const sendVerificationCode = async () => {
    if (isExhausted.value) {
      showToast('Maximum verification code requests reached for this session. Please try again later.', 'error')
      return
    }

    if (!newEmail.value || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.value)) {
      showToast('Please enter a valid email address', 'warning')
      return
    }
    try {
      sendingCode.value = true
      await sendEmailCode(newEmail.value, 'update')
      showToast('Verification code sent to email', 'success')
      startCodeCooldown()
    } catch (err: any) {
      showToast(err?.message || 'Failed to send verification code', 'error')
    } finally {
      sendingCode.value = false
    }
  }

  const submitEmailChange = async () => {
    if (!newEmail.value || !emailCode.value) {
      showToast('Please enter new email and verification code', 'warning')
      return
    }
    try {
      loading.value = true
      await updateUserProfile({
        username: formData.username,
        email: newEmail.value,
        verify_code: emailCode.value,
      } as any)
      formData.email = newEmail.value
      showToast('Email updated successfully', 'success')
      closeEmailModal()
    } catch (err: any) {
      console.error('Email change failed:', err?.response?.data ?? err)
      showToast(extractBackendError(err), 'error')
    } finally {
      loading.value = false
    }
  }

  // ── Password change modal methods ──────────────────────────────────────

  const openPasswordModal = () => {
    newPassword.value = ''
    confirmPassword.value = ''
    isPasswordModalOpen.value = true
  }

  const closePasswordModal = () => {
    isPasswordModalOpen.value = false
  }

  const submitPasswordChange = async () => {
    const pw = newPassword.value
    if (!pw || !confirmPassword.value) {
      showToast('Please fill in both password fields', 'warning')
      return
    }

    const passwordPattern = /^(?=.*[a-zA-Z])(?=.*\d).{8,25}$/
    if (!passwordPattern.test(pw)) {
      showToast('Password must be 8-25 characters with at least one letter and one number', 'error')
      return
    }

    if (pw !== confirmPassword.value) {
      showToast('Passwords do not match', 'error')
      return
    }

    savingPassword.value = true
    try {
      await updateUserProfile({
        username: formData.username,
        password: pw,
      } as Partial<UsrProfileUpdate>)
      showToast('Password changed successfully. Please login again.', 'success')
      closePasswordModal()
      setTimeout(() => {
        handleLogout()
      }, 1500)
    } catch (err: any) {
      console.error('Password change failed:', err?.response?.data ?? err)
      showToast(extractBackendError(err), 'error')
    } finally {
      savingPassword.value = false
    }
  }

  const loadProfile = async () => {
    loading.value = true
    fetchQuota()
    try {
      const res = await getCurrentUser()
      applyUserData(res.data || {})
    } catch (error: any) {
      console.error('Failed to fetch user profile:', error)
      if (error.response && error.response.status === 401) {
        handleLogout()
      }
    } finally {
      loading.value = false
    }
  }

  const handleSave = async () => {
    loading.value = true
    const messages: string[] = []

    const profilePayload: Partial<UsrProfileUpdate> = {
      username: formData.username,
      institution: formData.institution,
      position: formData.position,
      research_field: formData.research_field,
      region: formData.region,
      orcid: formData.orcid,
      homepage: formData.homepage,
    }

    try {
      await updateUserProfile(profilePayload)
      messages.push('Profile info updated.')
    } catch (profileError: any) {
      messages.push(`Profile update failed: ${extractBackendError(profileError)}`)
    }

    try {
      const refreshRes = await getCurrentUser()
      if (refreshRes.data) applyUserData({ ...formData, ...refreshRes.data })
    } catch (refreshError) {
      console.warn('Silent refresh failed after save:', refreshError)
      messages.push(`Profile update failed: ${extractBackendError(refreshError)}`)
    }

    const fullMessage = messages.join('\n')
    const isFailure = messages.some((message) => message.toLowerCase().includes('failed'))
    showToast(fullMessage, isFailure ? 'error' : 'success')

    loading.value = false
  }

  // Lifecycle
  onMounted(loadProfile)

  return {
    loading,
    positionOptions,
    regionOptions,
    formData,
    isEmailModalOpen,
    newEmail,
    emailCode,
    sendingCode,
    codeCooldown,
    isCooldownActive,
    isExhausted,
    isPasswordModalOpen,
    newPassword,
    confirmPassword,
    savingPassword,
    quota,
    openEmailModal,
    closeEmailModal,
    sendVerificationCode,
    submitEmailChange,
    openPasswordModal,
    closePasswordModal,
    submitPasswordChange,
    handleSave,
    handleLogout,
  }
}
