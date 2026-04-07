<template>
  <div :class="['dropdown w-full', placement]">
    <div tabindex="0" role="button" class="select select-bordered w-full flex items-center text-left min-h-12 h-auto py-2">
      <span class="truncate text-sm flex-1 font-normal break-words whitespace-normal">
        <template v-if="multiple">
          {{ (modelValue as string[]).length ? (modelValue as string[]).join(', ') : placeholder }}
        </template>
        <template v-else>
          {{ modelValue || placeholder }}
        </template>
      </span>
    </div>
    <ul tabindex="0" class="dropdown-content menu bg-base-100 border border-base-300 rounded-box z-[100] w-full p-2 shadow-xl max-h-64 overflow-y-auto mt-1">
      <li v-for="opt in options" :key="opt">
        <label class="cursor-pointer flex items-center gap-2">
          <input 
            v-if="multiple"
            type="checkbox" 
            class="checkbox checkbox-sm checkbox-primary" 
            :value="opt" 
            :checked="(modelValue as string[]).includes(opt)"
            @change="toggleMultiple(opt)" 
          />
          <input 
            v-else
            type="radio" 
            class="radio radio-sm radio-primary" 
            :name="uniqueId" 
            :value="opt" 
            :checked="modelValue === opt"
            @change="setSingle(opt)" 
          />
          <span class="text-sm">{{ opt }}</span>
        </label>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: string | string[];
  options: string[];
  multiple?: boolean;
  placeholder?: string;
  placement?: string;
}>(), {
  placement: 'dropdown-bottom'
});

const emit = defineEmits(['update:modelValue']);
const uniqueId = `dropdown_` + Math.random().toString(36).substr(2, 9);

function toggleMultiple(opt: string) {
  if (!Array.isArray(props.modelValue)) return;
  const arr = [...props.modelValue];
  const idx = arr.indexOf(opt);
  if (idx !== -1) arr.splice(idx, 1);
  else arr.push(opt);
  emit('update:modelValue', arr);
  
  // Keep dropdown open for multi-select, focus handles it
}

function setSingle(opt: string) {
  emit('update:modelValue', opt);
  // Auto-close single select dropdown
  const elem = document.activeElement as HTMLElement;
  if (elem) {
    elem.blur();
  }
}
</script>
