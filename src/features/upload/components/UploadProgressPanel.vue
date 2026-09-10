<script setup lang="ts">
import type { PartRetryInfo } from '@/features/upload/utils/imzmlHelper'

defineProps<{
  message: string
  progress: number
  speed?: string
  eta?: string
  /** 分片重试中（非致命）。null 表示已恢复 */
  retry?: PartRetryInfo | null
  /**
   * 已发出中止。中止是同步的，这个态只存在一个 tick —— 它的作用是防连点，
   * 不是一个可等待的阶段。中止后的说明由 select 阶段的 uploadError 承担。
   */
  aborting?: boolean
}>()

defineEmits<{
  (e: 'abort'): void
}>()
</script>

<template>
  <div class="flex flex-col items-center gap-4 py-8">
    <div class="w-full">
      <div class="flex justify-between text-lg mb-2 font-medium">
        <span class="text-base-content/80">{{ message }}</span>
        <span class="text-primary">{{ progress }}%</span>
      </div>
      <progress class="progress progress-primary w-full h-3" :value="progress" max="100"></progress>
      <div
        v-if="speed || eta"
        class="flex justify-between items-center w-full mt-2 text-base text-base-content/60 bg-base-200/50 py-1.5 px-3 rounded"
      >
        <div v-if="speed" class="flex items-center">⚡ {{ speed }}</div>
        <div v-if="eta" class="flex items-center">⏱️ ETA: {{ eta }}</div>
      </div>

      <!--
        分片重试告警。没有这一块的时候，一次重试意味着进度条最长冻住数分钟
        且零反馈 —— 用户只能猜是不是卡死了。
      -->
      <div
        v-if="retry && !aborting"
        class="mt-2 w-full rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
      >
        <p class="font-medium">
          Part {{ retry.partNo }} failed — retrying {{ retry.attempt }}/{{ retry.maxAttempts }} in
          {{ Math.round(retry.nextRetryInMs / 1000) }}s
        </p>
        <p class="mt-0.5 break-all opacity-75">{{ retry.reason }}</p>
      </div>

    </div>

    <div class="w-full flex justify-end mt-4">
      <button class="btn btn-outline btn-error btn-sm" :disabled="aborting" @click="$emit('abort')">
        {{ aborting ? 'Aborting…' : 'Abort Upload' }}
      </button>
    </div>
  </div>
</template>
