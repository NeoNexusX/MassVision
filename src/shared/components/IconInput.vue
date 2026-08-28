<template>
  <div class="form-control fluid-input">
    <template v-if="!hideLabel && label">
      <label class="label">
        <span class="label-text text-[1em] font-semibold" :class="{ 'opacity-50': readonly }">
          {{ label }}
        </span>
      </label>
    </template>

    <label class="input w-full flex items-center gap-2 fluid-input" :class="{ validator: validator, 'bg-base-200': readonly }">
      <SvgIcon
        v-if="iconType"
        :type="iconType"
        class="icon-fluid mr-2 ml-2 flex-shrink-0"
        aria-hidden="true"
      />
      <input
        v-model="value"
        class="flex-1 bg-transparent outline-none h-full py-2 text-[0.9em] min-w-0"
        :class="{ truncate: readonly }"
        :type="type"
        :readonly="readonly"
        :required="required"
        :placeholder="placeholder"
        :pattern="pattern"
        :minlength="minLength"
        :maxlength="maxLength"
        :title="readonly ? String(modelValue) : title"
        :autocomplete="autocomplete"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
    </label>

    <span v-if="error" class="label text-sm text-error whitespace-pre-line pt-1 block">{{ error }}</span>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'blur', ev: Event): void
  (e: 'input', ev: Event): void
  (e: 'focus', ev: Event): void
  (e: 'keydown', ev: KeyboardEvent): void
}>()

const props = defineProps({
  label: { type: String, default: '' },
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  iconType: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
  hideLabel: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  pattern: { type: String, default: '.*' },
  minLength: { type: Number, default: 0 },
  maxLength: { type: Number, default: 100 },
  title: { type: String, default: '' },
  error: { type: String, default: '' },
  validator: { type: Boolean, default: false },
  autocomplete: { type: String, default: undefined },
})

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const onInput = (e: Event) => {
  emit('input', e)
}

const onFocus = (e: Event) => {
  emit('focus', e)
}

const onBlur = (e: Event) => {
  emit('blur', e)
}

const onKeydown = (e: KeyboardEvent) => {
  emit('keydown', e)
}
</script>
