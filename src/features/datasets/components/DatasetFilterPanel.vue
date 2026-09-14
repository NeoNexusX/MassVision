<script setup lang="ts">
import { computed, ref } from 'vue'
import SelectWithOther from '@/shared/components/SelectWithOther.vue'
import {
  CONDITIONS,
  EXPERIMENT_TYPES,
  MALDI_MATRICES,
  MALDI_MATRIX_APPLICATIONS,
  ORGANISMS,
  ORGANISM_PARTS,
  SAMPLE_STABILIZATIONS,
  SOLVENTS,
  TISSUE_MODIFICATIONS,
} from '@/features/datasets/constants/datasetMetadata'
import { vocabLabel } from '@/features/datasets/constants/vocabLabels'
import { t } from '@/i18n'

const emit = defineEmits<{
  (e: 'apply', payload: Record<string, string>): void
  (e: 'close'): void
}>()

interface FilterField {
  key: string
  label: string
  type: 'text' | 'select'
  placeholder?: string
  options?: readonly string[]
}

// 字段 key 与选项值是发给后端的筛选参数（英文）；label / placeholder 随界面语言变化
const fields = computed<FilterField[]>(() => [
  { key: 'filename', label: t('datasets.field.filename'), type: 'text', placeholder: t('datasets.field.filename') },
  { key: 'experiment_type', label: t('datasets.field.experimentType'), type: 'select', options: EXPERIMENT_TYPES },
  { key: 'username', label: t('common.field.username'), type: 'text', placeholder: t('datasets.filter.submitterPlaceholder') },
  { key: 'organism', label: t('common.meta.organism'), type: 'select', options: ORGANISMS },
  { key: 'organism_part', label: t('common.meta.organismPart'), type: 'select', options: ORGANISM_PARTS },
  { key: 'condition', label: t('datasets.field.condition'), type: 'select', options: CONDITIONS },
  { key: 'sample_stabilization', label: t('common.meta.sampleStabilization'), type: 'select', options: SAMPLE_STABILIZATIONS },
  { key: 'tissue_modification', label: t('common.meta.tissueModification'), type: 'select', options: TISSUE_MODIFICATIONS },
  { key: 'maldi_matrix', label: t('datasets.field.maldiMatrix'), type: 'select', options: MALDI_MATRICES },
  { key: 'maldi_matrix_application', label: t('datasets.field.matrixApplication'), type: 'select', options: MALDI_MATRIX_APPLICATIONS },
  { key: 'solvent', label: t('datasets.field.solvent'), type: 'select', options: SOLVENTS },
])

const filters = ref<Record<string, string>>(
  Object.fromEntries(fields.value.map((f) => [f.key, ''])),
)

const applyFilters = () => {
  emit('apply', { ...filters.value })
  emit('close')
}

const resetFilters = () => {
  Object.keys(filters.value).forEach((key) => (filters.value[key] = ''))
  emit('apply', { ...filters.value })
  emit('close')
}
</script>

<template>
  <div class="flex flex-wrap gap-4">
    <div
      v-for="field in fields"
      :key="field.key"
      class="kawaru-text-87 text-base-content/60 flex flex-col w-full sm:w-[calc(50%-8px)]"
    >
      {{ field.label }}
      <input
        v-if="field.type === 'text'"
        v-model="filters[field.key]"
        class="w-full mt-1 p-2 rounded border border-base-300 bg-base-200 kawaru-text-87"
        :placeholder="field.placeholder"
      />
      <SelectWithOther
        v-else
        :model-value="filters[field.key] ?? ''"
        @update:model-value="filters[field.key] = $event"
        :options="field.options ?? []"
        :label-of="vocabLabel"
        :placeholder="$t('datasets.filter.any')"
        placeholder-selectable
        :other-placeholder="$t('datasets.filter.specifyOther')"
      />
    </div>
  </div>
  <!-- 本面板经 <teleport to="body"> 渲染，够不着页面外壳的字号，
       所以必须显式挂档位，不能靠继承。 -->
  <div class="mt-3 flex justify-end gap-2">
    <button
      @click="resetFilters"
      class="btn btn-outline kawaru-text-87 border border-base-300 hover:bg-base-300">{{ $t('common.action.reset') }}</button>
    <button
    @click="applyFilters"
    class="btn btn-primary kawaru-text-87 border border-base-300 hover:bg-base-300">{{ $t('common.action.apply') }}</button>
  </div>
</template>
