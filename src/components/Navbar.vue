<template>
  <div class="navbar bg-base-100 shadow-sm">
    <!-- start -->
    <div class="navbar-start">
      <div class="dropdown">
        <div tabindex="0" role="button" class="btn btn-ghost btn-circle">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </div>
        <ul tabindex="0" class="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow">
          <li v-if="!user"><router-link to="/login">Login</router-link></li>
          <li v-if="user"><a @click="logout" class="cursor-pointer">Logout</a></li>
          <!-- <li><router-link to="/update">UpdateUser</router-link></li> -->
        </ul>
      </div>
      <!-- Logo layout: Left aligned on Desktop/Wide -->
      <router-link v-if="!isMobileLayout" to="/" class="btn btn-ghost text-xl">MassVision</router-link>
    </div>

    <!-- center -->
    <div class="navbar-center">
      <!-- Logo layout: Centered on Mobile/Narrow -->
      <router-link v-if="isMobileLayout" to="/" class="btn btn-ghost text-xl">MassVision</router-link>
    </div>

    <!-- end -->
    <div class="navbar-end space-x-4">
      <!-- User info: Hidden on Mobile/Narrow, visible on Desktop/Wide -->
      <div v-if="user && !isMobileLayout" class="flex items-center">
        <div class="avatar placeholder">
          <div class="bg-neutral text-neutral-content rounded-full w-8 h-8 flex items-center justify-center">
            <span class="text-xs">{{ userInitial }}</span>
          </div>
        </div>
        <span class="ml-2 font-medium">{{ user.username }}</span>
      </div>
      <label class="swap swap-rotate">
        <input type="checkbox" class="theme-controller" value="dark" />
        
        <!-- sun icon (visible when unchecked/light) -->
        <svg class="swap-off fill-current w-8 h-8" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>
        
        <!-- moon icon (visible when checked/dark) -->
        <svg class="swap-on fill-current w-8 h-8" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/></svg>
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { auth_api as http } from '../utils/api';
import { logoutApi } from '../utils/usr-api';

const router = useRouter();
const user = ref(null);
const isMobileLayout = ref(true);

const userInitial = computed(() => {
  return user.value?.username?.charAt(0).toUpperCase();
});

const checkLayout = () => {
  // Use visualViewport if available to detect zoom level (pinch-zoom out increases width)
  const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  // Threshold can be standard md (768px)
  isMobileLayout.value = width < 768;
};

const getUser = async () => {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Assuming /user endpoint exists as per original code
    const response = await http.get('/user');
    user.value = response.data;
  } catch (error) {
    console.error('Failed to get user information:', error);
    // If 401, maybe clear token?
    if (error.response && error.response.status === 401) {
       localStorage.removeItem('access_token');
       user.value = null; // Clear user data too if token invalid
    }
  }
};

const logout = async () => {
  console.log("Starting secure logout process...");
  try {
    // 1. Call backed to invalidate token
    await logoutApi();
    console.log("✅ Backend Logout: Success (Token invalidated on server)");
  } catch (error) {
    console.error("❌ Backend Logout: Failed or Not Implemented", error);
  } finally {
    // 2. Clear frontend state regardless of backend result
    localStorage.removeItem('access_token');
    user.value = null;
    router.push('/login');
    console.log("✅ Frontend Logout: Local token cleared");
  }
};

onMounted(() => {
  getUser();
  checkLayout();
  window.addEventListener('resize', checkLayout);
  if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', checkLayout);
  }
});

onUnmounted(() => {
    window.removeEventListener('resize', checkLayout);
    if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', checkLayout);
    }
});
</script>
