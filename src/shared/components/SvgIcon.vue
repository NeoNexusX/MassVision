<script setup lang="ts">
import { computed } from 'vue'
import { QuestionMarkCircleIcon } from '@heroicons/vue/24/outline'
import { ICON_MAP, type IconType } from './svgIcons'

const props = defineProps<{ type: IconType }>()

// 未命中（理论上被类型拦住，仅运行时兜底）回退为问号图标
const IconComp = computed(() => ICON_MAP[props.type] ?? QuestionMarkCircleIcon)
</script>

<template>
  <component v-bind="$attrs" :is="IconComp" class="inline-block" aria-hidden="true" />
</template>
