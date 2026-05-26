<template>
  <div class="form-control w-full">
    <label class="select validator w-full flex items-center gap-2 fluid-input">
      <SvgIcon
        v-if="iconType"
        :type="iconType"
        class="mr-2 ml-2 flex-shrink-0 icon-fluid"
        aria-hidden="true"
      />
      <select
        class="grow 
              focus:outline-none 
              w-full 
              appearance-none
              opacity-80
              text-[1em]"
        :value="modelValue"
        @change="onChange"
        @focus="emit('focus')"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="getValue(option)"
          :value="getValue(option)"
        >
          {{ getLabel(option) }}
        </option>
      </select>
    </label>

    <slot></slot>

    <label class="label" v-if="error">
      <span class="label-text-alt text-error">{{ error }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

interface OptionItem {
  label: string
  value: string | number
}

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  options: {
    type: Array as PropType<(string | OptionItem)[]>,
    required: true,
  },
  placeholder: {
    type: String,
    default: 'Select an option',
  },
  iconType: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'change', 'focus'])

const getValue = (option: string | OptionItem) =>
  typeof option === 'object' ? option.value : option

const getLabel = (option: string | OptionItem) =>
  typeof option === 'object' ? option.label : option

const onChange = (e: Event) => {
  const value = (e.target as HTMLSelectElement).value
  const matched = props.options.find((o) => String(getValue(o)) === value)
  const finalValue = matched !== undefined ? getValue(matched) : value
  emit('update:modelValue', finalValue)
  emit('change', finalValue)
}
</script>