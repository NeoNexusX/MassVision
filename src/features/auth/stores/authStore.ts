import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth_api } from '@/shared/api/httpClient'
import { secureStorage } from '@/features/auth/services/authStorage'
import { logoutApi } from '@/features/auth/api/authApi'
import { STORAGE_KEYS } from '@/shared/config'

interface User {
  username: string
  email: string
  [key: string]: any
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(secureStorage.getToken())

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => {
    return user.value?.identity === 'admin'
  })

  // Initialize state from local storage and secureStorage (if available)
  // But usually we just need token to fetch user profile

  async function fetchUser() {
    try {
      if (!token.value) return
      const response = await auth_api.get('/user')
      user.value = response.data
    } catch (error: any) {
      console.error('Failed to fetch user:', error)
      // Only logout on 401 Unauthorized
      if (error.response && error.response.status === 401) {
        await logout()
      }
    }
  }

  async function login(accessToken: string) {
    if (!accessToken) return
    token.value = accessToken
    // Update local storage
    localStorage.setItem(STORAGE_KEYS.accessToken, accessToken)

    // Fetch user immediately to update UI
    await fetchUser()
  }

  async function logout() {
    console.log('AuthStore: logout called. Token present:', !!token.value)
    try {
      if (token.value) {
        await logoutApi()
        console.log('Backend logout successful')
      } else {
        console.log('No token found, skipping backend logout')
      }
    } catch (error) {
      console.error('Logout API failed:', error)
    } finally {
      token.value = null
      user.value = null
      secureStorage.clearAuthData()
    }
  }

  // Try to recover user if we have a token but no user data (e.g. on page reload)
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
