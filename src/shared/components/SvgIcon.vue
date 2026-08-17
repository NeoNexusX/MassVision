<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { ICON_MAP, type IconType } from './svgIcons'

const props = defineProps<{ type: IconType }>()

// 未命中（理论上被类型拦住，仅运行时兜底）回退为问号图标
const iconName = computed(() => ICON_MAP[props.type] ?? 'heroicons:question-mark-circle')
</script>

<template>
  <!-- 默认 1.125em（比相邻文字大一号），调用方的 w-*/h-* 类可覆盖 -->
  <Icon v-bind="$attrs" :icon="iconName" class="h-[1.125em] w-[1.125em] inline-block" aria-hidden="true" />
</template>
