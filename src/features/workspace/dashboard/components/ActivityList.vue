<template>
  <div class="card p-4 border border-base-200 rounded-lg shadow-sm">
    <h3 class="text-lg font-medium mb-3">Recent Activity</h3>
    <ul class="space-y-3">
      <li v-for="a in activities" :key="a.id" class="flex items-start gap-3">
        <div class="w-2.5 h-2.5 rounded-full mt-2" :class="dotClass(a.type)"></div>
        <div>
          <div class="text-sm">{{ a.text }}</div>
          <div class="text-xs text-base-content/60 mt-1">{{ a.time }}</div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  activities?: Array<{ id: string; type?: string; text: string; time: string }>
}>()

const demo = [
  { id: 'a1', type: 'info', text: 'Task "Brain A Preprocessing" started', time: '12 minutes ago' },
  { id: 'a2', type: 'success', text: 'Result "Lung RMS Normalization" completed', time: 'Today' },
  { id: 'a3', type: 'error', text: 'Task "Baseline Correction" failed', time: 'Yesterday' },
]

const activities = props.activities && props.activities.length ? props.activities : demo

const dotClass = (t?: string) => {
  if (t === 'success') return 'bg-green-400'
  if (t === 'error') return 'bg-red-400'
  return 'bg-blue-400'
}
</script>
