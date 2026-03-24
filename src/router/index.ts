import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/LoginView.vue'
import Dashboard from '../views/DashboardView.vue'
import Home from '../views/HomeView.vue'
import UserProfileView from '../views/UserProfileView.vue'
import PublicDatasets from '../views/PublicDatasets.vue'
import MyDatasets from '../views/MyDatasets.vue'
import { secureStorage } from '../utils/auth'

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
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
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
    path: '/profile',
    name: 'profile',
    component: UserProfileView,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})


router.beforeEach((to, from, next) => {
  // Check if authentication is required using meta fields
  const authRequired = to.matched.some(record => record.meta.requiresAuth);
  // Retrieve token using the secure storage utility
  const loggedIn = secureStorage.getToken();

  // Redirect to Profile if already logged in and trying to access login/register pages
  if (loggedIn && ['/login', '/register'].includes(to.path)) {
    return next('/profile');
  }

  // Redirect to login page if authentication is required but user is not logged in
  if (authRequired && !loggedIn) {
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    });
  } else {
    // Proceed with navigation
    next();
  }
});

export default router
