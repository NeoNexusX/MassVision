<script setup lang="ts">
import { useDatasetDetail } from '@/features/datasets/composables/useDatasetDetail'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import InfoField from '@/features/datasets/components/InfoField.vue'

const {
  source,
  isStale,
  dataset,
  loading,
  isCopied,
  ticImageUrl,
  ticImageError,
  placeholderSvg,
  formatSize,
  formatString,
  copyHash,
  goBack,
  downloadCurrent,
  isPacking,
  makingPublic,
  showPublicConfirm,
  openPublicConfirm,
  cancelPublicConfirm,
  confirmSetPublic,
} = useDatasetDetail()
</script>

<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8 font-sans page-type">
    <div class="max-w-4xl mx-auto flex flex-col gap-6">
      <!-- 1. Top Navigation Area -->
      <div class="flex flex-col gap-2 mb-2">
        <button
          @click="goBack"
          class="btn btn-ghost btn-md sm:btn-lg text-[1em] text-base-content/70 hover:bg-base-300 rounded-lg shrink-0 self-start"
        >
          <svg-icon type="back" class="w-4 h-4 mr-1" />
          Back to {{ source === 'public' ? 'Public Datasets' : 'My Datasets' }}
        </button>
        <h1 class="page-title font-bold text-base-content tracking-tight">Dataset Overview</h1>
      </div>

      <!-- Skeleton Loading State -->
      <template v-if="loading">
        <div class="space-y-6">
          <!-- Primary Card Skeleton -->
          <div
            class="card bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6 flex flex-col md:flex-row gap-6"
          >
            <div class="skeleton w-24 h-24 rounded-xl shrink-0"></div>
            <div class="flex-1 space-y-4">
              <div class="skeleton h-8 w-3/4"></div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div class="skeleton h-10 w-full"></div>
                <div class="skeleton h-10 w-full"></div>
                <div class="skeleton h-10 w-full"></div>
                <div class="skeleton h-10 w-full"></div>
              </div>
            </div>
          </div>
          <!-- Metadata Cards Skeleton -->
          <div
            class="card bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6 space-y-4"
            v-for="i in 3"
            :key="i"
          >
            <div class="skeleton h-6 w-1/4 mb-4"></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div class="skeleton h-10 w-full md:w-32 lg:w-48"></div>
              <div class="skeleton h-10 w-full md:w-32 lg:w-48"></div>
              <div class="skeleton h-10 w-full md:w-32 lg:w-48"></div>
            </div>
          </div>
        </div>
      </template>

      <!-- Empty Data State -->
      <template v-else-if="!dataset">
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200 p-12 text-center">
          <svg-icon type="duplicate" class="h-12 w-12 mx-auto text-base-content/30 mb-4" />
          <h3 class="text-lg font-bold text-base-content">
            {{ isStale ? 'Session lost' : 'No data available' }}
          </h3>
          <p class="text-base-content/60 mt-1">
            {{ isStale ? 'Please navigate from My Datasets or Public Datasets to view details.' : 'The dataset information could not be found or has been deleted.' }}
          </p>
        </div>
      </template>

      <!-- Content State -->
      <template v-else>
        <!-- 2. Primary Info Card -->
        <div
          class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6 flex flex-col md:flex-row gap-6"
        >
          <div
            class="w-28 h-28 md:w-36 md:h-36 bg-base-200/60 rounded-2xl flex items-center justify-center flex-shrink-0 text-base-content/50 border border-base-200 overflow-hidden"
          >
            <img
              v-if="ticImageUrl && !ticImageError"
              :src="ticImageUrl"
              :alt="dataset.filename"
              class="w-full h-full object-contain"
              @error="ticImageError = true"
            />
            <div v-if="!ticImageUrl || ticImageError" class="w-full h-full" v-html="placeholderSvg"></div>
          </div>

          <div class="flex-1 w-full min-w-0 flex flex-col justify-center gap-2">
            <h2 class="text-xl md:text-2xl font-bold text-base-content truncate" :title="dataset.filename">
              {{ dataset.filename }}
            </h2>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-if="source === 'my' && !dataset.isPublic"
                @click="openPublicConfirm"
                class="btn btn-sm btn-outline btn-warning"
              >
                <svg-icon type="region" class="w-4 h-4" />
                Make Public
              </button>
              <button
                @click="downloadCurrent"
                class="btn btn-sm btn-primary"
                :disabled="isPacking(String(dataset?.id ?? ''))"
              >
                <span v-if="isPacking(String(dataset?.id ?? ''))" class="loading loading-spinner loading-xs"></span>
                <svg-icon v-else type="download" class="w-4 h-4" />
                {{ isPacking(String(dataset?.id ?? '')) ? 'Packing' : 'Download' }}
              </button>
              <div
                class="badge badge-soft border-0 font-medium px-3 py-3"
                :class="
                  dataset.status === 'completed'
                    ? 'badge-success bg-success/10 text-success'
                    : dataset.status === 'uploading'
                      ? 'badge-info bg-info/10 text-info'
                      : dataset.status === 'failed'
                        ? 'badge-error bg-error/10 text-error'
                        : 'badge-neutral bg-base-200 text-base-content/70'
                "
              >
                {{
                  dataset.status === 'completed'
                    ? 'Uploaded'
                    : dataset.status === 'uploading'
                      ? 'Uploading'
                      : dataset.status === 'failed'
                          ? 'Failed'
                          : dataset.status || '—'
                  }}
                </div>
              </div>
            </div>

          </div>

        <!-- 3. Biological & Sample Info -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            Biological &amp; Sample Info
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <InfoField label="Organism">{{ formatString(dataset?.organism) }}</InfoField>
            <InfoField label="Organism Part">{{ formatString(dataset?.organismPart) }}</InfoField>
            <InfoField label="Condition">{{ formatString(dataset?.condition) }}</InfoField>
            <InfoField label="Growth Conditions">{{
              formatString(dataset?.sampleGrowthConditions)
            }}</InfoField>
            <InfoField label="Stabilization">{{
              formatString(dataset?.sampleStabilization)
            }}</InfoField>
            <InfoField label="Tissue Modification">{{
              formatString(dataset?.tissueModification)
            }}</InfoField>
          </div>
        </div>

        <!-- 5. MSI Analysis Settings -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            MSI Analysis Settings
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <InfoField label="Polarity">{{ dataset?.polarity || '—' }}</InfoField>
            <InfoField label="Ionisation Source">{{ dataset?.ionSource || '—' }}</InfoField>
            <InfoField label="Analyzer">{{ dataset?.analyzer || '—' }}</InfoField>
            <InfoField label="Pixel Size">
              <template
                v-if="dataset?.pixelSizeHorizontal != null || dataset?.pixelSizeVertical != null"
              >
                {{ dataset?.pixelSizeHorizontal ?? '—' }} ×
                {{ dataset?.pixelSizeVertical ?? '—' }} μm
              </template>
              <template v-else>—</template>
            </InfoField>
            <InfoField label="Resolving Power">
              <template v-if="dataset?.mz != null || dataset?.resolvingPower != null">
                at <i>m/z</i> {{ dataset?.mz ?? '—' }}, {{ dataset?.resolvingPower ?? '—' }}
              </template>
              <template v-else>—</template>
            </InfoField>
            <InfoField label="Matrix">{{ formatString(dataset?.maldiMatrix) }}</InfoField>
            <InfoField label="Matrix Application">{{
              formatString(dataset?.maldiMatrixApplication)
            }}</InfoField>
            <InfoField label="Solvent">{{ formatString(dataset?.solvent) }}</InfoField>
          </div>
        </div>

        <!-- 6. File Information -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            File Information
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <InfoField label="File Type">{{ dataset?.fileType || '—' }}</InfoField>
            <InfoField label="Experiment">{{ dataset?.experimentType || '—' }}</InfoField>
            <InfoField label="Size">{{ formatSize(dataset?.sizeBytes) }}</InfoField>
            <InfoField label="Spectrum Mode">{{ dataset?.spectrumMode || '—' }}</InfoField>
            <InfoField label="Storage Mode">{{ dataset?.storageMode || '—' }}</InfoField>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >MD5 Hash</span
              >
              <div class="flex items-center gap-2">
                <span
                  class="text-base-content bg-base-200/50 px-2 py-1 rounded font-mono text-sm truncate max-w-[200px]"
                  >{{ dataset?.hashMd5 || '—' }}</span
                >
                <div
                  class="tooltip tooltip-top"
                  :data-tip="isCopied ? 'Copied!' : 'Copy Hash'"
                  v-if="dataset?.hashMd5"
                >
                  <button
                    @click="copyHash(dataset.hashMd5)"
                    class="btn btn-sm btn-ghost btn-square rounded-md hover:bg-base-200 shrink-0"
                  >
                    <svg-icon v-if="!isCopied" type="duplicate" class="w-4 h-4" />
                    <svg-icon v-else type="check" class="w-4 h-4 text-success" />
                  </button>
                </div>
              </div>
            </div>
            <InfoField label="Submitted By">{{
              dataset?.submitter || dataset?.raw?.first_uploaded_by || '—'
            }}</InfoField>
          </div>
        </div>
      </template>

      <!-- Make Public Confirmation Dialog -->
      <ConfirmDialog
        :open="showPublicConfirm"
        title="Make Dataset Public"
        message="This dataset will be moved to Public Data and become visible to other users. This action cannot be undone."
        confirm-label="Make Public"
        :danger="true"
        :loading="makingPublic"
        @confirm="confirmSetPublic"
        @cancel="cancelPublicConfirm"
      />
    </div>
  </div>
</template>

<style scoped>
/* Hidden inputs logic & drawer animations handled automatically by daisyUI */
</style>
