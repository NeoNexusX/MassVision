<template>
  <div class="card max-w-md w-full flex flex-col gap-6">
    <div class="text-center">
      <h2 class="text-2xl font-bold">Sign In</h2>
    </div>

    <!-- Username input -->
    <AuthInput 
      v-model="username" 
      icon-type="user" 
      type="text" 
      required 
      placeholder="Username" 
    />
    
    <!-- Password input -->
    <AuthInput 
      v-model="password" 
      icon-type="password" 
      type="password" 
      required 
      placeholder="Password" 
    />
    
    <!-- Action Button -->
    <div class="form-control w-full mt-2">
      <button class="btn btn-primary w-full" @click="login" :disabled="isLoading">
        <span v-if="isLoading" class="loading loading-spinner"></span>
        {{ isLoading ? 'Signing In...' : 'Sign In' }}
      </button>
    </div>

    <!-- Footer Link -->
    <div class="text-center">
      <span class="text-sm opacity-75">New to BionetServer? </span>
      <router-link to="/register" class="link link-hover text-primary text-sm font-semibold">
        Create an account
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AuthInput from '../components/AuthInput.vue';
import { useRouter } from 'vue-router';
import { api as http } from '../utils/api';
import qs from 'qs';

const router = useRouter();
const username = ref('');
const password = ref('');
const isLoading = ref(false);

const login = async () => {
  if (!username.value || !password.value) {
    alert('Please enter both username and password.');
    return;
  }

  isLoading.value = true;

  try {
    const response = await http.post('/login', qs.stringify({
      username: username.value,
      password: password.value
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    if (response.status !== 200) {
      throw new Error(response.data?.message || 'Unable to connect the server.');
    }

    const { access_token } = await response.data;
    
    // Store token securely
    localStorage.setItem('access_token', access_token);

    // Route redirection logic     
    const redirectPath = (router.currentRoute.value.query.redirect as string) || '/profile';
    await router.replace(redirectPath);
  }
  catch (error: any) {
    console.error('Fail:', error);
    const msg = error.response?.data?.message || error.message || 'Invalid username or password.';
    alert(msg);
  } finally {
    isLoading.value = false;
  }
};
</script>
