<script setup lang="ts">
import { computed } from 'vue'
import { I18nT } from 'vue-i18n'
import IconInput from '@/shared/components/IconInput.vue'
import { passwordStrengthLabel } from '@/features/auth/utils/passwordStrength'

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
const strengthLabel = computed(() => passwordStrengthLabel(props.passwordScore))
</script>

<template>
  <div
    class="card max-w-md w-full flex flex-col gap-5 bg-base-100 shadow-xl p-5 sm:p-8 rounded-box border border-base-200 kawaru-text-100"
  >
    <div class="text-center">
      <h2 class="kawaru-text-150 font-bold">{{ $t('auth.forgot.title') }}</h2>
      <p v-if="step === 'email'" class="text-base-content/60 mt-2 kawaru-text-87">
        {{ $t('auth.forgot.emailHint') }}
      </p>
      <!-- 邮箱在句中的位置随语言变化，用 I18nT 的具名插槽把加粗的邮箱嵌进译文 -->
      <I18nT
        v-else
        keypath="auth.forgot.codeHint"
        tag="p"
        scope="global"
        class="text-base-content/60 mt-2 kawaru-text-87"
      >
        <template #email>
          <span class="font-semibold text-base-content">{{ form.email }}</span>
        </template>
      </I18nT>
    </div>

    <!-- Step 1: Enter email -->
    <template v-if="step === 'email'">
      <IconInput
        v-model="form.email"
        icon-type="email"
        type="email"
        required
        validator
        :placeholder="$t('common.field.email')"
        :pattern="patterns.email"
        :error="errors.email"
        @blur="validateField('email')"
        @focus="clearError('email')"
      />

      <div class="form-control w-full mt-2">
        <button
          class="btn btn-primary w-full kawaru-text-87"
          :disabled="loading.sendCode || isExhausted"
          @click="sendCode"
        >
          <span v-if="loading.sendCode" class="loading loading-spinner loading-sm"></span>
          {{ loading.sendCode ? $t('auth.forgot.sending') : $t('auth.code.send') }}
        </button>
      </div>

      <div class="text-center border-t border-base-200 pt-4">
        <router-link to="/login" class="link link-hover text-secondary kawaru-text-87 font-semibold">
          {{ $t('auth.forgot.backToSignIn') }}
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
              :placeholder="$t('auth.field.verificationCode')"
              :pattern="patterns.verify_code"
              :error="errors.verify_code"
              @blur="validateField('verify_code')"
              @focus="clearError('verify_code')"
            />
          </div>
          <button
            @click="sendCode"
            class="btn btn-neutral min-w-[100px] kawaru-text-87"
            :disabled="isCountdownActive || loading.sendCode || isExhausted"
            :class="{ 'opacity-50 cursor-not-allowed': isExhausted }"
            :title="isExhausted ? $t('auth.code.tooManyRequests') : ''"
          >
            <span v-if="loading.sendCode" class="loading loading-spinner loading-xs"></span>
            <span v-else-if="isCountdownActive" class="font-mono">{{
              $t('auth.code.countdown', { seconds: countdown })
            }}</span>
            <span v-else-if="isExhausted">{{ $t('auth.code.limitReached') }}</span>
            <span v-else>{{ $t('auth.forgot.resend') }}</span>
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
            :placeholder="$t('auth.field.newPassword')"
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
          <div class="flex justify-between kawaru-text-75 opacity-70">
            <span>{{ $t('auth.strength.label') }}</span>
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
          :placeholder="$t('auth.field.confirmNewPassword')"
          :error="errors.confirm_password"
          @blur="validateField('confirm_password')"
          @focus="clearError('confirm_password')"
        />
      </div>

      <div class="form-control w-full mt-2">
        <button class="btn btn-primary w-full kawaru-text-87" :disabled="loading.reset" @click="submitReset">
          <span v-if="loading.reset" class="loading loading-spinner loading-sm"></span>
          {{ loading.reset ? $t('auth.forgot.submitting') : $t('auth.forgot.submit') }}
        </button>
      </div>

      <div class="flex items-center justify-center gap-4">
        <button class="btn btn-ghost btn-sm kawaru-text-87" @click="backToEmail">
          {{ $t('auth.forgot.changeEmail') }}
        </button>
        <router-link to="/login" class="link link-hover text-secondary kawaru-text-87 font-semibold">
          {{ $t('auth.forgot.backToSignIn') }}
        </router-link>
      </div>
    </template>
  </div>
</template>

