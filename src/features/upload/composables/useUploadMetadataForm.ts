import { ref } from 'vue'
import { getConfig } from '@/shared/config/runtimeConfig'

export interface UploadMetadataFormState {
  experiment_type: string
  polarity: string
  ionisation_source: string
  analyzer: string
  pixel_size_horizontal: string
  pixel_size_vertical: string
  resolving_power: string
  organism: string
  organism_part: string
  condition: string
  sample_growth_conditions: string
  sample_stabilization: string
  tissue_modification: string
  maldi_matrix: string
  maldi_matrix_application: string
  solvent: string
  spectrum_mode: string
  storage_mode: string
  mz: string
  is_public: boolean
}

interface RequiredField {
  key: keyof UploadMetadataFormState
  label: string
}

const REQUIRED_FIELDS: RequiredField[] = [
  { key: 'polarity', label: 'Polarity' },
  { key: 'ionisation_source', label: 'Ionisation Source' },
  { key: 'analyzer', label: 'Analyzer' },
  { key: 'pixel_size_horizontal', label: 'Pixel Size X (μm)' },
  { key: 'pixel_size_vertical', label: 'Pixel Size Y (μm)' },
  { key: 'organism', label: 'Organism' },
  { key: 'organism_part', label: 'Organism Part' },
  { key: 'condition', label: 'Condition' },
  { key: 'sample_stabilization', label: 'Sample Stabilization' },
  { key: 'solvent', label: 'Solvent' },
  { key: 'spectrum_mode', label: 'Spectrum Mode' },
  { key: 'storage_mode', label: 'Storage Mode' },
]

function createForm(): UploadMetadataFormState {
  return {
    experiment_type: 'imzML',
    polarity: '',
    ionisation_source: '',
    analyzer: '',
    pixel_size_horizontal: '',
    pixel_size_vertical: '',
    resolving_power: '',
    organism: '',
    organism_part: '',
    condition: '',
    sample_growth_conditions: '',
    sample_stabilization: '',
    tissue_modification: '',
    maldi_matrix: '',
    maldi_matrix_application: '',
    solvent: '',
    spectrum_mode: '',
    storage_mode: '',
    mz: '',
    is_public: false,
  }
}

export function useUploadMetadataForm() {
  // State
  const form = ref(createForm())

  // Methods
  const resetForm = () => {
    Object.assign(form.value, createForm())
  }

  const resetParsedFields = () => {
    form.value.polarity = ''
    form.value.ionisation_source = ''
    form.value.analyzer = ''
    form.value.pixel_size_horizontal = ''
    form.value.pixel_size_vertical = ''
  }

  const applyParsedSettings = (settings: any) => {
    const opts = getConfig().options
    if (settings.polarity) {
      form.value.polarity = settings.polarity === 'negative' ? 'Negative' : 'Positive'
    }
    if (settings.ionSource && opts.ionSource.includes(settings.ionSource)) {
      form.value.ionisation_source = settings.ionSource
    }
    if (settings.analyzer && opts.analyzer.includes(settings.analyzer)) {
      form.value.analyzer = settings.analyzer
    }
    if (settings.pixelSizeX != null) {
      form.value.pixel_size_horizontal = String(settings.pixelSizeX)
    }
    if (settings.pixelSizeY != null) {
      form.value.pixel_size_vertical = String(settings.pixelSizeY)
    }
    if (settings.spectrum_mode) {
      form.value.spectrum_mode = settings.spectrum_mode
    }
    if (settings.storage_mode) {
      form.value.storage_mode = settings.storage_mode
    }
  }

  const validateMetadata = () => {
    for (const field of REQUIRED_FIELDS) {
      const value = form.value[field.key]
      if (!value || (typeof value === 'string' && !value.trim())) {
        return `${field.label} is required.`
      }
      if (value === 'Other') {
        return `Please specify custom value for ${field.label}.`
      }
    }
    // Validate pixel size ranges
    for (const key of ['pixel_size_horizontal', 'pixel_size_vertical'] as const) {
      const val = form.value[key]
      if (val) {
        const num = Number(val)
        if (isNaN(num) || !Number.isInteger(num) || num < 1 || num > 200) {
          const label = key === 'pixel_size_horizontal' ? 'Pixel Size X (μm)' : 'Pixel Size Y (μm)'
          return `${label} must be an integer between 1 and 200.`
        }
      }
    }
    return ''
  }

  const buildMetadataPayload = () => {
    const payload: Record<string, any> = {}
    Object.keys(form.value).forEach((key) => {
      const formKey = key as keyof UploadMetadataFormState
      const value = form.value[formKey]
      payload[formKey] = value
    })

    payload.pixel_size_horizontal = Number(payload.pixel_size_horizontal)
    payload.pixel_size_vertical = Number(payload.pixel_size_vertical)

    for (const key of ['resolving_power', 'mz'] as const) {
      const v = payload[key]
      if (v !== '' && v !== undefined && isFinite(Number(v))) {
        payload[key] = Number(v)
      } else {
        delete payload[key]
      }
    }

    return payload
  }

  return {
    form,
    resetForm,
    resetParsedFields,
    applyParsedSettings,
    validateMetadata,
    buildMetadataPayload,
  }
}
