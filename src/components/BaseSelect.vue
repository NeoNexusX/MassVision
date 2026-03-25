<template>
  <div class="form-control">
    <label class="label">
      <span class="label-text font-semibold">{{ label }}</span>
    </label>
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      class="select select-bordered w-full"
    >
      <option disabled value="">{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="getKey(option)"
        :value="getValue(option)"
      >
        {{ getLabel(option) }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';

type Option = string | { label?: string; name?: string; value?: string | number; code?: string | number };

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array as PropType<Option[]>,
    default: () => []
  },
  placeholder: {
    type: String,
    default: 'Select an option'
  }
});

defineEmits(['update:modelValue']);

// Helpers to handle both string[] and object[] options
const getKey = (option: Option) => {
  if (typeof option === 'string') return option;
  return option.value ?? option.code ?? option.name ?? JSON.stringify(option);
};

const getValue = (option: Option) => {
  if (typeof option === 'string') return option;
  return option.value ?? option.name ?? option.code; // Prefer value, then name (for country obj), then code
};

const getLabel = (option: Option) => {
  if (typeof option === 'string') return option;
  return option.label ?? option.name ?? option.value;
};
</script>
