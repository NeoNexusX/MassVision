<script setup lang="ts">
import SvgIcon from './SvgIcon.vue';
import { computed } from 'vue';

const emit = defineEmits(['update:modelValue', 'blur', 'input', 'focus']);

const props = defineProps({
    modelValue: { type: String, default: '' },
    type: { type: String, default: 'text' },
    iconType: { type: String, required: true },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    pattern: { type: String, default: '.*' },
    minLength: { type: Number, default: 0 },
    maxLength: { type: Number, default: 100 },
    title: { type: String, default: '' },
    error: { type: String, default: '' },
});

const value = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
});

const onInput = (e: Event) => {
    emit('input', e);
};

const onFocus = (e: Event) => {
    emit('focus', e);
    console.log('focus');
};

const onBlur = (e: Event) => {
    emit('blur', e);
};
</script>

<template>
  <div>
    <label class="input validator w-full flex items-center">
        <SvgIcon :type="iconType" />
        <!-- v-model two-way binding -->
        <input
            v-model="value"
            :type="type"
            :required="required"
            :placeholder="placeholder"
            :pattern="pattern"
            :minlength="minLength"
            :maxlength="maxLength"
            :title="title"
            @input="onInput"
            @focus="onFocus"
            @blur="onBlur" />
    </label>
    <span class="label text-sm text-error whitespace-pre-line pt-1 block">{{ error }}</span>
  </div>
    <slot />
</template>
