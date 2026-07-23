<script setup lang="ts">
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'

/** Explore / Raw-Convert 确认框（MyDatasets 与 PublicDatasets 共用） */
defineProps<{
  open: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <ConfirmDialog
    :open="open"
    title="Prepare Visualization"
    confirm-label="Generate"
    :loading="loading"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <span class="block mb-2">This dataset hasn't been prepared for visualization yet. We'll generate an optimized view so you can explore it interactively. This may take a while.</span>
    <a
      href="/docs/guide/view-data"
      target="_blank"
      rel="noopener noreferrer"
      class="link link-primary text-sm"
    >
      Learn more about viewing data
    </a>
  </ConfirmDialog>
</template>
