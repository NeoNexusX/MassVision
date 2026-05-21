<template>
  <dialog class="modal" :class="{ 'modal-open': open }">
    <div class="modal-box">
      <h3 class="text-lg font-bold flex items-center gap-2">
        <slot name="icon" />
        {{ title }}
      </h3>
      <p class="py-4">
        <slot>{{ message }}</slot>
      </p>
      <div class="modal-action">
        <button class="btn" @click="$emit('cancel')" :disabled="loading">Cancel</button>
        <button
          :class="['btn', danger ? 'btn-error text-white' : 'btn-primary']"
          @click="$emit('confirm')"
          :disabled="loading"
        >
          <span v-if="loading" class="loading loading-spinner loading-sm"></span>
          {{ confirmLabel }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="$emit('cancel')">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean
    title: string
    message?: string
    confirmLabel?: string
    danger?: boolean
    loading?: boolean
  }>(),
  {
    message: '',
    confirmLabel: 'Confirm',
    danger: false,
    loading: false,
  },
)

defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>
