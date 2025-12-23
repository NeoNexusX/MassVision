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
          <li><router-link to="/dashboard">BionetServer</router-link></li>
          <!-- <li><router-link to="/update">UpdateUser</router-link></li> -->
        </ul>
      </div>
    </div>

    <!-- center -->
    <div class="navbar-center">
      <router-link to="/" class="btn btn-ghost text-xl">BionetServer</router-link>
    </div>

    <!-- end -->
    <div class="navbar-end space-x-4">
      <div v-if="user" class="flex items-center">
        <div class="avatar placeholder">
          <div class="bg-neutral text-neutral-content rounded-full w-8">
            <span class="text-xs">{{ userInitial }}</span>
          </div>
        </div>
        <span class="ml-2 font-medium">{{ user.username }}</span>
      </div>
      <input type="checkbox" value="fantasy" class="toggle theme-controller" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import http from '../utils/http';

const user = ref(null);

const userInitial = computed(() => {
  return user.value?.username?.charAt(0).toUpperCase();
});

const getUser = async () => {
  try {
    const token = localStorage.getItem('jwtToken');
    if (!token) return;
    
    // Assuming /user endpoint exists as per original code
    const response = await http.get('/user');
    user.value = response.data;
  } catch (error) {
    console.error('Failed to get user information:', error);
    // If 401, maybe clear token?
    if (error.response && error.response.status === 401) {
       localStorage.removeItem('jwtToken');
    }
  }
};

onMounted(() => {
  getUser();
});
</script>
