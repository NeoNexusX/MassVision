<script setup lang="ts">
defineProps<{
  stats: {
    total: number
    admin: number
    regularUsers: number
    instCount: number
  }
}>()
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="bg-base-100 rounded-lg shadow-sm border border-base-200/60 p-4 text-center">
      <div class="kawaru-text-100 text-base-content/60">{{ $t('common.stat.totalUsers') }}</div>
      <div class="kawaru-text-240 font-bold mt-2 text-base-content">{{ stats.total }}</div>
    </div>
    <div class="bg-base-100 rounded-lg shadow-sm border border-base-200/60 p-4 text-center">
      <div class="kawaru-text-100 text-base-content/60">{{ $t('users.stats.admin') }}</div>
      <div class="kawaru-text-240 font-bold mt-2 text-info">{{ stats.admin }}</div>
    </div>
    <div class="bg-base-100 rounded-lg shadow-sm border border-base-200/60 p-4 text-center">
      <div class="kawaru-text-100 text-base-content/60">{{ $t('users.stats.users') }}</div>
      <div class="kawaru-text-240 font-bold mt-2 text-success">{{ stats.regularUsers }}</div>
    </div>
    <div class="bg-base-100 rounded-lg shadow-sm border border-base-200/60 p-4 text-center">
      <div class="kawaru-text-100 text-base-content/60">{{ $t('users.stats.institutions') }}</div>
      <div class="kawaru-text-240 font-bold mt-2 text-base-content">{{ stats.instCount }}</div>
    </div>
  </div>
</template>
