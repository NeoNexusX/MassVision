<script setup lang="ts">
defineProps<{
  isOpen: boolean
  newEmail: string
  emailCode: string
  sendingCode: boolean
  codeCooldown: number
  isCooldownActive: boolean
  isExhausted: boolean
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
  <div v-if="isOpen" class="modal modal-open" @click.self="emit('close')">
    <div class="modal-box max-w-md" @click.stop>
      <h3 class="font-bold kawaru-text-112">{{ $t('users.changeEmail.title') }}</h3>
      <p class="py-2">{{ $t('users.changeEmail.hint') }}</p>

      <div class="form-control">
        <label class="label"><span class="label-text">{{ $t('users.changeEmail.newEmail') }}</span></label>
        <input
          type="email"
          :value="newEmail"
          @input="emit('update:newEmail', ($event.target as HTMLInputElement).value)"
          placeholder="you@example.com"
          class="input input-bordered w-full kawaru-text-87"
        />
      </div>

      <div class="form-control mt-3">
        <label class="label"><span class="label-text">{{ $t('auth.field.verificationCode') }}</span></label>
        <div class="flex gap-2">
          <input
            type="text"
            :value="emailCode"
            @input="emit('update:emailCode', ($event.target as HTMLInputElement).value)"
            placeholder="123456"
            class="input input-bordered flex-1 kawaru-text-87"
          />
          <button
            class="btn btn-outline btn-neutral border-base-300 shadow-none kawaru-text-87"
            :disabled="sendingCode || isCooldownActive || isExhausted"
            :title="isExhausted ? $t('users.changeEmail.exhausted') : ''"
            @click="emit('send-code')"
          >
            <span v-if="isExhausted">{{ $t('auth.code.limitReached') }}</span>
            <span v-else-if="isCooldownActive">{{
              $t('users.changeEmail.resend', { seconds: codeCooldown })
            }}</span>
            <span v-else>{{ $t('auth.code.send') }}</span>
          </button>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn kawaru-text-87" type="button" @click="emit('close')">{{ $t('common.action.cancel') }}</button>
        <button class="btn btn-primary kawaru-text-87" type="button" @click="emit('confirm')" :disabled="loading">
          {{ $t('common.action.confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>
