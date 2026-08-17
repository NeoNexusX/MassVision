<script setup lang="ts">
import IconInput from '@/shared/components/IconInput.vue'
import { getAppName } from '@/shared/config/appName'

defineProps<{
  username: string
  password: string
  isLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:username', value: string): void
  (e: 'update:password', value: string): void
  (e: 'submit'): void
}>()
</script>

<template>
  <form
    class="card max-w-md w-full flex flex-col gap-6 bg-base-100 shadow-xl p-5 sm:p-8 rounded-box border border-base-200"
    @submit.prevent="emit('submit')"
  >
    <div class="text-center">
      <h2 class="text-[1.5em] font-bold">Sign In</h2>
    </div>

    <IconInput
      :model-value="username"
      @update:model-value="emit('update:username', String($event))"
      icon-type="user"
      type="text"
      autocomplete="username"
      required
      placeholder="Username"
    />

    <IconInput
      :model-value="password"
      @update:model-value="emit('update:password', String($event))"
      icon-type="password"
      type="password"
      autocomplete="current-password"
      required
      placeholder="Password"
    />

    <div class="form-control w-full mt-2">
      <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
        <span v-if="isLoading" class="loading loading-spinner"></span>
        {{ isLoading ? 'Signing In...' : 'Sign In' }}
      </button>
    </div>

    <div class="text-center">
      <span class="text-[1rem]">New to {{ getAppName() }} ?</span>
      <router-link to="/register" class="link link-hover text-secondary text-[1rem] font-semibold">
        Create an account
      </router-link>
      <br />
      <router-link
        to="/forgotpassword"
        class="link link-hover text-[1rem] text-base-content/70"
      >
        Forgot Password?
      </router-link>
    </div>
  </form>
</template>
