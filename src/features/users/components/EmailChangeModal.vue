<script setup lang="ts">
defineProps<{
  isOpen: boolean
  newEmail: string
  emailCode: string
  sendingCode: boolean
  codeCooldown: number
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:newEmail', value: string): void
  (e: 'update:emailCode', value: string): void
  (e: 'send-code'): void
  (e: 'confirm'): void
  (e: 'close'): void
}>()
</script>

<template>
  <div v-if="isOpen" class="modal modal-open">
    <div class="modal-box max-w-md">
      <h3 class="font-bold text-lg">Change Email</h3>
      <p class="py-2">Enter new email and the verification code sent to it.</p>

      <div class="form-control">
        <label class="label"><span class="label-text">New Email</span></label>
        <input
          type="email"
          :value="newEmail"
          @input="emit('update:newEmail', ($event.target as HTMLInputElement).value)"
          placeholder="you@example.com"
          class="input input-bordered w-full"
        />
      </div>

      <div class="form-control mt-3">
        <label class="label"><span class="label-text">Verification Code</span></label>
        <div class="flex gap-2">
          <input
            type="text"
            :value="emailCode"
            @input="emit('update:emailCode', ($event.target as HTMLInputElement).value)"
            placeholder="123456"
            class="input input-bordered flex-1"
          />
          <button
            class="btn btn-outline btn-neutral border-base-300 shadow-none"
            :disabled="sendingCode || codeCooldown > 0"
            @click="emit('send-code')"
          >
            <span v-if="codeCooldown > 0">Resend ({{ codeCooldown }})</span>
            <span v-else>Send Code</span>
          </button>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" type="button" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" type="button" @click="emit('confirm')" :disabled="loading">
          Confirm
        </button>
      </div>
    </div>
  </div>
</template>
