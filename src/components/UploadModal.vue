<template>
<dialog class="modal" :class="{ 'modal-open': isOpen }">
<div class="modal-box w-11/12 max-w-2xl">
<h3 class="font-bold text-lg mb-4">Upload New Dataset (imzML + ibd)</h3>

<!-- File selection & Metadata form -->
<div v-if="stage === 'select'" class="flex flex-col gap-4">
<label class="form-control w-full">
<div class="label">
<span class="label-text">Select an .imzML and .ibd file pair</span>
<span class="label-text-alt text-error" v-if="error">{{ error }}</span>
</div>
<div class="relative flex items-center justify-between border border-base-content/20 rounded-lg px-3 py-2 bg-base-100 hover:bg-base-200/50 transition-colors overflow-hidden h-12">
<input type="file" multiple accept=".imzml,.ibd" @change="onFileChange" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Select files" />
<div class="flex items-center gap-3 w-full pointer-events-none">
<div class="btn btn-sm btn-neutral no-animation shrink-0">Choose Files</div>  
<span class="text-sm truncate w-full opacity-80" :class="{'opacity-50': !selectedPair}">{{ selectedPair ? `${selectedPair.imzml.name}, ${selectedPair.ibd.name}` : 'No file chosen' }}</span>
</div>
</div>
<div class="label mt-1 text-sm">
<span v-if="selectedPair" class="text-success">Ready: {{ selectedPair.baseName }} ({{ formattedSize }})</span>
<span v-else class="text-base-content/60">No matched pair selected</span>
</div>
</label>

<!-- Immediately available Metadata form -->
<div class="space-y-4">
<div class="grid grid-cols-1 gap-4 pb-32">
  <div class="flex flex-col">
    <label class="label"><span class="label-text">Experiment Type</span></label>
    <DropdownSelect v-model="form.experiment_type" :options="EXPERIMENT_TYPES" placeholder="Select type..." />
    <input v-if="form.experiment_type === 'Other'" v-model="otherInputs.experiment_type" class="input input-bordered input-sm w-full mt-1" placeholder="Please specify..." />
  </div>

  <div class="flex flex-col">
    <label class="label"><span class="label-text">Organism</span></label>
    <DropdownSelect v-model="form.organism" :options="ORGANISMS" placeholder="Select organism..." />
    <input v-if="form.organism === 'Other'" v-model="otherInputs.organism" class="input input-bordered input-sm w-full mt-1" placeholder="Please specify..." />
  </div>

  <div class="flex flex-col">
    <label class="label"><span class="label-text">Organism Part</span></label>
    <DropdownSelect v-model="form.organism_part" :options="ORGANISM_PARTS" placeholder="Select part..." />
    <input v-if="form.organism_part === 'Other'" v-model="otherInputs.organism_part" class="input input-bordered input-sm w-full mt-1" placeholder="Please specify..." />
  </div>

  <div class="flex flex-col">
    <label class="label"><span class="label-text">Condition (Multi-select)</span></label>
    <DropdownSelect v-model="form.condition" :options="CONDITIONS" placeholder="Select condition..." :multiple="true" />
    <input v-if="form.condition.includes('Other')" v-model="otherInputs.condition" class="input input-bordered input-sm w-full mt-1" placeholder="Please specify..." />
  </div>

  <div class="flex flex-col">
    <label class="label"><span class="label-text">Sample Growth Conditions (Multi-select)</span></label>
    <DropdownSelect v-model="form.sample_growth_conditions" :options="SAMPLE_GROWTH_CONDITIONS" placeholder="Select growth..." :multiple="true" />
    <input v-if="form.sample_growth_conditions.includes('Other')" v-model="otherInputs.sample_growth_conditions" class="input input-bordered input-sm w-full mt-1" placeholder="Please specify..." />
  </div>

  <div class="flex flex-col">
    <label class="label"><span class="label-text">Sample Stabilization</span></label>
    <DropdownSelect v-model="form.sample_stabilization" :options="SAMPLE_STABILIZATIONS" placeholder="Select stabilization..." />
    <input v-if="form.sample_stabilization === 'Other'" v-model="otherInputs.sample_stabilization" class="input input-bordered input-sm w-full mt-1" placeholder="Please specify..." />
  </div>

  <div class="flex flex-col">
    <label class="label"><span class="label-text">Tissue Modification (Multi-select)</span></label>
    <DropdownSelect v-model="form.tissue_modification" :options="TISSUE_MODIFICATIONS" placeholder="Select modification..." :multiple="true" />
    <input v-if="form.tissue_modification.includes('Other')" v-model="otherInputs.tissue_modification" class="input input-bordered input-sm w-full mt-1" placeholder="Please specify..." />
  </div>

  <div class="flex flex-col">
    <label class="label"><span class="label-text">MALDI Matrix</span></label>
    <DropdownSelect v-model="form.maldi_matrix" :options="MALDI_MATRICES" placeholder="Select matrix..." />
    <input v-if="form.maldi_matrix === 'Other'" v-model="otherInputs.maldi_matrix" class="input input-bordered input-sm w-full mt-1" placeholder="Please specify..." />
  </div>

  <div class="flex flex-col">
    <label class="label"><span class="label-text">MALDI Matrix Application</span></label>
    <DropdownSelect v-model="form.maldi_matrix_application" :options="MALDI_MATRIX_APPLICATIONS" placeholder="Select application..." />
    <input v-if="form.maldi_matrix_application === 'Other'" v-model="otherInputs.maldi_matrix_application" class="input input-bordered input-sm w-full mt-1" placeholder="Please specify..." />
  </div>

  <div class="flex flex-col">
    <label class="label"><span class="label-text">Solvent (Multi-select)</span></label>
    <DropdownSelect v-model="form.solvent" :options="SOLVENTS" placeholder="Select solvent..." :multiple="true" />
    <input v-if="form.solvent.includes('Other')" v-model="otherInputs.solvent" class="input input-bordered input-sm w-full mt-1" placeholder="Please specify..." />
  </div>
</div>
</div>

<div class="flex items-center gap-2 mt-2">
<button class="btn bg-blue-600 text-white hover:bg-blue-700 border-none" @click="confirmAndUpload" :disabled="!selectedPair || uploading">Confirm & Upload</button>
<button class="btn btn-ghost" @click="closeModal" :disabled="uploading">Cancel</button>
</div>
</div>

<!-- Uploading progress pipeline -->
<div v-if="stage === 'uploading'" class="flex flex-col items-center gap-4 py-8">
<div class="w-full">
<div class="flex justify-between text-sm mb-2 font-medium">
<span class="text-base-content/80">{{ uploadMessage }}</span>
<span class="text-primary">{{ progress }}%</span>
</div>
<progress class="progress progress-primary w-full h-3" :value="progress" max="100"></progress>
      <!-- Additional Speed and ETA display -->
      <div v-if="speed || eta" class="flex justify-between items-center w-full mt-2 text-xs text-base-content/60 bg-base-200/50 py-1.5 px-3 rounded">
        <div v-if="speed" class="flex items-center">
          ⚡ {{ speed }}
        </div>
        <div v-if="eta" class="flex items-center">
          ⏱️ ETA: {{ eta }}
        </div>
      </div>
    </div>
    <div class="w-full flex justify-end mt-4">
<button class="btn btn-outline btn-error btn-sm" @click="abortUpload">Abort Upload</button>
</div>
</div>

<!-- Success State -->
<div v-if="stage === 'success'" class="flex flex-col flex-center items-center py-10 gap-4">
<div class="text-success text-2xl font-bold">Upload Complete!</div>
<button class="btn bg-blue-600 text-white hover:bg-blue-700 border-none mt-4" @click="toDatasets">View Datasets</button>
</div>


</div>
<form method="dialog" class="modal-backdrop"><button @click="closeModal" :disabled="stage === 'uploading'">close</button></form>
</dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useToast } from '@/utils/toast';
import { useRouter } from 'vue-router';
import { uploadImzmlZipFile, type ImzmlFilePair, type UnifiedUploadProgress } from '@/utils/imzml-helper';
import DropdownSelect from './DropdownSelect.vue';
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
  SOLVENTS
} from '@/constants/dataset-metadata';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{
(e: 'close'): void;
(e: 'upload-success'): void;
}>();

const { showToast } = useToast();
const router = useRouter();

const speed = ref('');
const eta = ref('');

const selectedPair = ref<ImzmlFilePair | null>(null);
const uploading = ref(false);
const progress = ref(0);
const uploadMessage = ref('');
const error = ref('');
const stage = ref<'select' | 'uploading' | 'success'>('select');
let abortController: AbortController | null = null;

const form = ref({
  experiment_type: 'imzML',
  organism: '',
  organism_part: '',
  condition: [] as string[],
  sample_growth_conditions: [] as string[],
  sample_stabilization: '',
  tissue_modification: [] as string[],
  maldi_matrix: '',
  maldi_matrix_application: '',
  solvent: [] as string[]
});

const otherInputs = ref({
  experiment_type: '',
  organism: '',
  organism_part: '',
  condition: '',
  sample_growth_conditions: '',
  sample_stabilization: '',
  tissue_modification: '',
  maldi_matrix: '',
  maldi_matrix_application: '',
  solvent: ''
});

const formattedSize = computed(() => {
if (!selectedPair.value) return '';
const bytes = selectedPair.value.ibd.size + selectedPair.value.imzml.size;
if (bytes === 0) return '0 B';
const k = 1024;
const sizes = ['B','KB','MB','GB','TB'];
const i = Math.floor(Math.log(bytes) / Math.log(k));
return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

function resetAll() {
  selectedPair.value = null;
  uploading.value = false;
  progress.value = 0;
  speed.value = '';
  eta.value = '';
  uploadMessage.value = '';
  error.value = '';
  stage.value = 'select';
  abortController = null;
  Object.assign(form.value, {
    experiment_type: 'imzML',
    organism: '',
    organism_part: '',
    condition: [],
    sample_growth_conditions: [],
    sample_stabilization: '',
    tissue_modification: [],
    maldi_matrix: '',
    maldi_matrix_application: '',
    solvent: []
  });
  Object.keys(otherInputs.value).forEach(k => {
    (otherInputs.value as any)[k] = '';
  });
}


const closeModal = () => {
if (uploading.value) return;
emit('close');
resetAll();
};

const toDatasets = () => {
closeModal();
router.push({ name: 'MyDatasets' });
};

const onFileChange = (e: Event) => {
const input = e.target as HTMLInputElement;
const files = input.files;
if (!files || files.length === 0) return;

let ibd: File | undefined;
let imzml: File | undefined;

    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f) continue;
        if (f.name.toLowerCase().endsWith('.ibd')) ibd = f;
        if (f.name.toLowerCase().endsWith('.imzml')) imzml = f;
    }

if (!ibd || !imzml) {
showToast('Please select BOTH an .ibd and .imzml file simultaneously.', 'error');
selectedPair.value = null;
input.value = '';
return;
}

const base2 = imzml.name.substring(0, imzml.name.lastIndexOf('.'));

    error.value = '';
    selectedPair.value = { ibd, imzml, baseName: base2 };
};

const abortUpload = () => {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
};

const confirmAndUpload = async () => {
if (!selectedPair.value) return;

uploading.value = true;
stage.value = 'uploading';
progress.value = 0;
uploadMessage.value = 'Initializing Pipeline...';
error.value = '';

abortController = new AbortController();

try {
        const payload: Record<string, string> = {};
        Object.keys(form.value).forEach((key) => {
          const k = key as keyof typeof form.value;
          const val = form.value[k] as any;
          if (Array.isArray(val)) {
            const others = val.includes('Other') ? [(otherInputs.value as any)[k]] : [];
            payload[k] = val.filter(v => v !== 'Other').concat(others).filter(Boolean).join(', ');
          } else {
            payload[k] = val === 'Other' ? (otherInputs.value as any)[k] : val;
          }
        });

        await uploadImzmlZipFile({
            files: selectedPair.value,
            datasetName: selectedPair.value.baseName,
            metadata: { ...payload, file_type: 'zip', storage_type: 'local' },
            signal: abortController.signal,
            onProgress: (p: UnifiedUploadProgress) => {
                progress.value = p.percent;
                uploadMessage.value = p.message || `Stage: ${p.stage}`;
                speed.value = p.speedStr || '';
                eta.value = p.etaStr || '';

                // Show underlying warnings/retries on the progress bar for the user
                if (p.message?.includes('Fail') || p.message?.includes('Retrying')) {
                     error.value = p.message;
                }
            }
        });

showToast('Dataset pipeline successfully completed', 'success');
emit('upload-success');
stage.value = 'success';
} catch (err: any) {
console.error('Upload pipeline failed', err);
        if (err.name === 'AbortError') {
            showToast('Upload safely aborted', 'info');
    error.value = 'User aborted upload';
        } else {
    error.value = err.message || 'Pipeline sequence failed';
    showToast(error.value, 'error');
        }
stage.value = 'select';
} finally {
uploading.value = false;
        abortController = null;
}
};
</script>