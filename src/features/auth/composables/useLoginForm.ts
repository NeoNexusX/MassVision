import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/shared/auth/authStore'
import { login as loginApi } from '@/shared/auth/authApi'
import { extractBackendError } from '@/shared/api/httpClient'
import { useToast } from '@/shared/composables/useToast'

export function useLoginForm() {
  // External composables
  const { showToast } = useToast()
  const router = useRouter()
  const authStore = useAuthStore()

  // State
  const username = ref('')
  const password = ref('')
  const isLoading = ref(false)

  // Methods
  const login = async () => {
    if (!username.value || !password.value) {
      showToast('Please enter both username and password.', 'warning')
      return
    }

    isLoading.value = true
    try {
      const response = await loginApi({
        username: username.value,
        password: password.value,
      })

      if (response.status !== 200) {
        throw new Error(response.data?.message || 'Unable to connect the server.')
      }

      const { access_token } = response.data
      if (!access_token) throw new Error('Invalid token received')

      authStore.login(access_token)
      sessionStorage.setItem('just_logged_in', '1')
      showToast('Login successful! Redirecting...', 'success')
      setTimeout(() => {
        router.push('/mydatasets').catch((err) => console.error('Router Push Error:', err))
      }, 800)
    } catch (error: any) {
      console.error('Login Error:', error)
      showToast(extractBackendError(error), 'error')
    } finally {
      isLoading.value = false
    }
  }

  return {
    username,
    password,
    isLoading,
    login,
  }
}
