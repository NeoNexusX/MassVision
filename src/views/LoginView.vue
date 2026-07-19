<script setup lang="ts">
import LoginForm from '@/features/auth/components/LoginForm.vue'
import { useLoginForm } from '@/features/auth/composables/useLoginForm'

const { username, password, isLoading, login } = useLoginForm()
</script>

<template>
  <div class="flex-1 w-full flex items-center justify-center p-4 sm:p-8 bg-base-200 page-type">
    <LoginForm
      v-model:username="username"
      v-model:password="password"
      :is-loading="isLoading"
      @submit="login"
    />
  </div>
</template>
