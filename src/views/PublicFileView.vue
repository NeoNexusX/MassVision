<template>
  <div class="min-h-screen bg-base-200">
    <div class="max-w-4xl mx-auto p-4 md:p-8 kawaru-text-100">
      <!-- Loading -->
      <div v-if="loading" class="animate-pulse flex flex-col gap-6">
        <div class="h-16 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
        <div class="h-12 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
        <div class="h-64 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
      </div>

      <!-- 错误态：链接失效 / 文件不可用（后端对不存在 / 未公开 / 非 completed
           一律 404，不区分原因，前端不尝试细分） -->
      <div
        v-else-if="error || !dataset"
        class="p-12 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300 text-center"
      >
        <SvgIcon type="document-text" class="h-12 w-12 mx-auto text-base-content/30 mb-4" />
        <h3 class="kawaru-text-112 font-bold text-base-content">
          {{ $t('datasets.public.notFound') }}
        </h3>
        <p class="mt-2 text-base-content/60">
          {{ $t('datasets.public.notFoundDesc') }}
        </p>
        <router-link to="/" class="btn btn-primary mt-6 kawaru-text-100">{{
          $t('datasets.public.backHome')
        }}</router-link>
      </div>

      <template v-else>
        <!-- 页头：公开标识 + 文件名 + 下载 -->
        <div class="mb-6">
          <span
            class="inline-flex items-center gap-1.5 badge badge-sm font-medium border border-success/30 bg-success/10 text-success mb-2 kawaru-text-75"
          >
            <SvgIcon type="region" class="w-[0.9em] h-[0.9em]" />
            {{ $t('datasets.public.badge') }}
          </span>
          <h1
            class="kawaru-text-page-title leading-[1.15] font-bold text-base-content truncate"
            :title="dataset.filename"
          >
            {{ dataset.filename }}
          </h1>
          <div class="mt-3">
            <button
              @click="downloadCurrent"
              class="btn btn-primary h-10 min-h-10 px-4 kawaru-text-95"
              :disabled="isPacking(downloadId)"
            >
              <span v-if="isPacking(downloadId)" class="loading loading-spinner loading-xs"></span>
              <SvgIcon v-else type="download" class="w-4 h-4" />
              {{
                isPacking(downloadId) ? $t('datasets.card.packing') : $t('common.action.download')
              }}
            </button>
          </div>
        </div>

        <!-- 统计条 -->
        <div
          class="flex flex-wrap items-center gap-x-6 gap-y-2 bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm border border-base-300 px-4 py-3 mb-6 kawaru-text-87 text-base-content/70"
        >
          <span class="inline-flex items-center gap-1.5">
            <SvgIcon type="folder" class="w-[1.1em] h-[1.1em]" />
            {{ formatSize(dataset.sizeBytes) }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <SvgIcon type="user" class="w-[1.1em] h-[1.1em]" />
            {{ dataset.submitter || '—' }}
          </span>
          <span v-if="uploadedDate" class="ml-auto whitespace-nowrap">
            {{ $t('datasets.card.submitTime') }}: {{ uploadedDate }}
          </span>
        </div>

        <!-- Biological & Sample Info -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="kawaru-text-112 font-bold text-base-content mb-4 flex items-center gap-2">
            {{ $t('datasets.overview.sampleInfo') }}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <InfoField :label="$t('common.meta.organism')">{{
              formatString(dataset.organism)
            }}</InfoField>
            <InfoField :label="$t('common.meta.organismPart')">{{
              formatString(dataset.organismPart)
            }}</InfoField>
            <InfoField :label="$t('common.meta.condition')">{{
              formatString(dataset.condition)
            }}</InfoField>
            <InfoField :label="$t('common.meta.growthConditions')">{{
              formatString(dataset.sampleGrowthConditions)
            }}</InfoField>
            <InfoField :label="$t('datasets.field.stabilization')">{{
              formatString(dataset.sampleStabilization)
            }}</InfoField>
            <InfoField :label="$t('common.meta.tissueModification')">{{
              formatString(dataset.tissueModification)
            }}</InfoField>
          </div>
        </div>

        <!-- MSI Analysis Settings -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6 mt-6">
          <h3 class="kawaru-text-112 font-bold text-base-content mb-4 flex items-center gap-2">
            {{ $t('datasets.overview.msiSettings') }}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <InfoField :label="$t('common.meta.polarity')">{{
              vocabLabel(dataset.polarity) || '—'
            }}</InfoField>
            <InfoField :label="$t('common.meta.ionisationSource')">{{
              vocabLabel(dataset.ionSource) || '—'
            }}</InfoField>
            <InfoField :label="$t('common.meta.analyzer')">{{
              vocabLabel(dataset.analyzer) || '—'
            }}</InfoField>
            <InfoField :label="$t('datasets.field.matrix')">{{
              formatString(dataset.maldiMatrix)
            }}</InfoField>
            <InfoField :label="$t('datasets.field.matrixApplication')">{{
              formatString(dataset.maldiMatrixApplication)
            }}</InfoField>
            <InfoField :label="$t('common.meta.solvent')">{{
              formatString(dataset.solvent)
            }}</InfoField>
          </div>
        </div>

        <!-- File Information -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6 mt-6">
          <h3 class="kawaru-text-112 font-bold text-base-content mb-4 flex items-center gap-2">
            {{ $t('datasets.overview.fileInfo') }}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <InfoField :label="$t('datasets.field.experimentType')">{{
              vocabLabel(dataset.experimentType) || '—'
            }}</InfoField>
            <InfoField :label="$t('common.meta.spectrumMode')">{{
              dataset.spectrumMode || '—'
            }}</InfoField>
            <InfoField :label="$t('common.meta.storageMode')">{{
              dataset.storageMode || '—'
            }}</InfoField>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import InfoField from '@/features/datasets/components/InfoField.vue'
import { getPublicFile } from '@/features/datasets/api/datasetApi'
import { mapItemToDataset } from '@/features/datasets/mappers/datasetMapper'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { useRequireAuth } from '@/shared/composables/useRequireAuth'
import { isVocabValue, vocabLabel } from '@/features/datasets/constants/vocabLabels'
import { formatBytes, formatDate } from '@/shared/utils/format'
import { t } from '@/i18n'
import type { File } from '@/features/datasets/types/dataset'

const route = useRoute()

// 响应为 FilePublic（含 file_id 与 public_id 两个标识），经 mapper 归一成 File 复用详情页字段
const dataset = ref<File | null>(null)
const loading = ref(false)
const error = ref('')

const publicId = computed(() => String(route.params.publicId))

async function fetch() {
  loading.value = true
  error.value = ''
  try {
    const body = await getPublicFile(publicId.value)
    dataset.value = body ? mapItemToDataset(body) : null
  } catch {
    dataset.value = null
    error.value = t('datasets.public.notFound')
  } finally {
    loading.value = false
  }
}

const uploadedDate = computed(() => formatDate(dataset.value?.submitTime))

// 公开页可匿名浏览，但下载统一走鉴权端点（与公开集合页同一方案：
// requireAuth 携带回跳地址跳登录，登录后回到本页继续下载）
const { handleDownloadRaw, isPacking } = useDownloadProgress()
const { requireAuth } = useRequireAuth(() => route.fullPath)

const downloadId = computed(() => dataset.value?.publicId ?? '')

function downloadCurrent() {
  if (!downloadId.value) return
  if (!requireAuth()) return
  handleDownloadRaw(downloadId.value)
}

// 词表值按译文显示，自填值沿用首字母大写（与 Dataset Overview 的 formatString 一致）
function formatString(val?: string) {
  if (!val) return '—'
  if (isVocabValue(val)) return vocabLabel(val)
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
}

const formatSize = formatBytes

watch(publicId, fetch)
onMounted(fetch)
</script>

<style scoped>
/* Layout handled by Tailwind classes */
</style>
