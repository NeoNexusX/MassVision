<script setup lang="ts">
import IconInput from '@/shared/components/IconInput.vue'

defineProps<{
  form: Record<string, any>
  errors: Record<string, string>
  patterns: Record<string, string>
  loading: { register: boolean; sendCode: boolean }
  passwordScore: number
  progressBarClass: string
  countdown: number
  isCountdownActive: boolean
  isExhausted: boolean
  validateField: (field: any) => void
  clearError: (field: any) => void
  sendVerificationCode: () => void
}>()
</script>

<template>
  <div
    class="w-full lg:w-1/2 p-8 md:p-10 flex flex-col flex-1 min-h-0 border-b lg:border-b-0 lg:border-r border-base-200"
  >
    <div class="min-h-[72px] mb-4">
      <h2
        class="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent w-fit"
      >
        Create Account
      </h2>
      <p class="text-base-content/60 mt-2 text-sm">Join MassFlow for scientific data analysis</p>
    </div>

    <div class="flex flex-col gap-5">
      <div class="min-h-[56px]">
        <IconInput
          v-model="form.username"
          icon-type="user"
          type="text"
          required
          placeholder="Username"
          :pattern="patterns.username"
          :error="errors.username"
          @blur="validateField('username')"
          @focus="clearError('username')"
        />
      </div>
      <div class="min-h-[56px]">
        <IconInput
          v-model="form.email"
          icon-type="email"
          type="email"
          required
          placeholder="Email"
          :pattern="patterns.email"
          :error="errors.email"
          @blur="validateField('email')"
          @focus="clearError('email')"
        />
      </div>
      <div class="min-h-[56px]">
        <IconInput
          v-model="form.password"
          icon-type="password"
          type="password"
          required
          placeholder="Password"
          :error="errors.password"
          @focus="clearError('password')"
          @blur="validateField('password')"
        />
      </div>
      <div class="min-h-[56px] flex flex-col justify-center">
        <div class="w-full">
          <div class="flex justify-between text-xs mb-2 opacity-70">
            <span>Strength</span>
            <span>{{
              ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][passwordScore - 1] || 'None'
            }}</span>
          </div>
          <progress
            :value="passwordScore"
            class="progress w-full h-2"
            :class="progressBarClass"
            max="5"
          ></progress>
        </div>
      </div>
      <div class="min-h-[56px]">
        <IconInput
          v-model="form.confirm_password"
          icon-type="password"
          type="password"
          required
          placeholder="Confirm Password"
          :error="errors.confirm_password"
          @blur="validateField('confirm_password')"
          @focus="clearError('confirm_password')"
        />
      </div>
      <div class="min-h-[56px] flex items-start">
        <div class="form-control w-full">
          <div class="flex w-full gap-3 items-start">
            <div class="flex-grow">
              <IconInput
                v-model="form.verify_code"
                icon-type="verify_code"
                type="text"
                required
                placeholder="Verify Code"
                :pattern="patterns.verify_code"
                :error="errors.verify_code"
                @blur="validateField('verify_code')"
                @focus="clearError('verify_code')"
              />
            </div>
            <button
              @click="sendVerificationCode"
              class="btn btn-neutral min-w-[100px]"
              :disabled="isCountdownActive || loading.sendCode || isExhausted"
              :class="{ 'opacity-50 cursor-not-allowed': isExhausted }"
              :title="isExhausted ? 'Too many requests for now' : ''"
            >
              <span v-if="loading.sendCode" class="loading loading-spinner loading-xs"></span>
              <span v-else-if="isCountdownActive" class="font-mono">{{ countdown }}s</span>
              <span v-else-if="isExhausted">Limit Reached</span>
              <span v-else>Send Code</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-auto pt-6 flex items-center justify-center text-sm">
      <span class="opacity-70">Already have an account?</span>
      <router-link
        to="/login"
        class="link link-primary font-bold ml-1 no-underline hover:underline"
      >
        Sign in
      </router-link>
    </div>
  </div>
</template>
