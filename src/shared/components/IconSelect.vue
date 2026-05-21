<template>
  <div class="form-control w-full" ref="containerRef">
    <div class="relative">
      <!-- Clickable input-like trigger -->
      <label
        class="input validator w-full flex items-center gap-2 cursor-pointer select-none"
        @click="toggleOpen"
      >
        <SvgIcon
          v-if="iconType"
          :type="iconType"
          class="w-5 h-5 mr-3 flex-shrink-0"
          aria-hidden="true"
        />

        <span
          class="grow font-normal min-w-0 py-2 truncate"
          :class="{ 'text-base-content/50': !modelValue }"
        >
          {{ displayLabel || placeholder }}
        </span>

        <SvgIcon
          type="chevron_down"
          class="w-4 h-4 flex-shrink-0 opacity-50 transition-transform"
          :class="{ 'rotate-180': open }"
        />
      </label>

      <!-- Dropdown menu -->
      <ul
        v-show="open"
        class="absolute top-full left-0 right-0 z-50 mt-1 bg-base-100 border border-base-300 rounded-md shadow-lg max-h-60 overflow-y-auto flex flex-col py-1"
      >
        <!-- Placeholder option when nothing selected -->
        <li v-if="placeholder">
          <button
            class="w-full text-left px-4 py-2 text-base-content/50 text-sm hover:bg-base-200"
            :class="{ hidden: !modelValue }"
            type="button"
            @click="selectOption('')"
          >
            {{ placeholder }}
          </button>
        </li>
        <li v-for="option in options" :key="typeof option === 'object' ? option.value : option">
          <button
            class="w-full text-left px-4 py-2 text-sm hover:bg-base-200"
            :class="{ 'bg-primary/10 text-primary font-medium': isSelected(option) }"
            type="button"
            @click="selectOption(typeof option === 'object' ? option.value : option)"
          >
            {{ typeof option === 'object' ? option.label : option }}
          </button>
        </li>
      </ul>
    </div>

    <slot></slot>

    <label class="label" v-if="error">
      <span class="label-text-alt text-error">{{ error }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type PropType } from 'vue'
import { useClickOutside } from '@/shared/composables/useClickOutside'

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

const emit = defineEmits(['update:modelValue', 'change', 'focus', 'blur'])

const open = ref(false)
const containerRef = ref<HTMLElement | null>(null)

useClickOutside(containerRef, () => {
  open.value = false
  emit('blur')
})

const displayLabel = computed(() => {
  if (!props.modelValue && props.modelValue !== 0) return ''
  const found = props.options.find(
    (o) => (typeof o === 'object' ? o.value : o) === props.modelValue,
  )
  return found && typeof found === 'object' ? found.label : String(props.modelValue)
})

const isSelected = (option: string | OptionItem) => {
  const val = typeof option === 'object' ? option.value : option
  return val === props.modelValue
}

const selectOption = (value: string | number) => {
  open.value = false
  emit('blur')
  emit('update:modelValue', value)
  emit('change', value)
}

const toggleOpen = () => {
  open.value = !open.value
  if (open.value) {
    emit('focus')
  } else {
    emit('blur')
  }
}
</script>
