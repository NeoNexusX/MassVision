<template>
  <!-- 轻量面包屑：路径项带 chevron 分隔，末项为当前页（不可点）。全站首个面包屑组件，
       集合详情页等后续页面复用（items: [{ label, to? }]）。 -->
  <nav class="flex items-center gap-1.5 flex-wrap text-[0.9em] text-base-content/60" aria-label="Breadcrumb">
    <template v-for="(item, i) in items" :key="i">
      <router-link
        v-if="item.to"
        :to="item.to"
        class="hover:text-primary transition-colors whitespace-nowrap"
      >
        {{ item.label }}
      </router-link>
      <span v-else class="text-base-content/80 font-medium whitespace-nowrap" aria-current="page">
        {{ item.label }}
      </span>
      <SvgIcon
        v-if="i < items.length - 1"
        type="chevron_right"
        class="w-[0.85em] h-[0.85em] opacity-50 shrink-0"
      />
    </template>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  items: { label: string; to?: string }[]
}>()
</script>
