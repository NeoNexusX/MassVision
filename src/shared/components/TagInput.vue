<template>
  <!-- 标签输入 + 可选词表下拉（同一个控件，不分模式）：
       - 始终可自由输入：回车/逗号/失焦确认追加 chip，chip 上 ✕ 移除；
       - 调用方传了 options 时，聚焦/输入即展开下拉（按值与译文过滤），
         已选项打勾、再点取消；不传或为空时没有下拉，就是纯标签输入。
       用于编辑 string[] 型字段（collection 元数据的 doi/organism/analyzer…），
       无状态：值由父级持有（v-model），去重后整体替换。
       下拉 Teleport 到 body，不会被父级 overflow / 弹窗裁掉。 -->
  <div class="w-full min-w-0">
    <!-- 容器直接用 daisyUI 的 input 类：边框色、内阴影、圆角、聚焦外轮廓都与站内其他
         输入框同源；只把固定高度改成最小高度，让 chip 多了能换行增高 -->
    <div
      ref="boxRef"
      class="input input-bordered w-full h-auto min-h-(--size) flex-wrap whitespace-normal
        gap-1.5 py-1 kawaru-text-95"
      :class="{ 'input-error': error }"
      :data-field="name"
      @click="inputRef?.focus()"
    >
      <span
        v-for="(tag, i) in modelValue"
        :key="`${tag}-${i}`"
        class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 kawaru-text-87 font-medium
          bg-base-200/80 text-base-content/80 border border-base-300
          dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
      >
        {{ display(tag) }}
        <button
          type="button"
          class="text-base-content/40 hover:text-error transition-colors"
          :aria-label="$t('common.input.removeTag', { tag: display(tag) })"
          @click.stop="remove(i)"
        >
          <SvgIcon type="close" class="w-[0.9em] h-[0.9em]" />
        </button>
      </span>

      <input
        ref="inputRef"
        v-model="input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="menuOpen"
        :aria-controls="hasOptions ? listboxId : undefined"
        :aria-activedescendant="activeIndex >= 0 ? optionId(activeIndex) : undefined"
        :aria-invalid="error ? true : undefined"
        class="flex-1 min-w-[6em] h-auto kawaru-text-95"
        :placeholder="modelValue.length ? '' : (placeholder ?? $t('common.input.tagPlaceholder'))"
        :aria-label="name ? $t('common.input.addNamedTag', { name }) : $t('common.input.addTag')"
        @focus="open = true"
        @input="onInput"
        @keydown.enter.prevent="onEnter"
        @keydown.,.prevent="commit"
        @keydown.backspace="onBackspace"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.esc="onEscape"
        @blur="onBlur"
      />
    </div>

    <p v-if="error" class="kawaru-text-75 text-error mt-1">{{ error }}</p>

    <Teleport to="body">
      <!-- mousedown.prevent：点选项时输入框不失焦，避免 blur 把半截输入提交成标签 -->
      <ul
        v-if="menuOpen"
        :id="listboxId"
        ref="menuRef"
        role="listbox"
        aria-multiselectable="true"
        data-taginput-menu
        :style="menuStyle"
        class="z-[1000] overflow-y-auto py-1 bg-base-100
          border border-base-300 rounded-box shadow-lg"
        @mousedown.prevent
      >
        <li
          v-for="(option, i) in filtered"
          :id="optionId(i)"
          :key="option"
          role="option"
          :aria-selected="isSelected(option)"
          class="flex items-center gap-2 px-3 py-1.5 cursor-pointer kawaru-text-87 text-base-content"
          :class="i === activeIndex ? 'bg-base-200 dark:bg-slate-700' : 'hover:bg-base-200/60 dark:hover:bg-slate-700/60'"
          @mousemove="activeIndex = i"
          @click="toggle(option)"
        >
          <SvgIcon
            type="check"
            class="w-[1em] h-[1em] shrink-0 text-primary"
            :class="isSelected(option) ? '' : 'invisible'"
          />
          <span class="truncate">{{ display(option) }}</span>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { t } from '@/i18n'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { useAnchoredPosition } from '@/shared/composables/useAnchoredPosition'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    /** 词表（调用方提供）：有则展开下拉建议，自由输入始终可用 */
    options?: readonly string[]
    /** 选项/chip 的显示文字（如词表译文）；只影响显示，收发的始终是原值 */
    labelOf?: (value: string) => string
    /**
     * 自由输入值的格式校验（如 DOI）。只校验手输的值，词表选项不受约束；
     * 不匹配时不追加，保留输入并提示 patternMessage。
     */
    pattern?: RegExp
    patternMessage?: string
    placeholder?: string
    /** 可访问性标签（如字段名 "DOI"） */
    name?: string
  }>(),
  {
    options: () => [],
    labelOf: undefined,
    pattern: undefined,
    patternMessage: undefined,
    placeholder: undefined,
    name: '',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const input = ref('')
const open = ref(false)
const activeIndex = ref(-1)
const error = ref('')
const boxRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

const listboxId = useId()
const optionId = (i: number) => `${listboxId}-${i}`

const display = (value: string) => props.labelOf?.(value) ?? value
const lower = (s: string) => s.toLowerCase()

// 数据集词表里的 'Other' 是给单选 SelectWithOther 切自由输入用的；
// 这里本来就能自由输入，留着它只会被当成真实取值存进去
const vocabulary = computed(() => props.options.filter((o) => o !== 'Other'))
const hasOptions = computed(() => vocabulary.value.length > 0)

const filtered = computed(() => {
  const q = lower(input.value.trim())
  if (!q) return vocabulary.value
  return vocabulary.value.filter(
    (o) => lower(o).includes(q) || lower(display(o)).includes(q),
  )
})

const menuOpen = computed(() => open.value && filtered.value.length > 0)
const { style: menuStyle } = useAnchoredPosition(boxRef, menuOpen)

// 过滤结果变了，旧的高亮下标就不再指向同一项
watch(filtered, () => (activeIndex.value = -1))

const isSelected = (option: string) =>
  props.modelValue.some((v) => lower(v) === lower(option))

/** 手输值与词表对齐：值或译文忽略大小写相同即取词表原值（"positive"/"正离子" → "Positive"） */
function canonical(text: string): string {
  const q = lower(text)
  return vocabulary.value.find((o) => lower(o) === q || lower(display(o)) === q) ?? text
}

function onInput() {
  open.value = true
  error.value = ''
}

/** 确认追加手输内容：trim、按逗号拆（支持一次粘贴 "a, b"）、对齐词表、校验、去重；无新增时不 emit */
function commit() {
  const parts = input.value
    .split(',')
    .map((s) => canonical(s.trim()))
    .filter(Boolean)
  if (!parts.length) return

  if (props.pattern) {
    const pattern = props.pattern
    const invalid = parts.find((p) => {
      if (vocabulary.value.includes(p)) return false
      pattern.lastIndex = 0 // 带 g/y 标志的正则 test 有状态
      return !pattern.test(p)
    })
    if (invalid) {
      error.value = props.patternMessage ?? t('common.input.patternMismatch', { value: invalid })
      return
    }
  }

  const next = [...props.modelValue]
  for (const p of parts) {
    if (!next.some((v) => lower(v) === lower(p))) next.push(p)
  }
  input.value = ''
  error.value = ''
  if (next.length !== props.modelValue.length) emit('update:modelValue', next)
}

/** 词表选项：未选则追加，已选则取消（多选下拉的常规行为） */
function toggle(option: string) {
  emit(
    'update:modelValue',
    isSelected(option)
      ? props.modelValue.filter((v) => lower(v) !== lower(option))
      : [...props.modelValue, option],
  )
  input.value = ''
  error.value = ''
}

function remove(index: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  )
}

/** 有高亮项就切换它，否则提交手输内容（不自动高亮首项，避免把手输值误吞成某个词表项） */
function onEnter() {
  const option = filtered.value[activeIndex.value]
  if (menuOpen.value && option !== undefined) toggle(option)
  else commit()
}

function move(step: number) {
  open.value = true
  const count = filtered.value.length
  if (!count) return
  activeIndex.value = (activeIndex.value + step + count) % count
  nextTick(() => {
    // 只滚动菜单自身：scrollIntoView 会连带滚动页面，选项滑到静止的鼠标下，
    // 高亮又被 hover 抢回去
    const menu = menuRef.value
    const item = document.getElementById(optionId(activeIndex.value))
    if (!menu || !item) return
    if (item.offsetTop < menu.scrollTop) menu.scrollTop = item.offsetTop
    else if (item.offsetTop + item.offsetHeight > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = item.offsetTop + item.offsetHeight - menu.clientHeight
    }
  })
}

function onEscape(e: KeyboardEvent) {
  // 下拉开着时 Esc 只收起下拉，不冒泡去关外层弹窗
  if (menuOpen.value) {
    e.stopPropagation()
    open.value = false
  }
}

/** 输入框为空时按退格 = 移除最后一个 chip（常见标签输入习惯） */
function onBackspace() {
  if (input.value === '' && props.modelValue.length) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}

function onBlur() {
  open.value = false
  commit()
}
</script>
