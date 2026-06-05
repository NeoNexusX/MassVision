<template>
  <div class="card p-4 border border-base-200 rounded-lg shadow-sm">
    <h3 class="text-2xl font-medium mb-3">Recent Activity</h3>
    <ul v-if="activities && activities.length" class="space-y-3">
      <li v-for="a in activities" :key="a.id" class="flex items-start gap-3">
        <div class="w-2.5 h-2.5 rounded-full mt-1.5" :class="dotClass(a.type)"></div>
        <div>
          <div class="text-lg">{{ a.text }}</div>
          <div class="text-base text-base-content/60 mt-1">{{ a.time }}</div>
        </div>
      </li>
    </ul>
    <p v-else class="text-lg text-base-content/40 py-4 text-center">No recent activity</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  activities?: Array<{ id: string; type?: string; text: string; time: string }>
}>()

const dotClass = (t?: string) => {
  if (t === 'success') return 'bg-green-400 dark:bg-green-500'
  if (t === 'error') return 'bg-red-400 dark:bg-red-500'
  return 'bg-blue-400 dark:bg-blue-500'
}
</script>
