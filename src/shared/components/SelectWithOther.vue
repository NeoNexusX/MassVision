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
    <div v-if="isOther" class="mt-1">
      <input
        :value="otherText"
        @input="onOtherInput"
        @blur="onOtherBlur"
        class="input input-bordered input-md w-full"
        :class="{ 'input-error': otherError }"
        :placeholder="otherPlaceholder"
        maxlength="50"
      />
      <span v-if="otherError" class="text-base text-error mt-1 block">{{ otherError }}</span>
    </div>
  </IconSelect>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import IconSelect from '@/shared/components/IconSelect.vue'
import { normalizeOtherInput, toTitleCase, validateOtherInput } from '@/shared/utils/normalizeOtherInput'

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
const otherText = ref('')
const otherError = ref('')

watch(() => props.modelValue, (val) => {
  if (val === 'Other') {
    isOther.value = true
    otherText.value = ''
    otherError.value = ''
  } else if (val === '' || props.options.includes(val)) {
    isOther.value = false
    otherText.value = ''
    otherError.value = ''
  } else {
    // User-typed value (not "Other" but also not in options)
    isOther.value = true
    otherText.value = val
  }
}, { immediate: true })

function onSelectChange(value: string) {
  otherText.value = ''
  otherError.value = ''
  emit('update:modelValue', value)
}

function onOtherInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  const normalized = normalizeOtherInput(raw)
  otherText.value = normalized
  otherError.value = ''
  // Only emit non-empty values — deleting all text should not collapse the input
  if (normalized.trim()) {
    emit('update:modelValue', normalized)
  }
}

function onOtherBlur() {
  if (!otherText.value.trim()) {
    otherError.value = 'Please specify the value.'
    return
  }

  const validationError = validateOtherInput(otherText.value)
  if (validationError) {
    otherError.value = validationError
    return
  }

  otherError.value = ''
  const sanitized = toTitleCase(otherText.value)
  otherText.value = sanitized
  emit('update:modelValue', sanitized)
}</script>
