<script setup lang="ts">
import { reactive, ref } from 'vue'
import SelectWithOther from '@/shared/components/SelectWithOther.vue'
import {
  EXPERIMENT_TYPES,
  ORGANISMS,
  ORGANISM_PARTS,
  CONDITIONS,
  SAMPLE_STABILIZATIONS,
  TISSUE_MODIFICATIONS,
  MALDI_MATRICES,
  MALDI_MATRIX_APPLICATIONS,
  SOLVENTS,
} from '@/features/datasets/constants/datasetMetadata'

const emit = defineEmits<{
  (e: 'apply', payload: Record<string, any>): void
  (e: 'close'): void
}>()

const filters = ref<Record<string, any>>({
  filename: '',
  experiment_type: '',
  username: '',
  organism: '',
  organism_part: '',
  condition: '',
  sample_stabilization: '',
  tissue_modification: '',
  maldi_matrix: '',
  maldi_matrix_application: '',
  solvent: '',
})

const otherValues = reactive<Record<string, string>>({
  experiment_type: '',
  organism: '',
  organism_part: '',
  condition: '',
  sample_stabilization: '',
  tissue_modification: '',
  maldi_matrix: '',
  maldi_matrix_application: '',
  solvent: '',
})

const applyFilters = () => {
  const payload = { ...filters.value }
  for (const key of Object.keys(otherValues)) {
    if (payload[key] === 'Other' && otherValues[key]?.trim()) {
      payload[key] = otherValues[key]!.trim()
    }
  }
  emit('apply', payload)
  emit('close')
}

const resetFilters = () => {
  Object.keys(filters.value).forEach((key) => {
    filters.value[key] = ''
  })
  Object.keys(otherValues).forEach((key) => {
    otherValues[key] = ''
  })
  emit('apply', { ...filters.value })
  emit('close')
}
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div class="text-base text-base-content/60 flex flex-col">
      Filename
      <input
        v-model="filters.filename"
        class="w-full mt-1 p-2 rounded border border-base-300 bg-base-200 text-base"
        placeholder="Filename"
      />
    </div>
    <div class="text-base text-base-content/60 flex flex-col">
      Experiment Type
      <SelectWithOther
        v-model="filters.experiment_type"
        v-model:other-value="otherValues.experiment_type"
        :options="EXPERIMENT_TYPES"
        placeholder="Any"
        other-placeholder="Specify experiment type"
      />
    </div>
    <div class="text-base text-base-content/60 flex flex-col">
      Username
      <input
        v-model="filters.username"
        class="w-full mt-1 p-2 rounded border border-base-300 bg-base-200 text-base"
        placeholder="Submitter username"
      />
    </div>
    <div class="text-base text-base-content/60 flex flex-col">
      Organism
      <SelectWithOther
        v-model="filters.organism"
        v-model:other-value="otherValues.organism"
        :options="ORGANISMS"
        placeholder="Any"
        other-placeholder="Specify organism"
      />
    </div>
    <div class="text-base text-base-content/60 flex flex-col">
      Organism Part
      <SelectWithOther
        v-model="filters.organism_part"
        v-model:other-value="otherValues.organism_part"
        :options="ORGANISM_PARTS"
        placeholder="Any"
        other-placeholder="Specify organism part"
      />
    </div>
    <div class="text-base text-base-content/60 flex flex-col">
      Condition
      <SelectWithOther
        v-model="filters.condition"
        v-model:other-value="otherValues.condition"
        :options="CONDITIONS"
        placeholder="Any"
        other-placeholder="Specify condition"
      />
    </div>
    <div class="text-base text-base-content/60 flex flex-col">
      Sample Stabilization
      <SelectWithOther
        v-model="filters.sample_stabilization"
        v-model:other-value="otherValues.sample_stabilization"
        :options="SAMPLE_STABILIZATIONS"
        placeholder="Any"
        other-placeholder="Specify stabilization"
      />
    </div>
    <div class="text-base text-base-content/60 flex flex-col">
      Tissue Modification
      <SelectWithOther
        v-model="filters.tissue_modification"
        v-model:other-value="otherValues.tissue_modification"
        :options="TISSUE_MODIFICATIONS"
        placeholder="Any"
        other-placeholder="Specify modification"
      />
    </div>
    <div class="text-base text-base-content/60 flex flex-col">
      MALDI Matrix
      <SelectWithOther
        v-model="filters.maldi_matrix"
        v-model:other-value="otherValues.maldi_matrix"
        :options="MALDI_MATRICES"
        placeholder="Any"
        other-placeholder="Specify matrix"
      />
    </div>
    <div class="text-base text-base-content/60 flex flex-col">
      Matrix Application
      <SelectWithOther
        v-model="filters.maldi_matrix_application"
        v-model:other-value="otherValues.maldi_matrix_application"
        :options="MALDI_MATRIX_APPLICATIONS"
        placeholder="Any"
        other-placeholder="Specify application"
      />
    </div>
    <div class="text-base text-base-content/60 flex flex-col">
      Solvent
      <SelectWithOther
        v-model="filters.solvent"
        v-model:other-value="otherValues.solvent"
        :options="SOLVENTS"
        placeholder="Any"
        other-placeholder="Specify solvent"
      />
    </div>
  </div>
  <div class="mt-3 flex justify-end gap-2">
    <button
      @click="resetFilters"
      class="btn btn-sm btn-outline border border-base-300 text-base-content/70 hover:bg-base-200"
    >
      Reset
    </button>
    <button @click="applyFilters" class="btn btn-sm btn-primary text-primary-content">Apply</button>
  </div>
</template>
