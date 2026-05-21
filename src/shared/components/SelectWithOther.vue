<template>
  <div class="flex flex-col">
    <BaseSelect
      :model-value="modelValue"
      :options="options"
      :placeholder="placeholder"
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <input
      v-if="modelValue === 'Other'"
      :value="otherValue"
      @input="$emit('update:otherValue', ($event.target as HTMLInputElement).value)"
      class="input input-bordered input-sm w-full mt-1"
      :placeholder="otherPlaceholder"
    />
  </div>
</template>

<script setup lang="ts">
import BaseSelect from '@/shared/components/BaseSelect.vue'

defineProps<{
  modelValue: string
  otherValue: string
  options: string[]
  placeholder?: string
  otherPlaceholder?: string
}>()

defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'update:otherValue', v: string): void
}>()
</script>
