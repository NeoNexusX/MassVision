<script setup lang="ts">
import SelectWithOther from '@/shared/components/SelectWithOther.vue'
import BaseSelect from '@/shared/components/BaseSelect.vue'
import type {
  UploadMetadataFormState,
  UploadMetadataOtherInputs,
} from '@/features/upload/composables/useUploadMetadataForm'
import {
  EXPERIMENT_TYPES,
  ORGANISMS,
  ORGANISM_PARTS,
  CONDITIONS,
  SAMPLE_GROWTH_CONDITIONS,
  SAMPLE_STABILIZATIONS,
  TISSUE_MODIFICATIONS,
  MALDI_MATRICES,
  MALDI_MATRIX_APPLICATIONS,
  SOLVENTS,
} from '@/features/datasets/constants/datasetMetadata'

defineProps<{
  form: UploadMetadataFormState
  otherInputs: UploadMetadataOtherInputs
  parsingMetadata: boolean
}>()
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-4 pb-4">
      <div class="flex items-center gap-3">
        <input
          type="checkbox"
          id="is_public"
          v-model="form.is_public"
          class="checkbox checkbox-sm"
        />
        <label for="is_public" class="text-sm">Make dataset public (visible to others)</label>
      </div>

      <div class="divider text-sm text-base-content/50">Required</div>

      <div
        v-if="parsingMetadata"
        class="flex items-center gap-2 text-sm text-base-content/60 bg-base-200/50 rounded-lg px-3 py-2 mb-2"
      >
        <span
          class="inline-block w-3.5 h-3.5 border-2 border-base-content/30 border-t-base-content/60 rounded-full animate-spin"
        ></span>
        <span>Reading metadata from imzML...</span>
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >Polarity <span class="text-error">*</span></span
          ></label
        >
        <BaseSelect
          v-model="form.polarity"
          :options="['Positive', 'Negative']"
          placeholder="Select polarity..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >Ionisation Source <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.ionisation_source"
          v-model:other-value="otherInputs.ionisation_source"
          :options="['MALDI', 'DESI', 'SIMS', 'Other']"
          placeholder="Select source..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >Analyzer <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.analyzer"
          v-model:other-value="otherInputs.analyzer"
          :options="['Orbitrap', 'FTICR', 'TOF', 'Q-TOF', 'Other']"
          placeholder="Select analyzer..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-base"
              >Pixel Size X (μm) <span class="text-error">*</span></span
            ></label
          >
          <input
            v-model="form.pixel_size_horizontal"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full"
            placeholder="e.g. 50"
          />
        </div>
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-base"
              >Pixel Size Y (μm) <span class="text-error">*</span></span
            ></label
          >
          <input
            v-model="form.pixel_size_vertical"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full"
            placeholder="e.g. 50"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-base"
              >Spectrum Mode <span class="text-error">*</span></span
            ></label
          >
          <BaseSelect
            v-model="form.spectrum_mode"
            :options="['profile', 'centroid']"
            placeholder="Select..."
          />
        </div>
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-base"
              >Storage Mode <span class="text-error">*</span></span
            ></label
          >
          <BaseSelect
            v-model="form.storage_mode"
            :options="['continuous', 'processed']"
            placeholder="Select..."
          />
        </div>
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >Organism <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.organism"
          v-model:other-value="otherInputs.organism"
          :options="ORGANISMS"
          placeholder="Select organism..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >Organism Part <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.organism_part"
          v-model:other-value="otherInputs.organism_part"
          :options="ORGANISM_PARTS"
          placeholder="Select part..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >Condition <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.condition"
          v-model:other-value="otherInputs.condition"
          :options="CONDITIONS"
          placeholder="Select condition..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >Sample Stabilization <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.sample_stabilization"
          v-model:other-value="otherInputs.sample_stabilization"
          :options="SAMPLE_STABILIZATIONS"
          placeholder="Select stabilization..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >Solvent <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.solvent"
          v-model:other-value="otherInputs.solvent"
          :options="SOLVENTS"
          placeholder="Select solvent..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="divider text-sm text-base-content/50">Optional</div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >Experiment Type</span
          ></label
        >
        <SelectWithOther
          v-model="form.experiment_type"
          v-model:other-value="otherInputs.experiment_type"
          :options="EXPERIMENT_TYPES"
          placeholder="Select type..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-base">m/z</span></label
          >
          <input
            v-model="form.mz"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full"
            placeholder="e.g. 200"
          />
        </div>
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-base"
              >Resolving Power</span
            ></label
          >
          <input
            v-model="form.resolving_power"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full"
            placeholder="e.g. 140000"
          />
        </div>
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >Sample Growth Conditions</span
          ></label
        >
        <SelectWithOther
          v-model="form.sample_growth_conditions"
          v-model:other-value="otherInputs.sample_growth_conditions"
          :options="SAMPLE_GROWTH_CONDITIONS"
          placeholder="Select growth..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >Tissue Modification</span
          ></label
        >
        <SelectWithOther
          v-model="form.tissue_modification"
          v-model:other-value="otherInputs.tissue_modification"
          :options="TISSUE_MODIFICATIONS"
          placeholder="Select modification..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >MALDI Matrix</span
          ></label
        >
        <SelectWithOther
          v-model="form.maldi_matrix"
          v-model:other-value="otherInputs.maldi_matrix"
          :options="MALDI_MATRICES"
          placeholder="Select matrix..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-base"
            >MALDI Matrix Application</span
          ></label
        >
        <SelectWithOther
          v-model="form.maldi_matrix_application"
          v-model:other-value="otherInputs.maldi_matrix_application"
          :options="MALDI_MATRIX_APPLICATIONS"
          placeholder="Select application..."
          other-placeholder="Please specify..."
        />
      </div>
    </div>
  </div>
</template>
