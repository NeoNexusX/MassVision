<script setup lang="ts">
import { useDatasetDetail } from '@/features/datasets/composables/useDatasetDetail'

const {
  route,
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
} = useDatasetDetail()
</script>

<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8 font-sans">
    <div class="max-w-4xl mx-auto flex flex-col gap-6">
      <!-- 1. Top Navigation Area -->
      <div class="flex flex-col sm:flex-row sm:items-start gap-4 mb-2">
        <button
          @click="goBack"
          class="btn btn-sm btn-ghost text-base-content/70 hover:bg-base-300 rounded-lg shrink-0 mt-1"
        >
          <svg-icon type="back" class="w-4 h-4 mr-1" />
          Back to {{ route.query.from === 'public' ? 'Public Datasets' : 'My Datasets' }}
        </button>
        <div class="ml-1 sm:ml-4">
          <h1 class="text-3xl font-bold text-base-content tracking-tight">Dataset Overview</h1>
          <p class="text-base-content/60 mt-1">View detailed dataset information</p>
        </div>
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
          <h3 class="text-lg font-bold text-base-content">No data available</h3>
          <p class="text-base-content/60 mt-1">
            The dataset information could not be found or has been deleted.
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
            class="w-20 h-20 md:w-24 md:h-24 bg-base-200/60 rounded-2xl flex items-center justify-center flex-shrink-0 text-base-content/50 border border-base-200 overflow-hidden"
          >
            <img
              v-if="ticImageUrl && !ticImageError"
              :src="ticImageUrl"
              :alt="dataset.filename"
              class="w-full h-full object-cover"
              @error="ticImageError = true"
            />
            <div v-if="!ticImageUrl || ticImageError" class="w-full h-full" v-html="placeholderSvg"></div>
          </div>

          <div class="flex-1 w-full min-w-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <h2 class="text-2xl md:text-3xl font-bold text-base-content truncate" :title="dataset.filename">
                {{ dataset.filename }}
              </h2>
              <div class="flex items-center gap-2 shrink-0">
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
                  class="badge badge-soft shrink-0 border-0 font-medium px-3 py-3"
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

            <div class="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6">
              <div class="flex flex-col">
                <span class="text-xs font-semibold tracking-wider text-base-content/40"
                  >File Type</span
                >
                <span class="font-medium mt-1 text-base-content">{{
                  dataset?.fileType || '—'
                }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold tracking-wider text-base-content/40"
                  >Experiment</span
                >
                <span class="font-medium mt-1 text-base-content">{{
                  dataset?.experimentType || '—'
                }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold tracking-wider text-base-content/40">Size</span>
                <span class="font-medium mt-1 text-base-content">{{
                  formatSize(dataset?.sizeBytes)
                }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold tracking-wider text-base-content/40"
                  >Spectrum Mode</span
                >
                <span class="font-medium mt-1 text-base-content">{{
                  dataset?.spectrumMode || '—'
                }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold tracking-wider text-base-content/40"
                  >Storage Mode</span
                >
                <span class="font-medium mt-1 text-base-content">{{
                  dataset?.storageMode || '—'
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Biological Metadata -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            Biological Metadata
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Organism</span
              >
              <span class="text-base-content break-words">{{
                formatString(dataset?.organism)
              }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Organism Part</span
              >
              <span class="text-base-content break-words">{{
                formatString(dataset?.organismPart)
              }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Condition</span
              >
              <span class="text-base-content break-words">{{
                formatString(dataset?.condition)
              }}</span>
            </div>
          </div>
        </div>

        <!-- 4. Sample Processing -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            Sample Processing
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Growth Conditions</span
              >
              <span class="text-base-content break-words">{{
                formatString(dataset?.sampleGrowthConditions)
              }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Stabilization</span
              >
              <span class="text-base-content break-words">{{
                formatString(dataset?.sampleStabilization)
              }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Tissue Modification</span
              >
              <span class="text-base-content break-words">{{
                formatString(dataset?.tissueModification)
              }}</span>
            </div>
          </div>
        </div>

        <!-- 5. MALDI Related Info -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            MALDI Information
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Matrix</span
              >
              <span class="text-base-content break-words">{{
                formatString(dataset?.maldiMatrix)
              }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Matrix Application</span
              >
              <span class="text-base-content break-words">{{
                formatString(dataset?.maldiMatrixApplication)
              }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Solvent</span
              >
              <span class="text-base-content break-words">{{
                formatString(dataset?.solvent)
              }}</span>
            </div>
          </div>
        </div>

        <!-- 5b. MS Analysis Settings -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            MS Analysis Settings
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Polarity</span
              >
              <span class="text-base-content break-words">{{ dataset?.polarity || '—' }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Ionisation Source</span
              >
              <span class="text-base-content break-words">{{ dataset?.ionSource || '—' }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Analyzer</span
              >
              <span class="text-base-content break-words">{{ dataset?.analyzer || '—' }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Pixel Size</span
              >
              <span class="text-base-content break-words">
                <template
                  v-if="dataset?.pixelSizeHorizontal != null || dataset?.pixelSizeVertical != null"
                >
                  {{ dataset?.pixelSizeHorizontal ?? '—' }} ×
                  {{ dataset?.pixelSizeVertical ?? '—' }} μm
                </template>
                <template v-else>—</template>
              </span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Resolving Power</span
              >
              <span class="text-base-content break-words">
                <template v-if="dataset?.mz != null || dataset?.resolvingPower != null">
                  at m/z {{ dataset?.mz ?? '—' }}, {{ dataset?.resolvingPower ?? '—' }}
                </template>
                <template v-else>—</template>
              </span>
            </div>
          </div>
        </div>

        <!-- 6. Technical Info -->
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-6">
          <h3 class="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
            Technical Details
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col max-w-full">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >MD5 Hash</span
              >
              <div class="flex items-center gap-2 max-w-full">
                <span
                  class="text-base-content bg-base-200/50 px-2 py-1 rounded font-mono text-sm truncate flex-1 md:max-w-md"
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
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Storage Type</span
              >
              <span class="text-base-content break-words">{{ dataset?.storageType || '—' }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Total Size</span
              >
              <span class="text-base-content break-words">{{
                formatSize(dataset?.sizeBytes)
              }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[13px] font-semibold tracking-wider text-base-content/40 mb-1"
                >Submitted By</span
              >
              <span class="text-base-content break-words">{{
                dataset?.submitter || dataset?.raw?.first_uploaded_by || '—'
              }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Hidden inputs logic & drawer animations handled automatically by daisyUI */
</style>
