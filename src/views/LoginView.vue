<template>
  <div class="flex-1 w-full flex items-center justify-center p-8 bg-base-200"> <!-- Added flex-1 and w-full -->
    <div class="card max-w-md w-full flex flex-col gap-6 bg-base-100 shadow-xl p-8 rounded-box border border-base-200"> <!-- Enhanced card styling -->
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
        <span class="text-sm opacity-75">New to MassFlow? </span>
        <router-link to="/register" class="link link-hover text-primary text-sm font-semibold">
          Create an account
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AuthInput from '../components/AuthInput.vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { login as loginApi } from '../utils/usr-api'; // Use the shared login helper
import { formatErrorMessage } from '../utils/api';
import { useToast } from '@/composables/useToast';

const { showToast } = useToast();
const router = useRouter();
const authStore = useAuthStore();
const username = ref('');
const password = ref('');
const isLoading = ref(false);

const login = async () => {
  if (!username.value || !password.value) {
    showToast('Please enter both username and password.', 'warning');
    return;
  }

  isLoading.value = true;

  try {
    // Use the shared login API which handles grant_type and proper formatting
    const response = await loginApi({
      username: username.value,
      password: password.value
    });
    
    if (response.status !== 200) {
      throw new Error(response.data?.message || 'Unable to connect the server.');
    }

    const { access_token } = response.data;
    
    if (access_token) {
       authStore.login(access_token);
       showToast('Login successful! Redirecting...', 'success');
       setTimeout(() => {
          router.push('/profile').catch(err => console.error("Router Push Error:", err));
       }, 800);
    } else {
       throw new Error("Invalid token received");
    }

  } catch (error: any) {
    console.error('Login Error:', error);
      // Normalize message from multiple possible locations (response.data.detail/msg or error.message)
      const candidate = error?.response?.data?.detail ?? error?.response?.data?.message ?? error?.response?.data?.msg ?? error?.message;
      const msgStr = formatErrorMessage(candidate);
      showToast(msgStr, 'error');
  } finally {
    isLoading.value = false;
  }
};
</script>
