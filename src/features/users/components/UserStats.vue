<script setup lang="ts">
defineProps<{
  stats: {
    total: number
    active: number
    inactive: number
    instCount: number
  }
}>()
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-5">
      <div class="text-sm font-medium text-base-content/50">Total Users</div>
      <div class="text-3xl font-bold mt-2 text-base-content">{{ stats.total }}</div>
    </div>
    <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-5">
      <div class="text-sm font-medium text-base-content/50">Active Users</div>
      <div class="text-3xl font-bold mt-2 text-success">{{ stats.active }}</div>
    </div>
    <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-5">
      <div class="text-sm font-medium text-base-content/50">Inactive Users</div>
      <div class="text-3xl font-bold mt-2 text-base-content/40">{{ stats.inactive }}</div>
    </div>
    <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-5">
      <div class="text-sm font-medium text-base-content/50">Institutions</div>
      <div class="text-3xl font-bold mt-2 text-base-content">{{ stats.instCount }}</div>
    </div>
  </div>
</template>
