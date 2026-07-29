<script setup lang="ts">
import { computed, ref } from 'vue'
import SelectWithOther from '@/shared/components/SelectWithOther.vue'
import IconSelect from '@/shared/components/IconSelect.vue'
import SolventPicker from '@/features/upload/components/SolventPicker.vue'
import {
  isValidPixelSize,
  type UploadMetadataFormState,
} from '@/features/upload/composables/useUploadMetadataForm'
import {
  ORGANISMS,
  ORGANISM_PARTS,
  CONDITIONS,
  SAMPLE_GROWTH_CONDITIONS,
  SAMPLE_STABILIZATIONS,
  TISSUE_MODIFICATIONS,
  MALDI_MATRICES,
  MALDI_MATRIX_APPLICATIONS,
  SOLVENTS,
  POLARITIES,
  ION_SOURCES,
  ANALYZERS,
  SPECTRUM_MODES,
  STORAGE_MODES,
} from '@/features/datasets/constants/datasetMetadata'
import { getIonSourceFieldRules } from '@/features/upload/utils/ionSourceRules'

const props = defineProps<{
  form: UploadMetadataFormState
  parsingMetadata: boolean
}>()

const pixelSizeXError = ref('')
const pixelSizeYError = ref('')

function validatePixelSize(value: string, field: 'horizontal' | 'vertical') {
  const errorRef = field === 'horizontal' ? pixelSizeXError : pixelSizeYError
  if (!isValidPixelSize(value)) {
    errorRef.value = 'Pixel size must be an integer between 1 and 200'
    return false
  }
  errorRef.value = ''
  return true
}

const ionRules = computed(() =>
  getIonSourceFieldRules(props.form.ionisation_source),
)
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
        <label for="is_public" class="text-lg">Make dataset public (visible to others)</label>
      </div>

      <div class="divider text-lg text-base-content/50">Acquisition Information</div>

      <div
        v-if="parsingMetadata"
        class="flex items-center gap-2 text-lg text-base-content/60 bg-base-200/50 rounded-lg px-3 py-2 mb-2"
      >
        <span
          class="inline-block w-3.5 h-3.5 border-2 border-base-content/30 border-t-base-content/60 rounded-full animate-spin"
        ></span>
        <span>Reading metadata from imzML...</span>
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >Polarity <span class="text-error">*</span></span
          ></label
        >
        <IconSelect
          v-model="form.polarity"
          :options="POLARITIES"
          placeholder="Select polarity..."
          hide-label
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >Ionisation Source <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.ionisation_source"
          :options="ION_SOURCES"
          placeholder="Select source..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >Analyzer <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.analyzer"
          :options="ANALYZERS"
          placeholder="Select analyzer..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-xl"
              >Pixel Size X (μm) <span class="text-error">*</span></span
            ></label
          >
          <input
            v-model="form.pixel_size_horizontal"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full text-base"
            :class="{ 'input-error': pixelSizeXError }"
            placeholder="e.g. 50"
            @blur="validatePixelSize(form.pixel_size_horizontal, 'horizontal')"
          />
          <span v-if="pixelSizeXError" class="text-xs text-error mt-0.5">{{ pixelSizeXError }}</span>
        </div>
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-xl"
              >Pixel Size Y (μm) <span class="text-error">*</span></span
            ></label
          >
          <input
            v-model="form.pixel_size_vertical"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full text-base"
            :class="{ 'input-error': pixelSizeYError }"
            placeholder="e.g. 50"
            @blur="validatePixelSize(form.pixel_size_vertical, 'vertical')"
          />
          <span v-if="pixelSizeYError" class="text-xs text-error mt-0.5">{{ pixelSizeYError }}</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-xl"
              >Spectrum Mode <span class="text-error">*</span></span
            ></label
          >
          <IconSelect
            v-model="form.spectrum_mode"
            :options="SPECTRUM_MODES"
            placeholder="Select..."
            hide-label
          />
        </div>
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-xl"
              >Storage Mode <span class="text-error">*</span></span
            ></label
          >
          <IconSelect
            v-model="form.storage_mode"
            :options="STORAGE_MODES"
            placeholder="Select..."
            hide-label
          />
        </div>
      </div>

      <!-- Solvent: always visible, required state depends on ion source -->
      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >{{ ionRules.solvent.label }}
            <span v-if="ionRules.solvent.required" class="text-error">*</span>
          </span></label
        >
        <SolventPicker
          v-model="form.solvent"
          :solvent-options="SOLVENTS"
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >{{ ionRules.maldiMatrix.label }}
            <span v-if="ionRules.maldiMatrix.required" class="text-error">*</span>
          </span></label
        >
        <SelectWithOther
          v-model="form.maldi_matrix"
          :options="MALDI_MATRICES"
          placeholder="Select matrix..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >{{ ionRules.maldiMatrixApplication.label }}
            <span v-if="ionRules.maldiMatrixApplication.required" class="text-error">*</span>
          </span></label
        >
        <SelectWithOther
          v-model="form.maldi_matrix_application"
          :options="MALDI_MATRIX_APPLICATIONS"
          placeholder="Select application..."
          other-placeholder="Please specify..."
        />
      </div>

      <label class="label"
        ><span class="label-text font-medium text-base-content text-xl"
          >Detector resolving power</span
        ></label
      >
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-xl">m/z</span></label
          >
          <input
            v-model="form.mz"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full text-base"
            placeholder="e.g. 200"
          />
        </div>
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content text-xl"
              >Resolving Power</span
            ></label
          >
          <input
            v-model="form.resolving_power"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full text-base"
            placeholder="e.g. 140000"
          />
        </div>
      </div>

      <div class="divider text-lg text-base-content/50">Sample Metadata</div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >Organism <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.organism"
          :options="ORGANISMS"
          placeholder="Select organism..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >Organism Part <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.organism_part"
          :options="ORGANISM_PARTS"
          placeholder="Select part..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >Condition <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.condition"
          :options="CONDITIONS"
          placeholder="Select condition..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >Sample Stabilization <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.sample_stabilization"
          :options="SAMPLE_STABILIZATIONS"
          placeholder="Select stabilization..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >Sample Growth Conditions</span
          ></label
        >
        <SelectWithOther
          v-model="form.sample_growth_conditions"
          :options="SAMPLE_GROWTH_CONDITIONS"
          placeholder="Select growth..."
          other-placeholder="Please specify..."
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content text-xl"
            >Tissue Modification</span
          ></label
        >
        <SelectWithOther
          v-model="form.tissue_modification"
          :options="TISSUE_MODIFICATIONS"
          placeholder="Select modification..."
          other-placeholder="Please specify..."
        />
      </div>

    </div>
  </div>
</template>
