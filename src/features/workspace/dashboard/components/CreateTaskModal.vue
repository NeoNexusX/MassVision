<template>
  <dialog class="modal" :open="open">
    <div class="modal-box w-11/12 max-w-2xl">
      <h3 class="font-bold text-lg">Create New Task</h3>

      <div class="mt-4 space-y-4">
        <label class="block">
          <span class="label">Select Dataset</span>
          <select class="select select-bordered w-full" v-model="selectedDataset">
            <option v-for="d in datasets" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </label>

        <label class="block">
          <span class="label">Preprocessing Methods</span>
          <div class="flex gap-2 flex-wrap">
            <label v-for="m in methods" :key="m" class="cursor-pointer">
              <input type="checkbox" class="checkbox" :value="m" v-model="selectedMethods" />
              <span class="ml-2">{{ m }}</span>
            </label>
          </div>
        </label>

        <div>
          <span class="label">Method Parameters</span>
          <div class="mt-2">
            <div v-for="m of selectedMethods" :key="m" class="mb-2">
              <div class="text-sm font-medium">{{ m }}</div>
              <input
                class="input input-bordered w-full mt-1"
                v-model="params[m]"
                placeholder="parameter JSON or value"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="$emit('update:open', false)">Cancel</button>
        <button class="btn btn-primary" @click="start">Start Processing</button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
defineProps<{ open: boolean }>()
const emit = defineEmits(['update:open', 'created'])

// demo datasets & standardized methods - replace with real data/composables
const datasets = ref([
  { id: 'DS1', name: 'Dataset 1' },
  { id: 'DS2', name: 'Dataset 2' },
])
const methods = [
  'TIC Normalization',
  'RMS Normalization',
  'Median Normalization',
  'Baseline Correction',
  'Gaussian Smoothing',
  'Median Filtering',
  'Savitzky–Golay Smoothing',
  'Peak Picking',
  'Spectral Alignment',
  'm/z Binning',
  'Log Intensity Transform',
  'm/z Recalibration',
]

const selectedDataset = ref(datasets.value[0]?.id ?? '')
const selectedMethods = ref<string[]>([])
const params = reactive<Record<string, string>>({})

watch(selectedMethods, (n) => {
  n.forEach((m) => {
    if (!(m in params)) params[m] = ''
  })
})

const start = () => {
  // basic payload
  const payload = {
    id: 't' + Date.now(),
    name: `Process ${selectedDataset.value}`,
    dataset: selectedDataset.value,
    methods: [...selectedMethods.value],
    status: 'Queued',
    progress: 0,
    created: new Date().toISOString(),
    params: { ...params },
  }
  emit('created', payload)
  emit('update:open', false)
}
</script>
