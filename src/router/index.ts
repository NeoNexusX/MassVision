import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/LoginView.vue'
import Home from '../views/HomeView.vue'
import UserProfileView from '../views/UserProfileView.vue'
import PublicDatasets from '../views/PublicDatasets.vue'
import MyDatasets from '../views/MyDatasets.vue'
import { secureStorage } from '../utils/auth'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/datasets',
    name: 'PublicDatasets',
    component: PublicDatasets
  },
  {
    path: '/my-datasets',
    name: 'MyDatasets',
    component: MyDatasets,
    meta: { requiresAuth: true }
  },
  {
    path: '/datasets/:id',
    name: 'DatasetOverview',
    component: () => import('../views/DatasetOverviewView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/RegisterView.vue')
  },
  {
    path: '/users',
    name: 'UserManagement',
    component: () => import('../views/UserManagementView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: UserProfileView,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})


router.beforeEach(async (to, from, next) => {
  // Check meta fields
  const authRequired = to.matched.some(record => record.meta.requiresAuth);
  const adminRequired = to.matched.some(record => record.meta.requiresAdmin);
  // Retrieve token using the secure storage utility
  const loggedIn = secureStorage.getToken();

  // Redirect to Profile if already logged in and trying to access login/register pages
  if (loggedIn && ['/login', '/register'].includes(to.path)) {
    return next('/profile');
  }

  // Redirect to login page if authentication is required but user is not logged in
  if (authRequired && !loggedIn) {
    return next({
      path: '/login',
      query: { redirect: to.fullPath }
    });
  }

  // If route requires admin, ensure the current user is an admin
  if (adminRequired) {
    const auth = useAuthStore();
    // If we have a token but no user loaded, try to fetch the user profile first
    if (loggedIn && !auth.user) {
      try {
        await auth.fetchUser();
      } catch (err) {
        // ignore - fetchUser will handle logout on 401
      }
    }

    // If user is not admin, block access
    if (!auth.isAdmin) {
      // If not authenticated, redirect to login; otherwise redirect to profile/home
      if (!loggedIn) {
        return next({ path: '/login', query: { redirect: to.fullPath } });
      }
      return next({ path: '/profile' });
    }
  }

  // Proceed with navigation
  return next();
});

export default router
