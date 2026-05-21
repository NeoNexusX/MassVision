<script setup lang="ts">
import IconInput from '@/shared/components/IconInput.vue'

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
  <div
    class="card max-w-md w-full flex flex-col gap-6 bg-base-100 shadow-xl p-8 rounded-box border border-base-200"
  >
    <div class="text-center">
      <h2 class="text-2xl font-bold">Sign In</h2>
    </div>

    <IconInput
      :model-value="username"
      @update:model-value="emit('update:username', $event)"
      icon-type="user"
      type="text"
      required
      placeholder="Username"
    />

    <IconInput
      :model-value="password"
      @update:model-value="emit('update:password', $event)"
      icon-type="password"
      type="password"
      required
      placeholder="Password"
    />

    <div class="form-control w-full mt-2">
      <button class="btn btn-primary w-full" @click="emit('submit')" :disabled="isLoading">
        <span v-if="isLoading" class="loading loading-spinner"></span>
        {{ isLoading ? 'Signing In...' : 'Sign In' }}
      </button>
    </div>

    <div class="text-center">
      <span class="text-sm opacity-75">New to MassFlow? </span>
      <router-link to="/register" class="link link-hover text-primary text-sm font-semibold">
        Create an account
      </router-link>
    </div>
  </div>
</template>
