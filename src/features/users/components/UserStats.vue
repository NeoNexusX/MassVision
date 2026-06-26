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
      <div class="text-base text-base-content/60">Total Users</div>
      <div class="text-4xl font-bold mt-2 text-base-content">{{ stats.total }}</div>
    </div>
    <div class="bg-base-100 rounded-lg shadow-sm border border-base-200/60 p-4 text-center">
      <div class="text-base text-base-content/60">Admin</div>
      <div class="text-4xl font-bold mt-2 text-info">{{ stats.admin }}</div>
    </div>
    <div class="bg-base-100 rounded-lg shadow-sm border border-base-200/60 p-4 text-center">
      <div class="text-base text-base-content/60">Users</div>
      <div class="text-4xl font-bold mt-2 text-success">{{ stats.regularUsers }}</div>
    </div>
    <div class="bg-base-100 rounded-lg shadow-sm border border-base-200/60 p-4 text-center">
      <div class="text-base text-base-content/60">Institutions</div>
      <div class="text-4xl font-bold mt-2 text-base-content">{{ stats.instCount }}</div>
    </div>
  </div>
</template>
