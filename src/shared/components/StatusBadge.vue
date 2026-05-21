<template>
  <span class="badge badge-sm font-medium border-0" :class="badgeClass">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  processing: { label: 'Running', cls: 'badge-info badge-soft bg-info/10 text-info' },
  running: { label: 'Running', cls: 'badge-info badge-soft bg-info/10 text-info' },
  queued: { label: 'Queued', cls: 'badge-warning badge-soft bg-warning/10 text-warning' },
  completed: { label: 'Completed', cls: 'badge-success badge-soft bg-success/10 text-success' },
  ok: { label: 'Completed', cls: 'badge-success badge-soft bg-success/10 text-success' },
  success: { label: 'Completed', cls: 'badge-success badge-soft bg-success/10 text-success' },
  failed: { label: 'Failed', cls: 'badge-error badge-soft bg-error/10 text-error' },
  error: { label: 'Failed', cls: 'badge-error badge-soft bg-error/10 text-error' },
  uploading: { label: 'Uploading', cls: 'badge-info badge-soft bg-info/10 text-info' },
  active: { label: 'Active', cls: 'badge-success badge-soft bg-success/10 text-success' },
  inactive: { label: 'Inactive', cls: 'badge-neutral badge-soft bg-base-200 text-base-content/60' },
}

const props = defineProps<{ status: string }>()

const entry = computed(() => STATUS_MAP[props.status.toLowerCase()])
const label = computed(() => entry.value?.label ?? props.status)
const badgeClass = computed(() => entry.value?.cls ?? 'badge-ghost')
</script>
