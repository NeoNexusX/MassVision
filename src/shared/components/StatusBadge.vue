<template>
  <span class="badge font-medium text-base rounded-md border-2 px-2 py-0.5 align-middle" :class="badgeClass">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  processing: { label: 'Running', cls: 'badge-info badge-soft bg-info/10 text-info border-info/30' },
  running: { label: 'Running', cls: 'badge-info badge-soft bg-info/10 text-info border-info/30' },
  completed: { label: 'Completed', cls: 'badge-success badge-soft bg-success/10 text-success border-success/30' },
  ok: { label: 'Completed', cls: 'badge-success badge-soft bg-success/10 text-success border-success/30' },
  success: { label: 'Completed', cls: 'badge-success badge-soft bg-success/10 text-success border-success/30' },
  failed: { label: 'Failed', cls: 'badge-error badge-soft bg-error/10 text-error border-error/30' },
  error: { label: 'Failed', cls: 'badge-error badge-soft bg-error/10 text-error border-error/30' },
  uploading: { label: 'Uploading', cls: 'badge-info badge-soft bg-info/10 text-info border-info/30' },
  active: { label: 'Active', cls: 'badge-success badge-soft bg-success/10 text-success border-success/30' },
  inactive: { label: 'Inactive', cls: 'badge-neutral badge-soft bg-base-200 text-base-content/60 border-base-300' },
}

const props = defineProps<{ status: string; compact?: boolean }>()

const entry = computed(() => STATUS_MAP[props.status.toLowerCase()])
const label = computed(() => entry.value?.label ?? props.status)
const badgeClass = computed(() => entry.value?.cls ?? 'badge-ghost')
</script>
