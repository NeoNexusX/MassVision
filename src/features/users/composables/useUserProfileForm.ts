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
    start: startCodeCooldown,
    stop: stopCodeCooldown,
  } = useCountdown(60, 'profile_email_code', 10)

  // State
  const loading = ref(false)
  const formData = reactive({
    username: '',
    email: '',
    password: '',
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
    formData.password = ''
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
    stopCodeCooldown()
    codeCooldown.value = 0
  }

  const sendVerificationCode = async () => {
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
        email: newEmail.value,
        verify_code: emailCode.value,
        username: formData.username,
        institution: formData.institution,
        position: formData.position,
        research_field: formData.research_field,
        region: formData.region,
        orcid: formData.orcid,
        homepage: formData.homepage,
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
    const password = formData.password.trim()
    if (password !== '') {
      const passwordPattern = /^(?=.*[a-zA-Z])(?=.*\d).{8,25}$/
      if (!passwordPattern.test(password)) {
        showToast('Password must be 8-25 characters with at least one letter and one number', 'error')
        return
      }
    }

    let logoutRequired = false
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

    if (formData.password.trim() !== '') {
      profilePayload.password = formData.password
    }

    try {
      await updateUserProfile(profilePayload)
      if (formData.password.trim() !== '') {
        logoutRequired = true
      }
      messages.push('Profile info updated.')
    } catch (profileError: any) {
      messages.push(`Profile update failed: ${extractBackendError(profileError)}`)
    } finally {
      formData.password = ''
    }

    try {
      const refreshRes = await getCurrentUser()
      if (refreshRes.data) applyUserData({ ...formData, ...refreshRes.data })
    } catch (refreshError) {
      console.warn('Silent refresh failed after save:', refreshError)
      messages.push(`Profile update failed: ${extractBackendError(refreshError)}`)
    }

    // messages
    const fullMessage = messages.join('\n') + (logoutRequired ? '\nPlease login again with your new password.' : '')

    // toast
    const isFailure = messages.some((message) => message.toLowerCase().includes('failed'))
    showToast(fullMessage, isFailure ? 'error' : 'success')

    if (logoutRequired) {
      setTimeout(() => {
        handleLogout()
      }, 1500)
    }
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
    quota,
    openEmailModal,
    closeEmailModal,
    sendVerificationCode,
    submitEmailChange,
    handleSave,
    handleLogout,
  }
}
