<script setup lang="ts">
import { computed, ref } from 'vue'
import SelectWithOther from '@/shared/components/SelectWithOther.vue'
import IconSelect from '@/shared/components/IconSelect.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import SolventPicker from '@/features/upload/components/SolventPicker.vue'
import {
  isValidPixelSize,
  type UploadMetadataFormState,
} from '@/features/upload/composables/useUploadMetadataForm'
import {
  ANALYZERS,
  CONDITIONS,
  ION_SOURCES,
  MALDI_MATRICES,
  MALDI_MATRIX_APPLICATIONS,
  ORGANISMS,
  ORGANISM_PARTS,
  POLARITIES,
  SAMPLE_GROWTH_CONDITIONS,
  SAMPLE_STABILIZATIONS,
  SOLVENTS,
  SPECTRUM_MODES,
  STORAGE_MODES,
  TISSUE_MODIFICATIONS,
} from '@/features/datasets/constants/datasetMetadata'
import { getIonSourceFieldRules } from '@/features/upload/utils/ionSourceRules'
import { vocabLabel, vocabOptionMap } from '@/features/datasets/constants/vocabLabels'
import { t } from '@/i18n'

const props = defineProps<{
  form: UploadMetadataFormState
  parsingMetadata: boolean
  detectedSpectrumMode?: string
  detectedStorageMode?: string
}>()

const pixelSizeXError = ref('')
const pixelSizeYError = ref('')

function validatePixelSize(value: string, field: 'horizontal' | 'vertical') {
  const errorRef = field === 'horizontal' ? pixelSizeXError : pixelSizeYError
  if (!isValidPixelSize(value)) {
    errorRef.value = t('upload.form.pixelSizeError')
    return false
  }
  errorRef.value = ''
  return true
}

const ionRules = computed(() =>
  getIonSourceFieldRules(props.form.ionisation_source),
)

// ---- Spectrum / Storage Mode 二次确认 ----
const modeConfirmOpen = ref(false)
const modeConfirmTitle = ref('')
const modeConfirmMessage = ref('')
let pendingModeField: 'spectrum_mode' | 'storage_mode' | null = null
let pendingModeValue = ''

/**
 * 当用户手动修改与自动识别值不同的 spectrum/storage mode 时,
 * 弹出二次确认对话框,防止误操作。
 */
const handleModeChange = (
  field: 'spectrum_mode' | 'storage_mode',
  value: string,
) => {
  const detected =
    field === 'spectrum_mode'
      ? props.detectedSpectrumMode
      : props.detectedStorageMode
  const label = field === 'spectrum_mode' ? t('datasets.field.spectrumMode') : t('datasets.field.storageMode')
  const labelLower =
    field === 'spectrum_mode' ? t('upload.form.spectrumModeLower') : t('upload.form.storageModeLower')

  // 没有识别值或选择与识别值相同,直接应用
  if (!detected || !value || value === detected) {
    props.form[field] = value
    return
  }

  // 用户选择了与识别值不同的选项,弹窗确认
  pendingModeField = field
  pendingModeValue = value
  modeConfirmTitle.value = t('upload.form.modeChangeTitle', { field: label })
  modeConfirmMessage.value = t('upload.form.modeChangeMessage', {
    field: labelLower,
    detected,
    value,
  })
  modeConfirmOpen.value = true
}

const confirmModeChange = () => {
  if (pendingModeField) {
    props.form[pendingModeField] = pendingModeValue
  }
  modeConfirmOpen.value = false
  pendingModeField = null
  pendingModeValue = ''
}

const cancelModeChange = () => {
  modeConfirmOpen.value = false
  pendingModeField = null
  pendingModeValue = ''
}
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
        <label for="is_public" class="kawaru-text-112">{{ $t('upload.form.makePublic') }}</label>
      </div>

      <div class="divider kawaru-text-112 text-base-content/50">{{ $t('upload.form.acquisitionInfo') }}</div>

      <div
        v-if="parsingMetadata"
        class="flex items-center gap-2 kawaru-text-112 text-base-content/60 bg-base-200/50 rounded-lg px-3 py-2 mb-2"
      >
        <span
          class="inline-block w-3.5 h-3.5 border-2 border-base-content/30 border-t-base-content/60 rounded-full animate-spin"
        ></span>
        <span>{{ $t('upload.form.readingMetadata') }}</span>
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('common.meta.polarity') }} <span class="text-error">*</span></span
          ></label
        >
        <IconSelect
          v-model="form.polarity"
          :options="vocabOptionMap(POLARITIES)"
          :placeholder="$t('datasets.metadata.selectPlaceholder')"
          hide-label
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('common.meta.ionisationSource') }} <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.ionisation_source"
          :options="ION_SOURCES"
          :label-of="vocabLabel"
          :placeholder="$t('datasets.metadata.selectPlaceholder')"
          :other-placeholder="$t('datasets.filter.specifyOther')"
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('common.meta.analyzer') }} <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.analyzer"
          :options="ANALYZERS"
          :label-of="vocabLabel"
          :placeholder="$t('datasets.metadata.selectPlaceholder')"
          :other-placeholder="$t('datasets.filter.specifyOther')"
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content kawaru-text-125"
              >{{ $t('upload.form.pixelSizeX') }} <span class="text-error">*</span></span
            ></label
          >
          <input
            v-model="form.pixel_size_horizontal"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full kawaru-text-100"
            :class="{ 'input-error': pixelSizeXError }"
            placeholder="e.g. 50"
            @blur="validatePixelSize(form.pixel_size_horizontal, 'horizontal')"
          />
          <span v-if="pixelSizeXError" class="kawaru-text-75 text-error mt-0.5">{{ pixelSizeXError }}</span>
        </div>
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content kawaru-text-125"
              >{{ $t('upload.form.pixelSizeY') }} <span class="text-error">*</span></span
            ></label
          >
          <input
            v-model="form.pixel_size_vertical"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full kawaru-text-100"
            :class="{ 'input-error': pixelSizeYError }"
            placeholder="e.g. 50"
            @blur="validatePixelSize(form.pixel_size_vertical, 'vertical')"
          />
          <span v-if="pixelSizeYError" class="kawaru-text-75 text-error mt-0.5">{{ pixelSizeYError }}</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content kawaru-text-125"
              >{{ $t('datasets.field.spectrumMode') }} <span class="text-error">*</span></span
            ></label
          >
          <IconSelect
            :model-value="form.spectrum_mode"
            :options="SPECTRUM_MODES"
            :placeholder="$t('datasets.metadata.selectPlaceholder')"
            hide-label
            @change="(v: string) => handleModeChange('spectrum_mode', v)"
          />
        </div>
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content kawaru-text-125"
              >{{ $t('datasets.field.storageMode') }} <span class="text-error">*</span></span
            ></label
          >
          <IconSelect
            :model-value="form.storage_mode"
            :options="STORAGE_MODES"
            :placeholder="$t('datasets.metadata.selectPlaceholder')"
            hide-label
            @change="(v: string) => handleModeChange('storage_mode', v)"
          />
        </div>
      </div>

      <!-- Solvent: always visible, required state depends on ion source -->
      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('datasets.field.solvent') }}
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
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('datasets.field.maldiMatrix') }}
            <span v-if="ionRules.maldiMatrix.required" class="text-error">*</span>
          </span></label
        >
        <SelectWithOther
          v-model="form.maldi_matrix"
          :options="MALDI_MATRICES"
          :label-of="vocabLabel"
          :placeholder="$t('datasets.metadata.selectPlaceholder')"
          :other-placeholder="$t('datasets.filter.specifyOther')"
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('upload.form.maldiMatrixApplication') }}
            <span v-if="ionRules.maldiMatrixApplication.required" class="text-error">*</span>
          </span></label
        >
        <SelectWithOther
          v-model="form.maldi_matrix_application"
          :options="MALDI_MATRIX_APPLICATIONS"
          :label-of="vocabLabel"
          :placeholder="$t('datasets.metadata.selectPlaceholder')"
          :other-placeholder="$t('datasets.filter.specifyOther')"
        />
      </div>

      <label class="label"
        ><span class="label-text font-medium text-base-content kawaru-text-125"
          >{{ $t('upload.form.detectorResolvingPower') }}</span
        ></label
      >
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content kawaru-text-125"><i>m/z</i></span></label
          >
          <input
            v-model="form.mz"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full kawaru-text-100"
            placeholder="e.g. 200"
          />
        </div>
        <div class="flex flex-col">
          <label class="label"
            ><span class="label-text font-medium text-base-content kawaru-text-125"
              >{{ $t('datasets.field.resolvingPower') }}</span
            ></label
          >
          <input
            v-model="form.resolving_power"
            type="text"
            inputmode="numeric"
            class="input input-bordered w-full kawaru-text-100"
            placeholder="e.g. 140000"
          />
        </div>
      </div>

      <div class="divider kawaru-text-112 text-base-content/50">{{ $t('upload.form.sampleMetadata') }}</div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('common.meta.organism') }} <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.organism"
          :options="ORGANISMS"
          :label-of="vocabLabel"
          :placeholder="$t('datasets.metadata.selectPlaceholder')"
          :other-placeholder="$t('datasets.filter.specifyOther')"
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('common.meta.organismPart') }} <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.organism_part"
          :options="ORGANISM_PARTS"
          :label-of="vocabLabel"
          :placeholder="$t('datasets.metadata.selectPlaceholder')"
          :other-placeholder="$t('datasets.filter.specifyOther')"
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('datasets.field.condition') }} <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.condition"
          :options="CONDITIONS"
          :label-of="vocabLabel"
          :placeholder="$t('datasets.metadata.selectPlaceholder')"
          :other-placeholder="$t('datasets.filter.specifyOther')"
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('common.meta.sampleStabilization') }} <span class="text-error">*</span></span
          ></label
        >
        <SelectWithOther
          v-model="form.sample_stabilization"
          :options="SAMPLE_STABILIZATIONS"
          :label-of="vocabLabel"
          :placeholder="$t('datasets.metadata.selectPlaceholder')"
          :other-placeholder="$t('datasets.filter.specifyOther')"
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('upload.form.sampleGrowthConditions') }}</span
          ></label
        >
        <SelectWithOther
          v-model="form.sample_growth_conditions"
          :options="SAMPLE_GROWTH_CONDITIONS"
          :label-of="vocabLabel"
          :placeholder="$t('datasets.metadata.selectPlaceholder')"
          :other-placeholder="$t('datasets.filter.specifyOther')"
        />
      </div>

      <div class="flex flex-col">
        <label class="label"
          ><span class="label-text font-medium text-base-content kawaru-text-125"
            >{{ $t('common.meta.tissueModification') }}</span
          ></label
        >
        <SelectWithOther
          v-model="form.tissue_modification"
          :options="TISSUE_MODIFICATIONS"
          :label-of="vocabLabel"
          :placeholder="$t('datasets.metadata.selectPlaceholder')"
          :other-placeholder="$t('datasets.filter.specifyOther')"
        />
      </div>

    </div>

    <ConfirmDialog
      :open="modeConfirmOpen"
      :title="modeConfirmTitle"
      :message="modeConfirmMessage"
:confirm-label="$t('upload.form.modeChangeConfirm')"
      danger
      @confirm="confirmModeChange"
      @cancel="cancelModeChange"
    />
  </div>
</template>
