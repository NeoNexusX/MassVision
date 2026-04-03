<template>
  <div class="form-control w-full relative">
    <!-- Wrap select in label.input-group pattern to match AuthInput -->
    <label class="input validator w-full flex items-center gap-2">
      <SvgIcon v-if="iconType" :type="iconType" />
      
      <select 
        class="select select-ghost w-full font-normal h-full px-0 focus:bg-transparent focus:outline-none outline-none border-none focus:border-none shadow-none focus:shadow-none ring-0 focus:ring-0"
        :class="{'text-base-content/50': !modelValue}"
        :value="modelValue"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value); $emit('change', $event)"
        @focus="$emit('focus')"
        @blur="$emit('blur')"
      >
        <option disabled value="">{{ placeholder }}</option>
        <option 
          v-for="option in options" 
          :key="typeof option === 'object' ? option.value : option" 
          :value="typeof option === 'object' ? option.value : option"
          class="text-base-content"
        >
          {{ typeof option === 'object' ? option.label : option }}
        </option>
      </select>
    </label>
    
    <!-- Slot for extra content (like custom input) -->
    <slot></slot>

    <label class="label" v-if="error">
      <span class="label-text-alt text-error">{{ error }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import SvgIcon from './SvgIcon.vue';

interface OptionItem {
  label: string;
  value: string | number;
}

defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array as PropType<(string | OptionItem)[]>,
    required: true
  },
  placeholder: {
    type: String,
    default: 'Select an option'
  },
  iconType: { 
    type: String,
    default: '' 
  },
  error: {
    type: String,
    default: ''
  }
});

defineEmits(['update:modelValue', 'change', 'focus', 'blur']);
</script>