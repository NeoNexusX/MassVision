import { computed, type Ref } from 'vue'

interface MethodParam {
  key: string
  label: string
  type: 'number' | 'float' | 'text' | 'select'
  default?: number | string
  min?: number
  max?: number
  step?: number
  hint?: string
  options?: Array<{ label: string; value: string }>
}

interface MethodItem {
  id: string
  label: string
  note?: string
  params?: MethodParam[]
}

export interface MethodGroup {
  key: string
  title: string
  hint: string
  methods: MethodItem[]
}

export const allMethodGroups: MethodGroup[] = [
  {
    key: 'noise',
    title: 'Noise Reduction',
    hint: 'Reduce noise while preserving peaks',
    methods: [
      {
        id: 'savgol_numba',
        label: 'Savitzky–Golay',
        params: [
          {
            key: 'window',
            label: 'Window',
            type: 'number',
            default: 5,
            min: 1,
            hint: 'Filter window size',
          },
          {
            key: 'polyorder',
            label: 'Polyorder',
            type: 'number',
            default: 3,
            min: 0,
            hint: 'Polynomial order',
          },
          {
            key: 'deriv',
            label: 'Derivative',
            type: 'number',
            default: 0,
            min: 0,
            hint: 'Derivative order (0=smooth)',
          },
          {
            key: 'delta',
            label: 'Delta',
            type: 'float',
            default: 1.0,
            min: 0,
            step: 0.1,
            hint: 'Sample spacing',
          },
        ],
      },
      {
        id: 'gaussian_numba',
        label: 'Gaussian',
        params: [
          { key: 'window', label: 'Window', type: 'number', default: 5, min: 1 },
          {
            key: 'sd',
            label: 'Sigma',
            type: 'float',
            default: 2.0,
            min: 0,
            step: 0.1,
            hint: 'Gaussian std deviation',
          },
        ],
      },
      {
        id: 'ma_numba',
        label: 'Moving Average',
        params: [{ key: 'window', label: 'Window', type: 'number', default: 5, min: 1 }],
      },
    ],
  },
  {
    key: 'baseline',
    title: 'Baseline Correction',
    hint: 'Remove baseline to correct background signal',
    methods: [
      { id: 'snip_numba', label: 'SNIP', params: [] },
      { id: 'locmin_numba', label: 'Local Minimum', params: [] },
    ],
  },
  {
    key: 'norm',
    title: 'Normalization',
    hint: 'Scale spectra to comparable intensities',
    methods: [
      {
        id: 'tic_numba',
        label: 'TIC',
        params: [
          {
            key: 'scale',
            label: 'Scale',
            type: 'float',
            default: 1.0,
            min: 0,
            step: 1,
            hint: 'Output scaling factor',
          },
        ],
      },
      {
        id: 'rms_numba',
        label: 'RMS',
        params: [
          {
            key: 'scale',
            label: 'Scale',
            type: 'float',
            default: 1.0,
            min: 0,
            step: 1,
            hint: 'Output scaling factor',
          },
        ],
      },
      {
        id: 'ref_numba',
        label: 'REF',
        params: [
          { key: 'scale', label: 'Scale', type: 'float', default: 1.0, min: 0, step: 1 },
          { key: 'ref', label: 'Ref m/z', type: 'text', hint: 'Reference m/z (auto if empty)' },
          {
            key: 'ref_tolerance',
            label: 'Ref Tolerance',
            type: 'float',
            default: 0.1,
            min: 0,
            step: 0.01,
          },
        ],
      },
    ],
  },
  {
    key: 'pick',
    title: 'Peak Picking',
    hint: 'Detect peaks in spectra',
    methods: [
      {
        id: 'diff',
        label: 'Standard Peak Detection',
        params: [
          {
            key: 'method',
            label: 'Method',
            type: 'select',
            default: 'diff',
            options: [
              { label: 'Differential (diff)', value: 'diff' },
              { label: 'Std Dev (sd)', value: 'sd' },
              { label: 'MAD', value: 'mad' },
              { label: 'Quantile', value: 'quantile' },
            ],
          },
          {
            key: 'snr',
            label: 'SNR',
            type: 'float',
            default: 2.0,
            min: 0,
            step: 0.1,
            hint: 'Signal-to-noise threshold',
          },
          {
            key: 'return_type',
            label: 'Return',
            type: 'select',
            default: 'height',
            options: [
              { label: 'Height', value: 'height' },
              { label: 'Area', value: 'area' },
            ],
          },
          {
            key: 'width',
            label: 'Width',
            type: 'number',
            default: 5,
            min: 1,
            hint: 'Peak width (data points)',
          },
        ],
      },
    ],
  },
  {
    key: 'align',
    title: 'Peak Alignment',
    hint: 'Align peaks across spectra',
    methods: [
      {
        id: 'align_py',
        label: 'Python Backend',
        params: [
          {
            key: 'tolerance',
            label: 'Tolerance',
            type: 'text',
            hint: 'Positive number or empty=auto',
          },
          {
            key: 'units',
            label: 'Units',
            type: 'select',
            default: 'ppm',
            options: [
              { label: 'ppm', value: 'ppm' },
              { label: 'Da', value: 'Da' },
            ],
          },
          {
            key: 'binfun',
            label: 'Bin Function',
            type: 'select',
            default: 'median',
            options: [
              { label: 'Median', value: 'median' },
              { label: 'Mean', value: 'mean' },
              { label: 'Min', value: 'min' },
              { label: 'Max', value: 'max' },
            ],
          },
          { key: 'binratio', label: 'Bin Ratio', type: 'float', default: 2.0, min: 0, step: 0.1 },
        ],
      },
    ],
  },
]

const methodRulesByMode: Record<string, string[]> = {
  profile_continuous: ['noise', 'baseline', 'norm', 'pick', 'align'],
  profile_processed: ['noise', 'baseline', 'norm', 'pick', 'align'],
  centroid_continuous: ['norm', 'align'],
  centroid_processed: ['norm', 'align'],
}

function resolveModeKey(spectrumMode: string, storageMode: string): string {
  const s = (spectrumMode || 'profile').toLowerCase()
  const t = (storageMode || 'continuous').toLowerCase()
  return `${s}_${t}`
}

export function usePreprocessingMethods(
  // Arguments
  spectrumMode: Ref<string>,
  storageMode: Ref<string>,
) {
  // Computed
  const modeKey = computed(() => resolveModeKey(spectrumMode.value, storageMode.value))

  const isFiltered = computed(() => {
    const allowed = methodRulesByMode[modeKey.value]
    return !!allowed && allowed.length < allMethodGroups.length
  })

  const modeNotice = computed(() => {
    if (!isFiltered.value) return ''
    const s = spectrumMode.value || 'profile'
    const t = storageMode.value || 'continuous'
    return `This dataset is ${s} + ${t}. Only compatible preprocessing methods are shown.`
  })

  const availableMethods = computed<MethodGroup[]>(() => {
    const allowed = methodRulesByMode[modeKey.value]
    if (!allowed) return allMethodGroups
    return allMethodGroups.filter((g) => allowed.includes(g.key))
  })

  return { availableMethods, isFiltered, modeNotice }
}
