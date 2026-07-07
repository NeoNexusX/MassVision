<script setup lang="ts">
import DataSourceStep from '@/features/workspace/analysis/components/DataSourceStep.vue'
import PreprocessingPipelineStep from '@/features/workspace/analysis/components/PreprocessingPipelineStep.vue'
import AnalysisSummaryPanel from '@/features/workspace/analysis/components/AnalysisSummaryPanel.vue'
import { useAnalysisDatasets } from '@/features/workspace/analysis/composables/useAnalysisDatasets'
import { useAnalysisBuilder } from '@/features/workspace/analysis/composables/useAnalysisBuilder'

const {
  activeTab,
  datasetQuery,
  selectedDataset,
  uploadOpen,
  loading,
  error,
  datasets,
  meta,
  page,
  size,
  pagination,
  goToPage,
  selectDataset,
  onUploadSuccess,
  onUploadClose,
} = useAnalysisDatasets()

const {
  availableMethods,
  isFiltered,
  modeNotice,
  selectedMethods,
  methodParams,
  quotaStorage,
  submitting,
  canSubmit,
  pipelineSummary,
  msSettingsList,
  statusBadge,
  estimateTimeDisplay,
  buildParamKey,
  getParam,
  onIntInput,
  onFloatInput,
  onNumBlur,
  isSelected,
  toggleSingle,
  submit,
} = useAnalysisBuilder(selectedDataset)
</script>

<template>
  <div class="p-6 max-w-screen-2xl mx-auto">
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-5xl font-semibold">Create New Analysis</h1>
        <p class="text-xl text-base-content/60 mt-1">
          Configure preprocessing pipeline for MSI datasets
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div class="lg:col-span-3 space-y-6">
        <DataSourceStep
          v-model:active-tab="activeTab"
          v-model:dataset-query="datasetQuery"
          :upload-open="uploadOpen"
          :loading="loading"
          :error="error"
          :datasets="datasets"
          :selected-dataset="selectedDataset"
          :meta="meta"
          :page="page"
          :size="size"
          :pagination="pagination"
          @open-upload="uploadOpen = true"
          @upload-success="onUploadSuccess"
          @upload-close="onUploadClose"
          @select-dataset="selectDataset"
          @go-to-page="goToPage"
          @prev-page="goToPage(page - 1)"
          @next-page="goToPage(page + 1)"
        />

        <PreprocessingPipelineStep
          :available-methods="availableMethods"
          :is-filtered="isFiltered"
          :mode-notice="modeNotice"
          :selected-methods="selectedMethods"
          :method-params="methodParams"
          :build-param-key="buildParamKey"
          :get-param="getParam"
          :is-selected="isSelected"
          :toggle-single="toggleSingle"
          :on-int-input="onIntInput"
          :on-float-input="onFloatInput"
          :on-num-blur="onNumBlur"
        />

        <details v-if="false" class="bg-base-100 rounded-lg border border-base-200 p-6 shadow-sm">
          <summary class="text-3xl font-medium mb-2 list-none">Step 3: Annotation Settings</summary>
          <div class="mt-4 text-lg text-base-content/60">Annotation settings placeholder</div>
        </details>
      </div>

      <AnalysisSummaryPanel
        :status-badge="statusBadge"
        :pipeline-summary="pipelineSummary"
        :ms-settings-list="msSettingsList"
        :selected-dataset="selectedDataset"
        :estimate-time-display="estimateTimeDisplay"
        :quota-storage="quotaStorage"
        :can-submit="canSubmit"
        :submitting="submitting"
        @submit="submit"
      />
    </div>
  </div>
</template>
