<script setup lang="ts">
import { useRouter } from 'vue-router'
import DataSourceStep from '@/features/workspace/analysis/components/DataSourceStep.vue'
import PreprocessingPipelineStep from '@/features/workspace/analysis/components/PreprocessingPipelineStep.vue'
import AnalysisSummaryPanel from '@/features/workspace/analysis/components/AnalysisSummaryPanel.vue'
import { useAnalysisDatasets } from '@/features/workspace/analysis/composables/useAnalysisDatasets'
import { useAnalysisBuilder } from '@/features/workspace/analysis/composables/useAnalysisBuilder'

const router = useRouter()

// Jump to My Datasets and auto-open the upload modal
const goToUploadDataset = () => {
  router.push({ name: 'MyDatasets', query: { upload: '1' } })
}

const {
  activeTab,
  datasetQuery,
  selectedDataset,
  loading,
  error,
  datasets,
  meta,
  page,
  pagination,
  goToPage,
  selectDataset,
} = useAnalysisDatasets()

const {
  availableMethods,
  modeNotice,
  methodParams,
  submitting,
  canSubmit,
  pipelineSummary,
  msSettingsList,
  statusBadge,
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
  <div class="p-4 sm:p-6 max-w-screen-2xl mx-auto page-type">
    <div class="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
      <div>
        <h1 class="page-title font-semibold">Create New Analysis</h1>
        <p class="page-subtitle text-base-content/60 mt-1">
          Configure preprocessing pipeline for MSI datasets
        </p>
      </div>
      <button
        class="btn btn-primary shrink-0 w-full sm:w-auto"
        @click="goToUploadDataset"
        title="Go to My Datasets to upload a new dataset"
      >
        <SvgIcon type="upload" class="w-5 h-5" />
        Upload New Dataset
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div class="lg:col-span-3 space-y-6">
        <DataSourceStep
          v-model:active-tab="activeTab"
          v-model:dataset-query="datasetQuery"
          :loading="loading"
          :error="error"
          :datasets="datasets"
          :selected-dataset="selectedDataset"
          :meta="meta"
          :pagination="pagination"
          @select-dataset="selectDataset"
          @go-to-page="goToPage"
          @prev-page="goToPage(page - 1)"
          @next-page="goToPage(page + 1)"
        />

        <PreprocessingPipelineStep
          :available-methods="availableMethods"
          :mode-notice="modeNotice"
          :method-params="methodParams"
          :build-param-key="buildParamKey"
          :get-param="getParam"
          :is-selected="isSelected"
          :toggle-single="toggleSingle"
          :on-int-input="onIntInput"
          :on-float-input="onFloatInput"
          :on-num-blur="onNumBlur"
        />
      </div>

      <AnalysisSummaryPanel
        :status-badge="statusBadge"
        :pipeline-summary="pipelineSummary"
        :ms-settings-list="msSettingsList"
        :selected-dataset="selectedDataset"
        :can-submit="canSubmit"
        :submitting="submitting"
        @submit="submit"
      />
    </div>
  </div>
</template>
