import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { authStorage } from '@/shared/auth/authStorage'
import { useAuthStore } from '@/shared/auth/authStore'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/datasets',
    name: 'PublicDatasets',
    component: () => import('../views/PublicDatasets.vue'),
  },
  {
    path: '/mydatasets',
    name: 'MyDatasets',
    component: () => import('../views/MyDatasets.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/overview',
    name: 'DatasetOverview',
    component: () => import('../views/DatasetOverviewView.vue'),
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
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
    component: () => import('../views/UserProfileView.vue'),
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
    return next('/mydatasets')
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
      // fetchUser never throws: on 401 it logs out and clears the token, so
      // re-check the token afterwards instead of relying on try/catch.
      await auth.fetchUser()
      if (!auth.token) {
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
