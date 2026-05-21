<template>
  <div class="form-control">
    <template v-if="!hideLabel && label">
      <label class="label">
        <span class="label-text font-semibold" :class="{ 'opacity-70': readonly }">{{
          label
        }}</span>
      </label>
    </template>
    <input
      :type="type"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      :readonly="readonly"
      :placeholder="placeholder"
      class="input input-bordered w-full font-semibold"
      :class="{ 'bg-base-200': readonly }"
    />
  </div>
</template>

<script setup lang="ts">
defineProps({
  label: {
    type: String,
    default: '',
  },
  modelValue: {
    type: [String, Number],
    default: '',
  },
  type: {
    type: String,
    default: 'text',
  },
  placeholder: {
    type: String,
    default: '',
  },
  readonly: {
    type: Boolean,
    default: false,
  },
  hideLabel: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['update:modelValue'])
</script>
