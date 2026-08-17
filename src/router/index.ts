import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
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
    path: '/s/:encodedId',
    name: 'SharedDatasetOverview',
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
      // Only allow same-origin paths under /docs/ — reject anything with a scheme
      // or that doesn't start with /docs/ (open-redirect guard).
      const fp = to.fullPath
      if (fp.startsWith('/docs/') && !/^[a-z][a-z0-9+\-.]*:/i.test(fp)) {
        window.location.assign(fp)
      }
      return false
    },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to, from, next) => {
  const authRequired = to.matched.some((record) => record.meta.requiresAuth)
  const adminRequired = to.matched.some((record) => record.meta.requiresAdmin)
  // Single source of truth: the auth store (cross-tab synced via storage event).
  const auth = useAuthStore()
  const loggedIn = !!auth.token

  // Redirect already-logged-in users away from login/register/forgot-password
  const fromAuthRequired = from.matched.some((record) => record.meta.requiresAuth)
  if (loggedIn && !fromAuthRequired && ['/login', '/register', '/forgotpassword'].includes(to.path)) {
    return next('/mydatasets')
  }

  if (authRequired && !loggedIn) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (authRequired && loggedIn && !auth.user) {
    await auth.fetchUser()
    if (!auth.token) {
      return next({ path: '/login', query: { redirect: to.fullPath } })
    }
  }

  if (adminRequired) {
    if (!auth.user) {
      try { await auth.fetchUser() } catch { /* fetchUser handles 401 */ }
    }
    if (!auth.isAdmin) {
      return next(auth.token ? '/profile' : { path: '/login', query: { redirect: to.fullPath } })
    }
  }

  return next()
})

export default router
