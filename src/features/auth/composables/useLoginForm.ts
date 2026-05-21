import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { login as loginApi } from '@/features/auth/api/authApi'
import { extractBackendError } from '@/shared/api/httpClient'
import { useToast } from '@/shared/composables/useToast'

export function useLoginForm() {
  const { showToast } = useToast()
  const router = useRouter()
  const authStore = useAuthStore()

  const username = ref('')
  const password = ref('')
  const isLoading = ref(false)

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
      showToast('Login successful! Redirecting...', 'success')
      setTimeout(() => {
        router.push('/profile').catch((err) => console.error('Router Push Error:', err))
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
