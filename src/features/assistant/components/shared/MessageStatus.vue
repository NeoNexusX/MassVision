<template>
  <!-- 消息状态行：中断 / 断流（附重试）/ 错误（附重试）。各聊天视图共用，
       保证五套视图的恢复入口与文案完全一致 -->
  <span v-if="message.interrupted" class="text-base-content/40 kawaru-text-75">{{
    $t('common.assistant.stopped')
  }}</span>
  <span v-if="message.truncated" class="text-warning/80 kawaru-text-75">{{
    $t('common.assistant.truncated')
  }}</span>
  <!-- 断流也要能重试（错误路径之外唯一的恢复入口，不能只留提示） -->
  <button
    v-if="message.truncated && !message.pending"
    class="btn btn-xs btn-ghost btn-warning mt-1"
    @click="$emit('retry')"
  >
    {{ $t('common.action.retry') }}
  </button>
  <div v-if="message.error" class="text-error">
    <div class="font-medium mb-1 kawaru-text-87">
      {{ $t('common.assistant.somethingWrong') }}
    </div>
    <div class="kawaru-text-87">{{ message.error }}</div>
    <button class="btn btn-xs btn-outline btn-error mt-2" @click="$emit('retry')">
      {{ $t('common.action.retry') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { UiChatItem } from '../../agenttypes/assistant'

defineProps<{ message: UiChatItem }>()

defineEmits<{ retry: [] }>()
</script>
