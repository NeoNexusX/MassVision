<script setup lang="ts">
import { ref } from 'vue'
import SelectWithOther from '@/shared/components/SelectWithOther.vue'
import { getDatasetMetadata } from '@/features/datasets/constants/datasetMetadata'

const {
  EXPERIMENT_TYPES,
  ORGANISMS,
  ORGANISM_PARTS,
  CONDITIONS,
  SAMPLE_STABILIZATIONS,
  TISSUE_MODIFICATIONS,
  MALDI_MATRICES,
  MALDI_MATRIX_APPLICATIONS,
  SOLVENTS,
} = getDatasetMetadata()

const emit = defineEmits<{
  (e: 'apply', payload: Record<string, string>): void
  (e: 'close'): void
}>()

interface FilterField {
  key: string
  label: string
  type: 'text' | 'select'
  placeholder?: string
  options?: string[]
  otherPlaceholder?: string
}

const fields: FilterField[] = [
  { key: 'filename', label: 'Filename', type: 'text', placeholder: 'Filename' },
  { key: 'experiment_type', label: 'Experiment Type', type: 'select', options: EXPERIMENT_TYPES, otherPlaceholder: 'Specify experiment type' },
  { key: 'username', label: 'Username', type: 'text', placeholder: 'Submitter username' },
  { key: 'organism', label: 'Organism', type: 'select', options: ORGANISMS, otherPlaceholder: 'Specify organism' },
  { key: 'organism_part', label: 'Organism Part', type: 'select', options: ORGANISM_PARTS, otherPlaceholder: 'Specify organism part' },
  { key: 'condition', label: 'Condition', type: 'select', options: CONDITIONS, otherPlaceholder: 'Specify condition' },
  { key: 'sample_stabilization', label: 'Sample Stabilization', type: 'select', options: SAMPLE_STABILIZATIONS, otherPlaceholder: 'Specify stabilization' },
  { key: 'tissue_modification', label: 'Tissue Modification', type: 'select', options: TISSUE_MODIFICATIONS, otherPlaceholder: 'Specify modification' },
  { key: 'maldi_matrix', label: 'MALDI Matrix', type: 'select', options: MALDI_MATRICES, otherPlaceholder: 'Specify matrix' },
  { key: 'maldi_matrix_application', label: 'Matrix Application', type: 'select', options: MALDI_MATRIX_APPLICATIONS, otherPlaceholder: 'Specify application' },
  { key: 'solvent', label: 'Solvent', type: 'select', options: SOLVENTS, otherPlaceholder: 'Specify solvent' },
]

const filters = ref<Record<string, string>>(
  Object.fromEntries(fields.map((f) => [f.key, ''])),
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
      class="text-base text-base-content/60 flex flex-col w-full sm:w-[calc(50%-8px)]"
    >
      {{ field.label }}
      <input
        v-if="field.type === 'text'"
        v-model="filters[field.key]"
        class="w-full mt-1 p-2 rounded border border-base-300 bg-base-200 text-base"
        :placeholder="field.placeholder"
      />
      <SelectWithOther
        v-else
        :model-value="filters[field.key] ?? ''"
        @update:model-value="filters[field.key] = $event"
        :options="field.options ?? []"
        placeholder="Any"
        :other-placeholder="field.otherPlaceholder"
      />
    </div>
  </div>
  <div class="mt-3 flex justify-end gap-2">
    <button
      @click="resetFilters"
      class="btn btn-outline text-[1em] border border-base-300 hover:bg-base-300">Reset</button>
    <button
    @click="applyFilters"
    class="btn btn-primary text-[1em] border border-base-300 hover:bg-base-300">Apply</button>
  </div>
</template>
