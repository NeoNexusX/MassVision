<template>
  <div class="p-6 max-w-screen-2xl mx-auto">
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-3xl font-semibold">Create New Analysis</h1>
        <p class="text-base text-base-content/60 mt-1">Configure preprocessing pipeline for MSI datasets</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Main column -->
      <div class="lg:col-span-3 space-y-6">
        <!-- Step 1: Data Source -->
        <section class="bg-white rounded-lg border border-base-200 p-6 shadow-sm">
          <h2 class="text-xl font-medium mb-4">Step 1: Data Source</h2>
          <div class="tabs mb-4">
            <a :class="['tab', activeTab === 'upload' ? 'tab-active' : '']" @click.prevent="activeTab = 'upload'">Upload</a>
            <a :class="['tab', activeTab === 'my' ? 'tab-active' : '']" @click.prevent="activeTab = 'my'">My Datasets</a>
          </div>

          <div v-if="activeTab === 'upload'">
            <div class="mt-3">
              <button class="btn btn-primary" @click="uploadOpen = true">Open Uploader</button>
            </div>
            <UploadModal :isOpen="uploadOpen" @upload-success="onUploadSuccess" @close="onUploadClose" />
          </div>

          <div v-if="activeTab === 'my'">
            <div class="mb-2">
              <input v-model="datasetQuery" placeholder="Search datasets" class="input input-bordered w-full" />
            </div>
            <div class="max-h-48 overflow-auto border border-base-200 bg-base-100 rounded-md p-2">
              <div v-if="loading" class="flex items-center justify-center p-4">
                <span class="loading loading-spinner loading-md"></span>
              </div>
              <div v-else>
                <div v-if="error" class="text-sm text-error p-3">{{ error }}</div>
                <ul>
                  <li v-for="d in filteredDatasets" :key="d.id" :class="['px-4 py-2 cursor-pointer flex items-center justify-between', selectedDataset?.id === d.id ? 'bg-base-200' : 'hover:bg-base-100']" @click="selectDataset(d)">
                    <div class="flex-1 mr-4">
                      <div class="flex items-center justify-between gap-4">
                        <div class="font-medium truncate">{{ d.name }}</div>
                        <div class="text-sm text-base-content/60 ml-2">{{ formatBytes(d.sizeBytes) }}</div>
                      </div>
                      <div class="text-xs text-base-content/60">{{ d.filename || d.submitTime || '–' }}</div>
                    </div>
                    <input type="radio" name="selectedDataset" :checked="selectedDataset?.id===d.id" />
                  </li>
                </ul>
                <div v-if="filteredDatasets.length === 0" class="text-sm text-base-content/60 p-3">No datasets found.</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Step 2: Preprocessing Pipeline (builder) -->
        <details open class="bg-white rounded-lg border border-base-200 p-6 shadow-sm">
          <summary class="text-xl font-medium mb-4 list-none">Step 2: Preprocessing Pipeline</summary>

          <div class="space-y-4 mt-2">
            <div v-for="group in methodGroups" :key="group.key" class="border border-base-200 rounded-md p-4">
              <div>
                <div class="flex items-center justify-between">
                  <div class="font-medium text-base">{{ group.title }}</div>
                </div>
                <div v-if="group.hint" class="text-xs text-base-content/60 mt-1">{{ group.hint }}</div>
              </div>
              <div class="mt-3 flex flex-wrap gap-3">
                <div v-for="m in group.methods" :key="m.id" class="flex flex-col">
                  <label
                    :class="[
                      'flex items-center gap-2 h-10 px-4 rounded-md text-sm transition-colors cursor-pointer select-none',
                      isSelected(group.key, m.id)
                        ? 'bg-blue-50 border border-blue-200 text-blue-800'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    ]"
                    @click="toggleSingle(group.key, m.id, $event)"
                  >
                    <input
                      type="radio"
                      class="sr-only"
                      :name="group.key"
                      :value="m.id"
                      :checked="isSelected(group.key, m.id)"
                    />
                    <span v-if="isSelected(group.key, m.id)" class="text-blue-700">✔</span>
                    <span class="truncate">{{ m.label }}</span>
                    <span v-if="m.note" class="ml-2 text-xs text-base-content/50">{{ m.note }}</span>
                  </label>
                  <!-- Parameter inputs (shown when selected) -->
                  <div v-if="isSelected(group.key, m.id) && m.params?.length" class="mt-2 ml-4 grid grid-cols-2 gap-2">
                    <div v-for="p in m.params" :key="p.key" class="flex items-center gap-2">
                      <span class="text-xs text-base-content/60 w-20 shrink-0" :title="p.hint">{{ p.label }}</span>
                      <template v-if="p.type === 'select'">
                        <select
                          class="select select-xs select-bordered flex-1 text-xs"
                          :value="getParam(group.key, m.id, p.key)"
                          @change="methodParams[buildParamKey(group.key, m.id, p.key)] = ($event.target as HTMLSelectElement).value"
                        >
                          <option v-for="o in p.options" :key="o.value" :value="o.value">{{ o.label }}</option>
                        </select>
                      </template>
                      <template v-else-if="p.type === 'text'">
                        <input
                          class="input input-xs input-bordered flex-1 text-xs font-mono"
                          type="text"
                          :placeholder="String(p.default ?? '')"
                          :value="getParam(group.key, m.id, p.key)"
                          @input="methodParams[buildParamKey(group.key, m.id, p.key)] = ($event.target as HTMLInputElement).value"
                        />
                      </template>
                      <template v-else>
                        <input
                          class="input input-xs input-bordered flex-1 text-xs font-mono"
                          type="number"
                          :placeholder="String(p.default ?? '')"
                          :min="p.min"
                          :step="p.step ?? 1"
                          :value="getParam(group.key, m.id, p.key)"
                          @input="methodParams[buildParamKey(group.key, m.id, p.key)] = +($event.target as HTMLInputElement).value"
                        />
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- Step 3: Annotation Settings (collapsed) -->
        <details class="bg-white rounded-lg border border-base-200 p-6 shadow-sm">
          <summary class="text-xl font-medium mb-2 list-none">Step 3: Annotation Settings</summary>
          <div class="mt-4 text-sm text-base-content/60">Annotation settings placeholder</div>
        </details>
      </div>

      <!-- Right column: summary (sticky) -->
      <aside class="lg:col-span-1">
        <div class="sticky top-6">
          <div class="rounded-lg border border-base-200 bg-white shadow-sm overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 pt-5 pb-3">
              <div class="text-xl font-semibold">Analysis Summary</div>
              <span :class="statusBadge.cls + ' text-xs'">{{ statusBadge.text }}</span>
            </div>

            <!-- Preprocessing -->
            <div class="border-t border-base-200/70 px-5 py-4">
              <div class="text-sm font-medium text-base-content/60 mb-2">Preprocessing</div>
              <ul class="space-y-3">
                <li v-for="p in pipelineSummary" :key="p.key">
                  <div class="text-sm font-medium text-base-content">{{ p.title }}</div>
                  <div class="flex items-center justify-between mt-0.5 pl-3">
                    <span class="text-sm text-base-content/60">{{ p.present ? p.method : '—' }}</span>
                    <span v-if="p.present" class="text-xs text-blue-500">✓</span>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Dataset Metadata -->
            <div v-if="msSettingsList.length" class="border-t border-base-200/70 px-5 py-4">
              <div class="text-sm font-medium text-base-content/60 mb-2">Dataset metadata</div>
              <ul class="space-y-1.5">
                <li v-for="s in msSettingsList" :key="s.key" class="flex items-baseline justify-between gap-3">
                  <span class="text-sm font-medium text-base-content shrink-0">{{ s.label }}</span>
                  <span class="text-sm text-base-content/60 text-right min-w-0 break-all">{{ s.value }}</span>
                </li>
              </ul>
            </div>

            <!-- Selected Dataset -->
            <div class="border-t border-base-200/70 px-5 py-4">
              <div class="text-sm font-medium text-base-content/60 mb-2">Selected dataset</div>
              <div v-if="selectedDataset">
                <div class="text-sm font-medium text-base-content break-all leading-snug">{{ selectedDataset.name }}</div>
                <div class="text-xs text-base-content/50 mt-1">{{ formatBytes(selectedDataset.sizeBytes) }}</div>
              </div>
              <div v-else class="text-sm text-base-content/40">No dataset selected</div>
            </div>

            <!-- Estimated Time & Quota -->
            <div class="border-t border-base-200/70 px-5 py-4">
              <div class="text-sm font-medium text-base-content/60 mb-2">Est. time</div>
              <div class="text-sm font-medium text-base-content">{{ estimateTimeDisplay }}</div>
              <div class="text-xs text-base-content/50 mt-2 space-y-1">
                <div class="flex items-center justify-between">
                  <span>Storage</span>
                  <span class="text-base-content font-medium">{{ quotaStorage }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Running tasks</span>
                  <span class="text-base-content font-medium">{{ quotaTasks }}</span>
                </div>
              </div>
            </div>

            <!-- Start button -->
            <div class="border-t border-base-200/70 px-5 py-4">
              <button
                :class="['btn btn-primary w-full h-12 text-base font-semibold', !canSubmit ? 'opacity-60 cursor-not-allowed' : '']"
                @click="submit"
                :disabled="!canSubmit"
              >
                Start Analysis
              </button>
              <div v-if="!canSubmit" class="text-xs text-base-content/50 mt-2 text-center">Select dataset and configure pipeline first</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const authStore = useAuthStore()

import { onMounted, watch } from 'vue'
import { useDatasets } from '@/composables/useDatasets'
import { listUserFiles, getUserQuota, type UserQuota } from '@/utils/file-api'
import UploadModal from '@/components/UploadModal.vue'
import { useAuthStore } from '@/stores/auth'

const activeTab = ref<'upload'|'my'>('my')
const datasetQuery = ref('')
const selectedDataset = ref<any>(null)
// selected methods organized by group key
// selected methods: for groups with multiple=true we store an array, otherwise a single string
const selectedMethods = reactive<Record<string, string>>({})

// method parameters stored flat: "groupKey.methodId.paramKey" → value
const methodParams = reactive<Record<string, string | number>>({
  'noise.savgol_numba.window': 5,
  'noise.savgol_numba.polyorder': 3,
  'noise.savgol_numba.deriv': 0,
  'noise.savgol_numba.delta': 1.0,
  'noise.gaussian_numba.window': 5,
  'noise.gaussian_numba.sd': 2.0,
  'noise.ma_numba.window': 5,
  'norm.tic_numba.scale': 1.0,
  'norm.rms_numba.scale': 1.0,
  'norm.ref_numba.scale': 1.0,
  'norm.ref_numba.ref': '' as string | number,
  'norm.ref_numba.ref_tolerance': 0.1,
  'pick.diff.method': 'diff',
  'pick.diff.snr': 2.0,
  'pick.diff.return_type': 'height',
  'pick.diff.width': 5,
  'align.align_py.tolerance': '' as string | number,
  'align.align_py.units': 'ppm',
  'align.align_py.binfun': 'median',
  'align.align_py.binratio': 2.0,
  'align.align_cardinal.tolerance': '' as string | number,
  'align.align_cardinal.units': 'ppm',
  'align.align_cardinal.binfun': 'median',
  'align.align_cardinal.binratio': 2.0,
})

// MS Analysis form 
const analysisForm = reactive({
  polarity: '' as 'positive' | 'negative' | '',
  ionSource: '' as string,
  analyzer: '' as string,
  pixelSizeX: '' as string,
  pixelSizeY: '' as string
})

const autoFilled = reactive({
  polarity: false,
  ionSource: false,
  analyzer: false,
  pixelSize: false
})

function tryAutoFill() {
  // reset auto flags
  Object.keys(autoFilled).forEach(k => (autoFilled as any)[k] = false)
  if (!selectedDataset.value) return
  const ds = selectedDataset.value

  // always reset before filling so stale values from previous dataset don't linger
  analysisForm.polarity = ''
  analysisForm.ionSource = ''
  analysisForm.analyzer = ''
  analysisForm.pixelSizeX = ''
  analysisForm.pixelSizeY = ''

  // polarity
  const pol = (ds.polarity || '').toString().toLowerCase()
  if (pol) {
    analysisForm.polarity = pol.includes('neg') ? 'negative' : 'positive'
    autoFilled.polarity = true
  }

  // ion source
  const src = (ds.ionSource || '').toString().toLowerCase()
  if (src) {
    if (src.includes('maldi')) { analysisForm.ionSource = 'MALDI'; autoFilled.ionSource = true }
    else if (src.includes('desi')) { analysisForm.ionSource = 'DESI'; autoFilled.ionSource = true }
    else if (src.includes('sims')) { analysisForm.ionSource = 'SIMS'; autoFilled.ionSource = true }
    else { analysisForm.ionSource = ds.ionSource; autoFilled.ionSource = true }
  }

  // analyzer
  const ana = (ds.analyzer || '').toString().toLowerCase()
  if (ana) {
    if (ana.includes('orbit')) { analysisForm.analyzer = 'Orbitrap'; autoFilled.analyzer = true }
    else if (ana.includes('ft') || ana.includes('fticr')) { analysisForm.analyzer = 'FTICR'; autoFilled.analyzer = true }
    else if (ana.includes('q') && ana.includes('tof')) { analysisForm.analyzer = 'Q-TOF'; autoFilled.analyzer = true }
    else if (ana.includes('tof')) { analysisForm.analyzer = 'TOF'; autoFilled.analyzer = true }
    else { analysisForm.analyzer = ds.analyzer; autoFilled.analyzer = true }
  }

  // pixel size
  if (ds.pixelSizeHorizontal != null) { analysisForm.pixelSizeX = String(ds.pixelSizeHorizontal); autoFilled.pixelSize = true }
  if (ds.pixelSizeVertical != null) { analysisForm.pixelSizeY = String(ds.pixelSizeVertical); autoFilled.pixelSize = true }
}

// clear auto-filled flag when user edits
watch(analysisForm, (n, o) => {
  ;(Object.keys(autoFilled) as Array<keyof typeof autoFilled>).forEach(k => {
    if ((o as any)[k] && (n as any)[k] !== (o as any)[k]) (autoFilled as any)[k] = false
  })
}, { deep: true })

export interface ParamDef {
  key: string;
  label: string;
  type: 'number' | 'select' | 'text' | 'float';
  default?: any;
  options?: { label: string; value: any }[];
  min?: number;
  step?: number;
  hint?: string;
}

function buildParamKey(groupKey: string, methodId: string, paramKey: string) {
  return `${groupKey}.${methodId}.${paramKey}`
}

function getParam(groupKey: string, methodId: string, paramKey: string): string | number | undefined {
  return methodParams[buildParamKey(groupKey, methodId, paramKey)]
}

const methodGroups: Array<any> = [
  {
    key: 'noise',
    title: 'Noise Reduction',
    hint: 'Reduce noise while preserving peaks',
    methods: [
      {
        id: 'savgol_numba', label: 'Savitzky–Golay',
        params: [
          { key: 'window', label: 'Window', type: 'number', default: 5, min: 1, hint: 'Filter window size' },
          { key: 'polyorder', label: 'Polyorder', type: 'number', default: 3, min: 0, hint: 'Polynomial order' },
          { key: 'deriv', label: 'Derivative', type: 'number', default: 0, min: 0, hint: 'Derivative order (0=smooth)' },
          { key: 'delta', label: 'Delta', type: 'float', default: 1.0, min: 0, step: 0.1, hint: 'Sample spacing' },
        ]
      },
      {
        id: 'gaussian_numba', label: 'Gaussian',
        params: [
          { key: 'window', label: 'Window', type: 'number', default: 5, min: 1 },
          { key: 'sd', label: 'Sigma', type: 'float', default: 2.0, min: 0, step: 0.1, hint: 'Gaussian std deviation' },
        ]
      },
      {
        id: 'ma_numba', label: 'Moving Average',
        params: [
          { key: 'window', label: 'Window', type: 'number', default: 5, min: 1 },
        ]
      }
    ]
  },
  {
    key: 'baseline',
    title: 'Baseline Correction',
    hint: 'Remove baseline to correct background signal',
    methods: [
      { id: 'snip_numba', label: 'SNIP', params: [] },
      { id: 'locmin_numba', label: 'Local Minimum', params: [] }
    ]
  },
  {
    key: 'norm',
    title: 'Normalization',
    hint: 'Scale spectra to comparable intensities',
    methods: [
      {
        id: 'tic_numba', label: 'TIC',
        params: [
          { key: 'scale', label: 'Scale', type: 'float', default: 1.0, min: 0, step: 1, hint: 'Output scaling factor' },
        ]
      },
      {
        id: 'rms_numba', label: 'RMS',
        params: [
          { key: 'scale', label: 'Scale', type: 'float', default: 1.0, min: 0, step: 1, hint: 'Output scaling factor' },
        ]
      },
      {
        id: 'ref_numba', label: 'REF',
        params: [
          { key: 'scale', label: 'Scale', type: 'float', default: 1.0, min: 0, step: 1 },
          { key: 'ref', label: 'Ref m/z', type: 'text', hint: 'Reference m/z (auto if empty)' },
          { key: 'ref_tolerance', label: 'Ref Tolerance', type: 'float', default: 0.1, min: 0, step: 0.01 },
        ]
      }
    ]
  },
  {
    key: 'pick',
    title: 'Peak Picking',
    hint: 'Detect peaks in spectra',
    methods: [
      {
        id: 'diff', label: 'Standard Peak Detection',
        params: [
          { key: 'method', label: 'Method', type: 'select', default: 'diff', options: [
            { label: 'Differential (diff)', value: 'diff' },
            { label: 'Std Dev (sd)', value: 'sd' },
            { label: 'MAD', value: 'mad' },
            { label: 'Quantile', value: 'quantile' },
          ]},
          { key: 'snr', label: 'SNR', type: 'float', default: 2.0, min: 0, step: 0.1, hint: 'Signal-to-noise threshold' },
          { key: 'return_type', label: 'Return', type: 'select', default: 'height', options: [
            { label: 'Height', value: 'height' },
            { label: 'Area', value: 'area' },
          ]},
          { key: 'width', label: 'Width', type: 'number', default: 5, min: 1, hint: 'Peak width (data points)' },
        ]
      }
    ]
  },
  {
    key: 'align',
    title: 'Peak Alignment',
    hint: 'Align peaks across spectra',
    methods: [
      {
        id: 'align_py', label: 'Python Backend',
        params: [
          { key: 'tolerance', label: 'Tolerance', type: 'text', hint: 'Positive number or empty=auto' },
          { key: 'units', label: 'Units', type: 'select', default: 'ppm', options: [
            { label: 'ppm', value: 'ppm' },
            { label: 'Da', value: 'Da' },
          ]},
          { key: 'binfun', label: 'Bin Function', type: 'select', default: 'median', options: [
            { label: 'Median', value: 'median' },
            { label: 'Mean', value: 'mean' },
            { label: 'Min', value: 'min' },
            { label: 'Max', value: 'max' },
          ]},
          { key: 'binratio', label: 'Bin Ratio', type: 'float', default: 2.0, min: 0, step: 0.1 },
        ]
      },
      {
        id: 'align_cardinal', label: 'Cardinal Backend',
        params: [
          { key: 'tolerance', label: 'Tolerance', type: 'text', hint: 'Positive number or empty=auto' },
          { key: 'units', label: 'Units', type: 'select', default: 'ppm', options: [
            { label: 'ppm', value: 'ppm' },
            { label: 'Da', value: 'Da' },
          ]},
          { key: 'binfun', label: 'Bin Function', type: 'select', default: 'median', options: [
            { label: 'Median', value: 'median' },
            { label: 'Mean', value: 'mean' },
            { label: 'Min', value: 'min' },
            { label: 'Max', value: 'max' },
          ]},
          { key: 'binratio', label: 'Bin Ratio', type: 'float', default: 2.0, min: 0, step: 0.1 },
        ]
      }
    ]
  }
]

// initialize selectedMethods keys based on groups
methodGroups.forEach(g => { selectedMethods[g.key] = '' })

function isSelected(groupKey: string, methodId: string) {
  return selectedMethods[groupKey] === methodId
}

function toggleSingle(groupKey: string, methodId: string, event?: MouseEvent) {
  event?.preventDefault()
  if (isSelected(groupKey, methodId)) {
    selectedMethods[groupKey] = ''
  } else {
    selectedMethods[groupKey] = methodId
  }
}

function getMethodLabel(groupKey: string, id: string) {
  const g = methodGroups.find((x: any) => x.key === groupKey)
  const m = g?.methods?.find((mm: any) => mm.id === id)
  return m?.label || id
}

// wire to backend using useDatasets + listUserFiles
const { datasets, loading, error, fetchFiles } = useDatasets((f, p, s) => listUserFiles(f, p, s))

const filteredDatasets = computed(() => {
  const q = datasetQuery.value.trim().toLowerCase()
  if (!q) return datasets.value
  return datasets.value.filter(d => (d.name || '').toLowerCase().includes(q))
})

function selectDataset(d: any) { selectedDataset.value = d }
const uploadOpen = ref(false)
function onUpload(e: Event) { /* placeholder */ }

watch(activeTab, (v) => {
  if (v === 'upload') uploadOpen.value = true
})

// try auto-fill when dataset changes
watch(selectedDataset, () => { tryAutoFill() })

const onUploadSuccess = async () => {
  // re-fetch user files and select the latest
  await fetchFiles({ page: 1, size: 50 })
  const newest = datasets.value[0]
  if (newest) selectedDataset.value = newest
  uploadOpen.value = false
}

const onUploadClose = () => { uploadOpen.value = false }

onMounted(() => {
  fetchFiles({ page: 1, size: 50 }).catch(() => {})
  fetchQuota()
})

function formatBytes(bytes?: number): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB','MB','GB','TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

const totalSelectedCount = computed(() => {
  let sum = 0
  for (const v of Object.values(selectedMethods)) {
    if (v) sum += 1
  }
  return sum
})

const formattedPipeline = computed(() => {
  const parts: string[] = []
  for (const g of methodGroups) {
    const sel = selectedMethods[g.key]
    if (!sel) continue
    parts.push(`${g.title} (${getMethodLabel(g.key, sel)})`)
  }
  return parts.length ? parts.join(' → ') : ''
})
const estimateTime = computed(() => {
  if (totalSelectedCount.value === 0) return '—'
  return `${totalSelectedCount.value * 5} min (est.)`
})
const quota = ref<UserQuota | null>(null)
const quotaLoading = ref(false)

async function fetchQuota() {
  quotaLoading.value = true
  try {
    quota.value = await getUserQuota()
  } catch { /* ignore */ }
  finally { quotaLoading.value = false }
}

const quotaStorage = computed(() => {
  if (!quota.value) return '—'
  return `${formatBytes(quota.value.total_processed_size_bytes)} / ${quota.value.max_processing_size_gb} GB`
})
const quotaTasks = computed(() => {
  if (!quota.value) return '—'
  return `${quota.value.file_count} / ${quota.value.max_files_per_user}`
})

const canSubmit = computed(() => {
  const hasDataset = !!selectedDataset.value
  const hasMethods = totalSelectedCount.value > 0
  const hasPolarity = !!analysisForm.polarity
  return hasDataset && hasMethods && hasPolarity
})

const pipelineSummary = computed(() => {
  // show all method groups in order
  return methodGroups.map((g: any) => {
    const sel = selectedMethods[g.key]
    let methodLabel = ''
    let present = false
    if (typeof sel === 'string' && sel) { methodLabel = getMethodLabel(g.key, sel); present = true }
    return { key: g.key, title: g.title, method: methodLabel, present }
  })
})

const msSettingsList = computed(() => {
  const list: Array<{ key: string, label: string, value: string }>=[]
  if (analysisForm.polarity) list.push({ key: 'polarity', label: 'Polarity', value: analysisForm.polarity === 'positive' ? 'Positive' : 'Negative' })
  if (analysisForm.ionSource) list.push({ key: 'source', label: 'Ionisation Source', value: analysisForm.ionSource })
  if (analysisForm.analyzer) list.push({ key: 'analyzer', label: 'Analyzer', value: analysisForm.analyzer })
  const px = (analysisForm.pixelSizeX || '')
  const py = (analysisForm.pixelSizeY || '')
  if (px && py) list.push({ key: 'pixel', label: 'Pixel', value: `${px}×${py} μm` })
  else if (px) list.push({ key: 'pixel', label: 'Pixel', value: `${px} μm` })
  else if (py) list.push({ key: 'pixel', label: 'Pixel', value: `${py} μm` })
  // Dataset metadata from selected dataset
  const ds = selectedDataset.value
  if (ds?.organism) list.push({ key: 'organism', label: 'Organism', value: ds.organism })
  if (ds?.organismPart) list.push({ key: 'organismPart', label: 'Organism Part', value: ds.organismPart })
  if (ds?.condition) list.push({ key: 'condition', label: 'Condition', value: ds.condition })
  return list
})

const summaryReady = computed(() => {
  const base = !!selectedDataset.value && pipelineSummary.value.every((p: any) => p.present)
  const msReady = !!analysisForm.polarity
  return base && msReady
})

const statusBadge = computed(() => ({ text: summaryReady.value ? 'Ready' : 'Incomplete', cls: summaryReady.value ? 'badge badge-success' : 'badge badge-warning' }))

const estimateTimeDisplay = computed(() => {
  if (totalSelectedCount.value === 0) return 'Waiting for configuration'
  return `${totalSelectedCount.value * 3}–${totalSelectedCount.value * 5} min`
})

function submit() {
  if (!canSubmit.value) return

  // Build algorithms object matching backend API
  const algorithms: Record<string, any> = {}

  for (const g of methodGroups) {
    const sel = selectedMethods[g.key]
    if (!sel) continue
    const selectedIds = [sel]

    const backendKey: Record<string, string> = {
      noise: 'noise_reduction',
      baseline: 'baseline_correction',
      norm: 'normalization',
      pick: 'peak_pick',
      align: 'peak_align',
    }
    const key = backendKey[g.key]
    if (!key) continue
    const mid = selectedIds[0]

    if (g.key === 'baseline') {
      algorithms[key] = { method: mid }
      continue
    }

    // For non-baseline groups, use the first selected method's params
    const method = g.methods.find((m: any) => m.id === mid)
    if (!mid || !method) continue
    const params: Record<string, any> = {}

    if (g.key !== 'noise') {
      params.method = mid
    }

    if (method?.params) {
      for (const p of method.params) {
        const val = getParam(g.key, mid, p.key)
        // Empty optional values → null
        if ((p.type === 'text' || p.type === 'float') && (val === '' || val === undefined)) {
          params[p.key] = null
        } else {
          params[p.key] = val ?? p.default
        }
      }
    }

    // Auto-inject backend for peak_pick and peak_align
    if (key === 'peak_pick' || key === 'peak_align') {
      params.backend = 'python'
    }

    // For noise_reduction, method is the selected method ID
    if (g.key === 'noise') {
      params.method = mid
    }

    algorithms[key] = params
  }

  const payload = {
    file_id: selectedDataset.value?.id ?? 0,
    algorithms,
  }
  console.log('Submit analysis', payload)
  router.push('/workspace')
}
</script>
