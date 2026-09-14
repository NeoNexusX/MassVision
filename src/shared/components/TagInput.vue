<template>
  <!-- 标签输入：输入回车/逗号确认追加 chip，chip 上 ✕ 移除。
       用于编辑 string[] 型字段（collection 元数据的 doi/organism/analyzer…）。
       无状态：值由父级持有（v-model），去重后整体替换。
       排版沿用全站流体字号约定（em 相对 + input 类控件跟随父级基准）。 -->
  <div
    class="flex flex-wrap items-center gap-1.5 min-h-[2.4em] w-full px-1 py-1
      bg-base-100 dark:bg-slate-800 border border-base-300 rounded-lg
      focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30"
    :data-field="name"
  >
    <span
      v-for="(tag, i) in modelValue"
      :key="`${tag}-${i}`"
      class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 kawaru-text-87 font-medium
        bg-base-200/80 text-base-content/80 border border-base-300
        dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
    >
      {{ tag }}
      <button
        type="button"
        class="text-base-content/40 hover:text-error transition-colors"
        :aria-label="$t('common.input.removeTag', { tag })"
        @click="remove(i)"
      >
        <SvgIcon type="close" class="w-[0.9em] h-[0.9em]" />
      </button>
    </span>

    <input
      v-model="input"
      type="text"
      class="flex-1 min-w-[6em] bg-transparent border-none outline-none
        kawaru-text-95 text-base-content placeholder:text-base-content/40 py-0.5"
      :placeholder="modelValue.length ? '' : (placeholder ?? $t('common.input.tagPlaceholder'))"
      :aria-label="name ? $t('common.input.addNamedTag', { name }) : $t('common.input.addTag')"
      @keydown.enter.prevent="commit"
      @keydown.,.prevent="commit"
      @keydown.backspace="onBackspace"
      @blur="commit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    placeholder?: string
    /** 可访问性标签（如字段名 "DOI"） */
    name?: string
  }>(),
  { placeholder: undefined, name: '' },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const input = ref('')

/** 确认追加：trim、按逗号拆（支持一次粘贴 "a, b"）、去重；无新增时不 emit */
function commit() {
  const parts = input.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!parts.length) return
  const next = [...props.modelValue]
  let added = false
  for (const p of parts) {
    if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) {
      next.push(p)
      added = true
    }
  }
  if (added) {
    input.value = ''
    emit('update:modelValue', next)
  }
}

function remove(index: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  )
}

/** 输入框为空时按退格 = 移除最后一个 chip（常见标签输入习惯） */
function onBackspace() {
  if (input.value === '' && props.modelValue.length) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}
</script>
