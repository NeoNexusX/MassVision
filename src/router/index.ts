import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/LoginView.vue'
import Dashboard from '../views/DashboardView.vue'
import UserProfileView from '../views/UserProfileView.vue'

const routes = [
  {
    path: '/',
    redirect: '/login'
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
    meta: { requiresAuth: true } // 只有登录才能看
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})


router.beforeEach((to, from, next) => {
  const publicPages = ['/login', '/register'];
  const authRequired = !publicPages.includes(to.path);
  // FIX: 使用 'access_token'，与 LoginView.vue 中的存储名称保持一致
  const loggedIn = localStorage.getItem('access_token');

  // 重定向到登录页
  if (authRequired && !loggedIn) {
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    });
  } else {
    // 允许已登录用户访问任何页面（包括登录/注册）
    next();
  }
});

export default router
