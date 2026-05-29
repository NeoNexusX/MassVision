<template>
  <div class="form-control w-full fluid-input">
    <template v-if="!hideLabel && label">
      <label class="label">
        <span class="label-text text-[1em] font-semibold">
          {{ label }}
        </span>
      </label>
    </template>

    <label class="select w-full flex items-center gap-2 fluid-input" :class="{ validator: validator }">
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
              opacity-80
              text-[0.9em]"
        :value="modelValue"
        :required="required"
        @change="onChange"
        @focus="emit('focus')"
      >
        <option v-if="placeholder" value="" :disabled="required">{{ placeholder }}</option>
        <option
          v-for="(value, label) in normalizedOptions"
          :key="label"
          :value="value"
        >
          {{ label }}
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
import { computed } from 'vue'
import type { PropType } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  options: {
    type: [String, Array, Object] as PropType<string | string[] | Record<string, string>>,
    required: true,
  },
  label: {
    type: String,
    default: '',
  },
  hideLabel: {
    type: Boolean,
    default: false,
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
  validator: {
    type: Boolean,
    default: false,
  },
  required: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'change', 'focus'])

const normalizedOptions = computed(() => {
  if (typeof props.options === 'string') {
    return { [props.options]: props.options }
  }

  if (Array.isArray(props.options)) {
    return props.options.reduce<Record<string, string>>((options, option) => {
      options[option] = option
      return options
    }, {})
  }
  return props.options
})

const onChange = (e: Event) => {
  const value = (e.target as HTMLSelectElement).value
  emit('update:modelValue', value)
  emit('change', value)
}
</script>
