<script setup lang="ts">
import { I18nT } from 'vue-i18n'

defineProps<{
  datasetName: string
  /** 上次上传用的源文件，提示用户该选哪两个 */
  expectedFiles: { imzmlName: string; ibdName: string } | null
  /** 已选到匹配的文件对，可以续传了 */
  canResume: boolean
  /** 尚不能续传时的说明 */
  hint: string
}>()

defineEmits<{
  (e: 'resume'): void
  (e: 'discard'): void
}>()
</script>

<!--
  注意：这里刻意不用 daisyUI 的 .alert。
  .alert 是 `display:grid; grid-auto-flow:column`，布局契约是「图标 + 一块内容」两列；
  超过两个直接子元素时多出来的会落进隐式列被压成一个字符宽。本组件是多段落卡片，
  所以自己用 flex 布局，只借用配色。
-->
<template>
  <div
    class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950"
  >
    <div class="flex items-start gap-2.5">
      <SvgIcon type="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />

      <!-- min-w-0 让长文件名在这里换行，而不是把整个卡片撑开 -->
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <p class="kawaru-text-100 font-semibold text-blue-800 dark:text-blue-300">
          {{ $t('upload.resume.title') }}
        </p>

        <I18nT
          keypath="upload.resume.body"
          tag="p"
          scope="global"
          class="kawaru-text-100 leading-relaxed text-blue-700 dark:text-blue-300"
        >
          <template #name><span class="font-semibold break-all">{{ datasetName }}</span></template>
        </I18nT>

        <div
          v-if="expectedFiles"
          class="rounded border border-blue-200/70 bg-blue-100/50 px-2.5 py-1.5 dark:border-blue-800/70 dark:bg-blue-900/40"
        >
          <p class="mb-1 kawaru-text-87 font-medium text-blue-700/70 dark:text-blue-300/70">
            {{ $t('upload.resume.requiredFiles') }}
          </p>
          <ul class="flex flex-col gap-0.5 font-mono kawaru-text-87 text-blue-800 dark:text-blue-200">
            <li class="break-all">{{ expectedFiles.imzmlName }}</li>
            <li class="break-all">{{ expectedFiles.ibdName }}</li>
          </ul>
        </div>

        <p v-if="hint" class="kawaru-text-87 text-amber-700 dark:text-amber-400">{{ hint }}</p>

        <div class="mt-1 flex flex-wrap gap-2">
          <button
            class="btn btn-sm border-none bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:text-white/70 dark:disabled:bg-blue-900 kawaru-text-75"
            :disabled="!canResume"
            @click="$emit('resume')"
          >
            {{ $t('upload.resume.resume') }}
          </button>
          <button
            class="btn btn-sm btn-ghost text-blue-600 dark:text-blue-400 kawaru-text-75"
            @click="$emit('discard')"
          >
            {{ $t('common.action.discard') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
