<script setup lang="ts">
import { computed } from 'vue'
import { formatBytes } from '@/shared/utils/format'
import { ETA_CALCULATING, type PartRetryInfo, type ImzmlMilestone } from '@/features/upload/utils/imzmlHelper'
import { t } from '@/i18n'

const props = defineProps<{
  message: string
  progress: number
  /** 端到端速度。压缩与上传是它的两个拆解项，分母各自更窄 */
  speed?: string
  eta?: string
  compressSpeed?: string
  uploadSpeed?: string
  bottleneck?: 'upload' | 'compress' | null
  /**
   * imzML 段已全部落到 OSS。触发后常驻 —— ibd 段往往要跑很久，
   * 「前半程已经安全」这件事在整个后半程都是有用的上下文。
   */
  imzmlMilestone?: ImzmlMilestone | null
  /** 已确认落到 OSS 的源字节 / 源文件总大小 */
  doneSourceBytes?: number
  totalSourceBytes?: number
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

const bottleneckLabel = computed(() =>
  props.bottleneck === 'upload'
    ? t('upload.progress.uploadBound')
    : props.bottleneck === 'compress'
      ? t('upload.progress.compressBound')
      : '',
)

// formatETA 在压缩 worker 里也会跑，拿不到 i18n，只能返回固定的英文哨兵值，在这里换成译文
const etaText = computed(() =>
  props.eta === ETA_CALCULATING ? t('upload.progress.calculating') : props.eta,
)

/** 拆解行：两个速度都还没有样本时整行不显示，避免半空的一行 */
const showBreakdown = computed(() => !!props.compressSpeed || !!props.uploadSpeed)

const transferred = computed(() =>
  props.totalSourceBytes
    ? `${formatBytes(props.doneSourceBytes ?? 0)} / ${formatBytes(props.totalSourceBytes)}`
    : '',
)

/**
 * 里程碑的速度小结。两个速率都可能缺样本（续传时 imzML 段整段被跳过，
 * 就没有上传速率可言），全缺时只报「已完成」这个事实。
 */
const milestoneSpeeds = computed(() => {
  const m = props.imzmlMilestone
  if (!m) return ''
  const parts = [
    m.compressSpeedStr && t('upload.progress.compressedAt', { speed: m.compressSpeedStr }),
    m.uploadSpeedStr && t('upload.progress.uploadedAt', { speed: m.uploadSpeedStr }),
  ].filter(Boolean)
  return parts.join(t('upload.progress.separator'))
})
</script>

<template>
  <div class="flex flex-col items-center gap-4 py-8">
    <div class="w-full">
      <div class="flex justify-between kawaru-text-112 mb-2 font-medium">
        <span class="text-base-content/80">{{ message }}</span>
        <span class="text-primary">{{ progress }}%</span>
      </div>
      <progress class="progress progress-primary w-full h-3" :value="progress" max="100"></progress>
      <div
        v-if="speed || eta"
        class="flex justify-between items-center w-full mt-2 kawaru-text-100 text-base-content/60 bg-base-200/50 py-1.5 px-3 rounded"
      >
        <div v-if="speed" class="flex items-center">⚡ {{ speed }}</div>
        <div v-if="eta" class="flex items-center">⏱️ {{ $t('upload.progress.eta', { eta: etaText }) }}</div>
      </div>

      <!--
        端到端速度的拆解。两个数并排再标出谁让对方等得更久，用户才能判断
        慢在本机还是慢在网络。三个速度的分子都是源字节，可以直接横向比较。
      -->
      <div
        v-if="showBreakdown"
        class="flex flex-wrap items-center gap-x-4 gap-y-1 w-full mt-1.5 px-3 kawaru-text-87 text-base-content/50"
      >
        <span v-if="compressSpeed">{{ $t('upload.progress.compress', { speed: compressSpeed }) }}</span>
        <span v-if="uploadSpeed">{{ $t('upload.progress.upload', { speed: uploadSpeed }) }}</span>
        <span v-if="bottleneckLabel" class="text-base-content/40">({{ bottleneckLabel }})</span>
        <span v-if="transferred" class="ml-auto">{{ transferred }}</span>
      </div>

      <!--
        imzML 段落地的里程碑。常驻而不是一闪而过的 toast：ibd 段可能要跑几十
        分钟，这条是用户在那段时间里唯一能确认「前半程没白传」的依据。

        这里的上传速率是线路字节口径（见 ImzmlMilestone），与上面那行源字节
        口径的 Upload 不是一个数，所以措辞上不并排、不诱导横向比较。
      -->
      <div
        v-if="imzmlMilestone"
        class="mt-2 w-full rounded border border-success/40 bg-success/10 px-3 py-2 kawaru-text-87 text-success"
      >
        <p class="font-medium">{{ $t('upload.progress.milestone') }}</p>
        <p v-if="milestoneSpeeds" class="mt-0.5 opacity-75">{{ milestoneSpeeds }}</p>
      </div>

      <!--
        分片重试告警。没有这一块的时候，一次重试意味着进度条最长冻住数分钟
        且零反馈 —— 用户只能猜是不是卡死了。
      -->
      <div
        v-if="retry && !aborting"
        class="mt-2 w-full rounded border border-warning/40 bg-warning/10 px-3 py-2 kawaru-text-87 text-warning"
      >
        <p class="font-medium">
          {{
            $t('upload.progress.retry', {
              part: retry.partNo,
              attempt: retry.attempt,
              max: retry.maxAttempts,
              seconds: Math.round(retry.nextRetryInMs / 1000),
            })
          }}
        </p>
        <p class="mt-0.5 break-all opacity-75">{{ retry.reason }}</p>
      </div>
    </div>

    <div class="w-full flex justify-end mt-4">
      <button class="btn btn-outline btn-error btn-sm kawaru-text-75" :disabled="aborting" @click="$emit('abort')">
        {{ aborting ? $t('upload.progress.aborting') : $t('upload.progress.abort') }}
      </button>
    </div>
  </div>
</template>
