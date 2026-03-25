<template>
  <div class="form-control">
    <label class="label">
      <span class="label-text font-semibold" :class="{ 'opacity-70': readonly }">{{ label }}</span>
    </label>
    <input
      :type="type"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      :readonly="readonly"
      :placeholder="placeholder"
      class="input input-bordered w-full"
      :class="{ 'bg-base-200': readonly }"
    />
  </div>
</template>

<script setup lang="ts">
defineProps({
  label: {
    type: String,
    required: true
  },
  modelValue: {
    type: [String, Number],
    default: ''
  },
  type: {
    type: String,
    default: 'text'
  },
  placeholder: {
    type: String,
    default: ''
  },
  readonly: {
    type: Boolean,
    default: false
  }
});

defineEmits(['update:modelValue']);
</script>
