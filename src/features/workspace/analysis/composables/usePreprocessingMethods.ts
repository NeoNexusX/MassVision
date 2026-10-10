import { computed, type Ref } from 'vue'
import { t } from '@/i18n'

interface MethodParam {
  key: string
  label: string
  type: 'number' | 'float' | 'text' | 'select'
  default?: number | string
  min?: number
  max?: number
  step?: number
  /** 显示文字用 getter：常量表在模块加载时求值，写死字符串切语言后不会刷新 */
  hint?: () => string
  options?: Array<{ label: string; value: string }>
}

interface MethodItem {
  id: string
  label: string
  note?: string
  params?: MethodParam[]
}

/**
 * 方法组的标题与说明是界面文字，写成 getter，在模板 / computed 里调用才会随语言切换刷新。
 * 方法名（Savitzky–Golay、SNIP、TIC…）与参数名是算法术语，保持英文原样。
 */
export interface MethodGroup {
  key: string
  title: () => string
  hint: () => string
  methods: MethodItem[]
}

export const allMethodGroups: MethodGroup[] = [
  {
    key: 'noise',
    title: () => t('common.preprocessing.noiseReduction'),
    hint: () => t('workspace.pipeline.groupHint.noise'),
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
            hint: () => t('workspace.pipeline.paramHint.window'),
          },
          {
            key: 'polyorder',
            label: 'Polyorder',
            type: 'number',
            default: 3,
            min: 0,
            hint: () => t('workspace.pipeline.paramHint.polyorder'),
          },
          {
            key: 'deriv',
            label: 'Derivative',
            type: 'number',
            default: 0,
            min: 0,
            hint: () => t('workspace.pipeline.paramHint.deriv'),
          },
          {
            key: 'delta',
            label: 'Delta',
            type: 'float',
            default: 1.0,
            min: 0,
            step: 0.1,
            hint: () => t('workspace.pipeline.paramHint.delta'),
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
            hint: () => t('workspace.pipeline.paramHint.sigma'),
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
    title: () => t('common.preprocessing.baselineCorrection'),
    hint: () => t('workspace.pipeline.groupHint.baseline'),
    methods: [
      { id: 'snip_numba', label: 'SNIP', params: [] },
      { id: 'locmin_numba', label: 'Local Minimum', params: [] },
    ],
  },
  {
    key: 'norm',
    title: () => t('common.preprocessing.normalization'),
    hint: () => t('workspace.pipeline.groupHint.norm'),
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
            hint: () => t('workspace.pipeline.paramHint.scale'),
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
            hint: () => t('workspace.pipeline.paramHint.scale'),
          },
        ],
      },
      {
        id: 'ref_numba',
        label: 'REF',
        params: [
          { key: 'scale', label: 'Scale', type: 'float', default: 1.0, min: 0, step: 1 },
          { key: 'ref', label: 'Ref m/z', type: 'text', hint: () => t('workspace.pipeline.paramHint.ref') },
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
    title: () => t('common.preprocessing.peakPicking'),
    hint: () => t('workspace.pipeline.groupHint.pick'),
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
            hint: () => t('workspace.pipeline.paramHint.snr'),
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
            hint: () => t('workspace.pipeline.paramHint.width'),
          },
        ],
      },
    ],
  },
  {
    key: 'align',
    title: () => t('common.preprocessing.peakAlignment'),
    hint: () => t('workspace.pipeline.groupHint.align'),
    methods: [
      {
        id: 'align_py',
        label: 'Python Backend',
        params: [
          {
            key: 'binfun',
            label: 'Bin Function',
            type: 'select',
            default: 'min',
            options: [
              { label: 'Median', value: 'median' },
              { label: 'Mean', value: 'mean' },
              { label: 'Min', value: 'min' },
              { label: 'Max', value: 'max' },
            ],
          },
          {
            key: 'min_frequency',
            label: 'Min Frequency',
            type: 'float',
            default: 0.01,
            min: 0,
            max: 1,
            step: 0.01,
            hint: () => t('workspace.pipeline.paramHint.minFrequency'),
          },
        ],
      },
    ],
  },
]

/** 参数的扁平键：`组.方法.参数`，方法参数表与运行时表单/载荷共用同一拼法 */
export function buildParamKey(groupKey: string, methodId: string, paramKey: string): string {
  return `${groupKey}.${methodId}.${paramKey}`
}

/**
 * 由方法定义（{@link allMethodGroups} 中每个参数的 `default`）生成默认参数表。
 * 这样默认值只在方法定义处维护一次——新增方法/参数无需再到别处同步硬编码。
 * 无 `default` 的参数（如可选的 text 字段）回退为空串，与后端「空=自动」语义一致。
 */
export function buildDefaultMethodParams(): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  for (const group of allMethodGroups) {
    for (const method of group.methods) {
      for (const param of method.params ?? []) {
        params[buildParamKey(group.key, method.id, param.key)] = param.default ?? ''
      }
    }
  }
  return params
}

// align 的可用性取决于"当前是否存在尚未统一到公共 m/z 轴的峰"：
// - profile 数据本身还不是峰，需先选中 pick 生成峰列表后才需要（也才能）做 align；
// - centroid + processed：各像素的峰分别存储在自己的 m/z 轴上，彼此不一致，需要 align 统一到公共轴；
// - centroid + continuous：continuous 存储本身就代表所有像素共享同一条 m/z 轴，峰已等同于对齐过，align 不适用。
const methodRulesByMode: Record<string, string[]> = {
  profile_continuous: ['noise', 'baseline', 'norm', 'pick', 'align'],
  profile_processed: ['noise', 'baseline', 'norm', 'pick', 'align'],
  centroid_continuous: ['norm'],
  centroid_processed: ['norm', 'align'],
}

function resolveModeKey(spectrumMode: string, storageMode: string): string {
  const s = (spectrumMode || 'profile').toLowerCase()
  const t = (storageMode || 'continuous').toLowerCase()
  return `${s}_${t}`
}

export function usePreprocessingMethods(
  spectrumMode: Ref<string>,
  storageMode: Ref<string>,
  /** 可选：已选中的方法（reactive 对象），用于判断 align 是否需要 pick 配合 */
  selectedMethods?: Record<string, string>,
) {
  const modeKey = computed(() => resolveModeKey(spectrumMode.value, storageMode.value))

  const modeNotice = computed(() => {
    const spectrum = spectrumMode.value
    const storage = storageMode.value
    if (!spectrum && !storage) return ''
    const notices: string[] = []

    // 谱图 / 存储模式的取值（profile、continuous…）是专业术语，原样插进译文
    notices.push(
      t('workspace.pipeline.modeNotice', {
        spectrum: spectrum || 'profile',
        storage: storage || 'continuous',
      }),
    )

    const sMode = (spectrum || 'profile').toLowerCase()
    const tMode = (storage || 'continuous').toLowerCase()
    if (sMode === 'profile') {
      notices.push(t('workspace.pipeline.alignNeedsPick'))
    } else if (tMode === 'continuous') {
      notices.push(t('workspace.pipeline.alignNotApplicable'))
    }

    notices.push(t('workspace.pipeline.compatibleOnly'))
    return notices.join(' ')
  })

  const availableMethods = computed<MethodGroup[]>(() => {
    // 未选数据集：显示全部方法
    if (!spectrumMode.value && !storageMode.value) return allMethodGroups
    const allowed = methodRulesByMode[modeKey.value]
    if (!allowed) return allMethodGroups

    return allMethodGroups.filter((g) => {
      if (!allowed.includes(g.key)) return false

      // profile 模式下，align 需要 pick 已选中才显示（centroid 数据本身即为峰，无需该限制）
      if (g.key === 'align' && (spectrumMode.value || 'profile').toLowerCase() === 'profile') {
        return !!selectedMethods?.['pick']
      }

      return true
    })
  })

  return { availableMethods, modeNotice }
}
