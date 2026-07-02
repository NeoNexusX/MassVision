<script setup lang="ts">
import { formatBytes } from '@/shared/utils/format'

defineProps<{
  statusBadge: { text: string; cls: string }
  pipelineSummary: Array<{ key: string; title: string; method: string; present: boolean }>
  msSettingsList: Array<{ key: string; label: string; value: string }>
  selectedDataset: any
  estimateTimeDisplay: string
  quotaStorage: string
  canSubmit: boolean
  submitting: boolean
}>()

const emit = defineEmits<{
  (e: 'submit'): void
}>()
</script>

<template>
  <aside class="lg:col-span-1">
    <div class="sticky top-6">
      <div class="rounded-lg border border-base-200 bg-base-100 shadow-sm overflow-hidden">
        <div class="flex items-center justify-between px-5 pt-5 pb-3">
          <div class="text-3xl font-semibold">Analysis Summary</div>
          <span :class="statusBadge.cls + ' text-base'">{{ statusBadge.text }}</span>
        </div>

        <div class="border-t border-base-200/70 px-5 py-4">
          <div class="text-lg font-medium text-base-content/60 mb-2">Preprocessing</div>
          <ul class="space-y-3">
            <li v-for="item in pipelineSummary" :key="item.key">
              <div class="text-lg font-medium text-base-content">{{ item.title }}</div>
              <div class="flex items-center justify-between mt-0.5 pl-3">
                <span class="text-lg text-base-content/60">{{
                  item.present ? item.method : '—'
                }}</span>
                <span v-if="item.present" class="text-base text-blue-500 dark:text-blue-400">✓</span>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="msSettingsList.length" class="border-t border-base-200/70 px-5 py-4">
          <div class="text-lg font-medium text-base-content/60 mb-2">Dataset metadata</div>
          <ul class="space-y-1.5">
            <li
              v-for="setting in msSettingsList"
              :key="setting.key"
              class="flex items-baseline justify-between gap-3"
            >
              <span class="text-lg font-medium text-base-content shrink-0">{{
                setting.label
              }}</span>
              <span class="text-lg text-base-content/60 text-right min-w-0 break-all">{{
                setting.value
              }}</span>
            </li>
          </ul>
        </div>

        <div class="border-t border-base-200/70 px-5 py-4">
          <div class="text-lg font-medium text-base-content/60 mb-2">Selected dataset</div>
          <div v-if="selectedDataset">
            <div class="text-lg font-medium text-base-content break-all leading-snug">
              {{ selectedDataset.name }}
            </div>
            <div class="text-base text-base-content/50 mt-1">
              {{ formatBytes(selectedDataset.sizeBytes) }}
            </div>
          </div>
          <div v-else class="text-lg text-base-content/40">No dataset selected</div>
        </div>

        <!-- TODO: Est. time 功能暂未实现，先隐藏 -->
        <div v-if="false" class="border-t border-base-200/70 px-5 py-4">
          <div class="text-lg font-medium text-base-content/60 mb-2">Est. time</div>
          <div class="text-lg font-medium text-base-content">{{ estimateTimeDisplay }}</div>
          <div class="text-base text-base-content/50 mt-2 space-y-1">
            <div class="flex items-center justify-between">
              <span>Storage</span>
              <span class="text-base-content font-medium">{{ quotaStorage }}</span>
            </div>
          </div>
        </div>

        <div class="border-t border-base-200/70 px-5 py-4">
          <button
            :class="[
              'btn btn-primary w-full h-12 text-xl font-semibold',
              !canSubmit || submitting ? 'opacity-60 cursor-not-allowed' : '',
            ]"
            @click="emit('submit')"
            :disabled="!canSubmit || submitting"
          >
            <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
            {{ submitting ? 'Starting...' : 'Start Analysis' }}
          </button>
          <div v-if="!canSubmit" class="text-base text-base-content/50 mt-2 text-center">
            Select dataset and configure pipeline first
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
