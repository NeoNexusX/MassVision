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
:title="$t('datasets.explore.title')"
    :confirm-label="$t('datasets.explore.confirm')"
    :loading="loading"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <span class="block mb-2">{{ $t('datasets.explore.body') }}</span>
    <a
      href="/docs/guide/view-data"
      target="_blank"
      rel="noopener noreferrer"
      class="link link-primary kawaru-text-87"
    >
      {{ $t('datasets.explore.learnMore') }}
    </a>
  </ConfirmDialog>
</template>
