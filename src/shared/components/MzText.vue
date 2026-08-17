<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ text?: string }>()

// 按科学记数法惯例,将文本中的 "m/z" 渲染为斜体。
// 捕获组保留匹配到的 "m/z" 作为独立数组项,以便包裹 <i>。
const parts = computed(() => (props.text ?? '').split(/(m\/z)/gi))
</script>

<template>
  <span>
    <template v-for="(part, i) in parts" :key="i">
      <i v-if="part.toLowerCase() === 'm/z'">{{ part }}</i>
      <template v-else>{{ part }}</template>
    </template>
  </span>
</template>
