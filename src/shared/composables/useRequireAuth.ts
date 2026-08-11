import { useRouter } from 'vue-router'
import { useAuthStore } from '@/shared/auth/authStore'
import { useToast } from '@/shared/composables/useToast'

/**
 * 需要登录的操作守卫：未登录则提示并跳转登录页（携带回跳地址）。
 * redirect 支持 getter 延迟求值，以覆盖随页面状态变化的回跳目标
 * （如 Dataset Overview 按来源页回跳 /datasets 或 /mydatasets）。
 */
export function useRequireAuth(redirect: string | (() => string)) {
  const router = useRouter()
  const auth = useAuthStore()
  const { showToast } = useToast()

  const requireAuth = (): boolean => {
    if (!auth.token) {
      showToast('Please log in to continue.', 'warning')
      const target = typeof redirect === 'function' ? redirect() : redirect
      router.push({ path: '/login', query: { redirect: target } })
      return false
    }
    return true
  }

  return { requireAuth }
}
