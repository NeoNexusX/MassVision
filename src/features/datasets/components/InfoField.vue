<script setup lang="ts">
/** Dataset Overview 的信息字段：标签 + 值，样式与各字段原本的内联写法一致 */
defineProps<{ label: string }>()
</script>

<template>
  <div class="flex flex-col">
    <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1">{{
      label
    }}</span>
    <span class="text-base-content break-words"><slot /></span>
  </div>
</template>
