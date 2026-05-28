<template>
  <IconSelect
    :model-value="modelValue"
    :options="options"
    :placeholder="placeholder"
    :icon-type="iconType"
    :label="label"
    :hide-label="hideLabel"
    :error="error"
    :validator="validator"
    :required="required"
    @update:model-value="onSelectChange"
    @change="$emit('change', $event)"
    @focus="$emit('focus')"
  >
    <input
      v-if="isOther"
      :value="modelValue === 'Other' ? '' : modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="$emit('blur')"
      class="input input-bordered input-md w-full mt-1"
      :placeholder="otherPlaceholder"
    />
  </IconSelect>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import IconSelect from '@/shared/components/IconSelect.vue'

const props = defineProps<{
  modelValue: string
  options: string[]
  placeholder?: string
  otherPlaceholder?: string
  iconType?: string
  label?: string
  hideLabel?: boolean
  error?: string
  validator?: boolean
  required?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'change', v: string): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const isOther = ref(false)

watch(() => props.modelValue, (val) => {
  if (val === 'Other') {
    isOther.value = true
  } else if (props.options.includes(val)) {
    isOther.value = false
  }
}, { immediate: true })

function onSelectChange(value: string) {
  emit('update:modelValue', value)
}
</script>
