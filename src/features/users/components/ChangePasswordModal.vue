<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isOpen: boolean
  newPassword: string
  confirmPassword: string
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:newPassword', value: string): void
  (e: 'update:confirmPassword', value: string): void
  (e: 'confirm'): void
  (e: 'close'): void
}>()

const mismatch = computed(() =>
  props.confirmPassword !== '' && props.newPassword !== props.confirmPassword,
)

const passwordScore = computed(() => {
  const p = props.newPassword
  if (!p) return 0
  const checks = [
    p.length >= 8,
    p.length >= 12,
    /[A-Z]/.test(p),
    /[0-9]/.test(p),
    /[^a-zA-Z0-9]/.test(p),
  ]
  return checks.filter(Boolean).length
})

const progressBarClass = computed(() => {
  const classes = ['progress-error', 'progress-warning', 'progress-warning', 'progress-success', 'progress-success']
  return classes[passwordScore.value - 1] || 'progress-error'
})

const strengthLabel = computed(() => {
  return ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][passwordScore.value - 1] || 'Please Input'
})
</script>

<template>
  <div v-if="isOpen" class="modal modal-open" @click.self="emit('close')">
    <div class="modal-box max-w-md" @click.stop>
      <h3 class="font-bold text-lg">Change Password</h3>
      <p class="py-2 text-sm opacity-70">Enter your new password. You will be asked to log in again after the change.</p>

      <div class="form-control mt-2">
        <label class="label"><span class="label-text">New Password</span></label>
        <input
          type="password"
          :value="newPassword"
          @input="emit('update:newPassword', ($event.target as HTMLInputElement).value)"
          autocomplete="new-password"
          placeholder="Enter new password"
          class="input input-bordered w-full"
        />
        <progress
          v-if="newPassword"
          :value="passwordScore"
          class="progress w-full h-1.5 mt-1"
          :class="progressBarClass"
          max="5"
        ></progress>
        <div v-if="newPassword" class="flex justify-between text-xs opacity-60 mt-0.5">
          <span>Strength</span>
          <span>{{ strengthLabel }}</span>
        </div>
      </div>

      <div class="form-control mt-3">
        <label class="label"><span class="label-text">Confirm New Password</span></label>
        <input
          type="password"
          :value="confirmPassword"
          @input="emit('update:confirmPassword', ($event.target as HTMLInputElement).value)"
          autocomplete="new-password"
          placeholder="Re-enter new password"
          class="input input-bordered w-full"
          :class="{ 'input-error': mismatch }"
        />
        <label v-if="mismatch" class="label">
          <span class="label-text-alt text-error">Passwords do not match</span>
        </label>
      </div>

      <div class="modal-action">
        <button class="btn" type="button" @click="emit('close')">Cancel</button>
        <button
          class="btn btn-primary"
          type="button"
          @click="emit('confirm')"
          :disabled="loading || !newPassword || !confirmPassword || mismatch"
        >
          <span v-if="loading" class="loading loading-spinner loading-sm"></span>
          Change Password
        </button>
      </div>
    </div>
  </div>
</template>
