import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth_api } from '@/shared/api/httpClient'
import { authStorage } from '@/features/auth/services/authStorage'
import { logoutApi } from '@/features/auth/api/authApi'

interface User {
  username: string
  email: string
  /** 后端身份标识，'admin' 时拥有管理权限 */
  identity?: string
  [key: string]: unknown
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(authStorage.getToken())

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.identity === 'admin')

  async function fetchUser() {
    if (!token.value) return
    try {
      const response = await auth_api.get('/user')
      user.value = response.data
    } catch (error: any) {
      // Only logout on 401 Unauthorized; transient errors keep the session.
      if (error.response?.status === 401) {
        await logout()
      }
    }
  }

  async function login(accessToken: string) {
    if (!accessToken) return
    token.value = accessToken
    authStorage.setToken(accessToken)
    // Fetch user immediately to update UI
    await fetchUser()
  }

  async function logout() {
    try {
      if (token.value) await logoutApi()
    } catch (error) {
      console.error('Logout API failed:', error)
    } finally {
      token.value = null
      user.value = null
      authStorage.clearAuthData()
    }
  }

  // Recover user if we have a token but no user data yet (e.g. on page reload)
  if (token.value && !user.value) {
    fetchUser()
  }

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    fetchUser,
  }
})
