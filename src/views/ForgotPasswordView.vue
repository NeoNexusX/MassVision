<script setup lang="ts">
import ForgotPasswordForm from '@/features/auth/components/ForgotPasswordForm.vue'
import { useForgotPassword } from '@/features/auth/composables/useForgotPassword'

const forgot = useForgotPassword()
</script>

<template>
  <div class="flex-1 w-full flex items-center justify-center p-4 sm:p-8 bg-base-200 page-type">
    <ForgotPasswordForm
      :form="forgot.form"
      :errors="forgot.errors"
      :patterns="forgot.patterns"
      :loading="forgot.loading"
      :step="forgot.step.value"
      :password-score="forgot.passwordScore.value"
      :progress-bar-class="forgot.progressBarClass.value"
      :countdown="forgot.countdown.value"
      :is-countdown-active="forgot.isCountdownActive.value"
      :is-exhausted="forgot.isExhausted.value"
      :validate-field="forgot.validateField"
      :clear-error="forgot.clearError"
      :send-code="forgot.sendCode"
      :submit-reset="forgot.submitReset"
      :back-to-email="forgot.backToEmail"
    />
  </div>
</template>
