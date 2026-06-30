import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import Login from '../views/LoginView.vue'
import Home from '../views/HomeView.vue'
import UserProfileView from '../views/UserProfileView.vue'
import PublicDatasets from '../views/PublicDatasets.vue'
import MyDatasets from '../views/MyDatasets.vue'
import { authStorage } from '@/features/auth/services/authStorage'
import { useAuthStore } from '@/features/auth/stores/authStore'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/datasets',
    name: 'PublicDatasets',
    component: PublicDatasets,
  },
  {
    path: '/mydatasets',
    name: 'MyDatasets',
    component: MyDatasets,
    meta: { requiresAuth: true },
  },
  {
    path: '/overview',
    name: 'DatasetOverview',
    component: () => import('../views/DatasetOverviewView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/RegisterView.vue'),
  },
  {
    path: '/forgotpassword',
    name: 'ForgotPassword',
    component: () => import('../views/ForgotPasswordView.vue'),
  },
  {
    path: '/users',
    name: 'UserManagement',
    component: () => import('../views/UserManagementView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: UserProfileView,
    meta: { requiresAuth: true },
  },
  {
    path: '/workspace',
    name: 'Workspace',
    component: () => import('../views/workspace/WorkspacePage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/workspace/new',
    name: 'NewAnalysis',
    component: () => import('../views/workspace/NewAnalysis.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/workspace/results',
    name: 'WorkspaceResultDetail',
    component: () => import('../views/workspace/ResultDetail.vue'),
    meta: { requiresAuth: true },
  },
  // 裸 /docs 转发后由 nginx 的 `location = /docs` 301 补斜杠，这里无需特殊处理。
  {
    path: '/docs/:pathMatch(.*)*',
    component: { render: () => null },
    beforeEnter: (to: RouteLocationNormalized) => {
      window.location.assign(to.fullPath)
      return false
    },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to, from, next) => {
  // Check meta fields
  const authRequired = to.matched.some((record) => record.meta.requiresAuth)
  const adminRequired = to.matched.some((record) => record.meta.requiresAdmin)
  // Retrieve token via the auth storage utility
  // Use `let` so we can re-check after attempting to fetch user (fetchUser may clear token on 401)
  let loggedIn = authStorage.getToken()

  // Redirect to Profile if already logged in and trying to access login/register pages
  // But allow it if coming from an auth-required page (token may be stale / backend down)
  const fromAuthRequired = from.matched.some((record) => record.meta.requiresAuth)
  if (loggedIn && !fromAuthRequired && ['/login', '/register', '/forgotpassword'].includes(to.path)) {
    return next('/profile')
  }

  // Redirect to login page if authentication is required but user is not logged in
  if (authRequired && !loggedIn) {
    return next({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }

  // If auth is required and we have a token, verify it's still valid
  if (authRequired && loggedIn) {
    const auth = useAuthStore()
    if (!auth.user) {
      try {
        await auth.fetchUser()
      } catch {
        // Token expired/invalid — clear and redirect to login
        authStorage.clearAuthData()
        return next({ path: '/login', query: { redirect: to.fullPath } })
      }
    }
  }

  // If route requires admin, ensure the current user is an admin
  if (adminRequired) {
    const auth = useAuthStore()
    // If we have a token but no user loaded, try to fetch the user profile first
    if (loggedIn && !auth.user) {
      try {
        await auth.fetchUser()
      } catch {
        // ignore - fetchUser will handle logout on 401
      }
      // Re-check token after fetchUser because it may have triggered logout and cleared the token
      loggedIn = authStorage.getToken()
    }

    // If user is not admin, block access
    if (!auth.isAdmin) {
      // If not authenticated, redirect to login; otherwise redirect to profile/home
      if (!loggedIn) {
        return next({ path: '/login', query: { redirect: to.fullPath } })
      }
      return next({ path: '/profile' })
    }
  }

  // Proceed with navigation
  return next()
})

export default router
