<script setup lang="ts">
/**
 * 场景占位正文 —— 「序号眉标 + 巨型标题 + 副标题」的居中叙事块。
 * 各场景（Hero / Feature / Stats）在填入真实内容前共用此占位，统一观感、消除重复。
 * 进场动画由 v-reveal 驱动；首屏 Hero 传 as="h1" 以保证全页唯一主标题。
 */
withDefaults(
  defineProps<{
    /** 序号眉标，如 'Scene 01' */
    eyebrow: string
    /** 巨型标题文案 */
    title: string
    /** 副标题 / 说明文案 */
    subtitle?: string
    /** 标题渲染标签，首屏用 'h1'，其余默认 'h2' */
    as?: 'h1' | 'h2'
  }>(),
  { as: 'h2' },
)
</script>

<template>
  <div v-reveal class="relative z-10 flex flex-col items-center text-center">
    <p class="text-xs font-semibold uppercase tracking-[0.4em] text-primary/80 sm:text-sm">
      {{ eyebrow }}
    </p>
    <component
      :is="as"
      class="mt-6 text-6xl font-black tracking-tight text-base-content/10 sm:text-8xl lg:text-9xl"
    >
      {{ title }}
    </component>
    <p v-if="subtitle" class="mt-6 max-w-md text-sm text-base-content/40 sm:text-base">
      {{ subtitle }}
    </p>
  </div>
</template>
