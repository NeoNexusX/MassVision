<script setup lang="ts">
import { computed } from 'vue'
import IconInput from '@/shared/components/IconInput.vue'

const props = defineProps<{
  form: Record<string, string>
  errors: Record<string, string>
  patterns: Record<string, string>
  loading: { sendCode: boolean; reset: boolean }
  step: 'email' | 'reset'
  passwordScore: number
  progressBarClass: string
  countdown: number
  isCountdownActive: boolean
  isExhausted: boolean
  validateField: (field: 'email' | 'verify_code' | 'confirm_password' | 'new_password') => void
  clearError: (field: 'email' | 'verify_code' | 'confirm_password' | 'new_password') => void
  sendCode: () => void
  submitReset: () => void
  backToEmail: () => void
}>()

/** 密码强度标签文案 */
const strengthLabel = computed(() => {
  return (
    ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][props.passwordScore - 1] || 'Please Input'
  )
})
</script>

<template>
  <div
    class="card max-w-md w-full flex flex-col gap-5 bg-base-100 shadow-xl p-8 rounded-box border border-base-200 text-[1rem]"
  >
    <div class="text-center">
      <h2 class="text-2xl font-bold">Reset Password</h2>
      <p v-if="step === 'email'" class="text-base-content/60 mt-2 text-[0.9rem]">
        Enter your registered email to receive a verification code.
      </p>
      <p v-else class="text-base-content/60 mt-2 text-[0.9rem]">
        Enter the verification code sent to
        <span class="font-semibold text-base-content">{{ form.email }}</span>
        and set a new password.
      </p>
    </div>

    <!-- Step 1: Enter email -->
    <template v-if="step === 'email'">
      <div class="flex flex-col gap-4">
        <IconInput
          v-model="form.email"
          icon-type="email"
          type="email"
          required
          validator
          placeholder="Email"
          :pattern="patterns.email"
          :error="errors.email"
          @blur="validateField('email')"
          @focus="clearError('email')"
        />
      </div>

      <div class="form-control w-full mt-2">
        <button
          class="btn btn-primary w-full"
          :disabled="loading.sendCode || isExhausted"
          @click="sendCode"
        >
          <span v-if="loading.sendCode" class="loading loading-spinner loading-sm"></span>
          {{ loading.sendCode ? 'Sending...' : 'Send Verification Code' }}
        </button>
      </div>

      <div class="text-center border-t border-base-200 pt-4">
        <router-link to="/login" class="link link-hover text-secondary text-[0.9rem] font-semibold">
          Back to Sign In
        </router-link>
      </div>
    </template>

    <!-- Step 2: Enter code + new password -->
    <template v-else>
      <div class="flex flex-col gap-4 reset-step-inputs">
        <!-- Verification code -->
        <div class="flex w-full gap-3 items-start">
          <div class="flex-grow">
            <IconInput
              v-model="form.verify_code"
              icon-type="verify_code"
              type="text"
              required
              validator
              placeholder="Verification Code"
              :pattern="patterns.verify_code"
              :error="errors.verify_code"
              @blur="validateField('verify_code')"
              @focus="clearError('verify_code')"
            />
          </div>
          <button
            @click="sendCode"
            class="btn btn-neutral min-w-[100px]"
            :disabled="isCountdownActive || loading.sendCode || isExhausted"
            :class="{ 'opacity-50 cursor-not-allowed': isExhausted }"
            :title="isExhausted ? 'Too many requests for now' : ''"
          >
            <span v-if="loading.sendCode" class="loading loading-spinner loading-xs"></span>
            <span v-else-if="isCountdownActive" class="font-mono">{{ countdown }}s</span>
            <span v-else-if="isExhausted">Limit Reached</span>
            <span v-else>Resend</span>
          </button>
        </div>

        <!-- New password -->
        <div class="flex flex-col gap-1">
          <IconInput
            v-model="form.new_password"
            icon-type="password"
            type="password"
            required
            validator
            autocomplete="new-password"
            placeholder="New Password"
            :error="errors.new_password"
            @focus="clearError('new_password')"
            @blur="validateField('new_password')"
          />
          <progress
            :value="passwordScore"
            class="progress w-full h-2"
            :class="progressBarClass"
            max="5"
          ></progress>
          <div class="flex justify-between text-xs opacity-70">
            <span>Strength</span>
            <span>{{ strengthLabel }}</span>
          </div>
        </div>

        <!-- Confirm password -->
        <IconInput
          v-model="form.confirm_password"
          icon-type="password"
          type="password"
          required
          validator
          autocomplete="new-password"
          placeholder="Confirm New Password"
          :error="errors.confirm_password"
          @blur="validateField('confirm_password')"
          @focus="clearError('confirm_password')"
        />
      </div>

      <div class="form-control w-full mt-2">
        <button
          class="btn btn-primary w-full"
          :disabled="loading.reset"
          @click="submitReset"
        >
          <span v-if="loading.reset" class="loading loading-spinner loading-sm"></span>
          {{ loading.reset ? 'Resetting...' : 'Reset Password' }}
        </button>
      </div>

      <div class="flex items-center justify-center gap-4">
        <button class="btn btn-ghost btn-sm text-[0.9rem]" @click="backToEmail">
          ← Change email
        </button>
        <router-link to="/login" class="link link-hover text-secondary text-[0.9rem] font-semibold">
          Back to Sign In
        </router-link>
      </div>
    </template>
  </div>
</template>

<style scoped>
.reset-step-inputs :deep(.fluid-input) {
  font-size: 1rem;
}
</style>
