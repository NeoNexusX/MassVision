<script setup lang="ts">
import RegisterAccountForm from '@/features/auth/components/RegisterAccountForm.vue'
import RegisterProfileForm from '@/features/auth/components/RegisterProfileForm.vue'
import { useRegisterForm } from '@/features/auth/composables/useRegisterForm'

const {
  form,
  errors,
  patterns,
  loading,
  regionOptions,
  positionOptions,
  researchFieldOptions,
  isOtherResearchField,
  customResearchField,
  countdown,
  isCountdownActive,
  isExhausted,
  passwordScore,
  progressBarClass,
  validateField,
  validatePasswordStrength,
  clearError,
  handleResearchFieldChange,
  sendVerificationCode,
  register,
} = useRegisterForm()
</script>

<template>
  <div class="flex-1 w-full flex items-center justify-center p-8 bg-base-200/30">
    <div
      class="card max-w-5xl w-full bg-base-100 shadow-2xl rounded-2xl overflow-visible border border-base-200"
    >
      <div class="flex flex-col lg:flex-row relative items-stretch">
        <RegisterAccountForm
          :form="form"
          :errors="errors"
          :patterns="patterns"
          :loading="loading"
          :password-score="passwordScore"
          :progress-bar-class="progressBarClass"
          :countdown="countdown"
          :is-countdown-active="isCountdownActive"
          :is-exhausted="isExhausted"
          :validate-field="validateField"
          :validate-password-strength="validatePasswordStrength"
          :clear-error="clearError"
          :send-verification-code="sendVerificationCode"
        />

        <RegisterProfileForm
          v-model:custom-research-field="customResearchField"
          :form="form"
          :errors="errors"
          :loading="loading"
          :position-options="positionOptions"
          :region-options="regionOptions"
          :research-field-options="researchFieldOptions"
          :is-other-research-field="isOtherResearchField"
          :validate-field="validateField"
          :clear-error="clearError"
          :handle-research-field-change="handleResearchFieldChange"
          :register="register"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress {
  transition: all 0.3s ease;
}
.toast {
  animation: slideIn 0.3s ease;
}
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
