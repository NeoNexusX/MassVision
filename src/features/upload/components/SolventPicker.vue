<template>
  <div class="flex flex-col gap-2">
    <!-- Row 1: percentage + solvent + add button -->
    <div class="flex items-start gap-2">
      <!-- Percentage text input -->
      <div class="flex flex-col flex-1">
        <label class="label py-1">
          <span class="label-text text-base">Percentage (%)</span>
        </label>
        <input
          v-model="percentageStr"
          type="text"
          inputmode="decimal"
          class="input input-bordered w-full text-base"
          :class="{ 'input-error': percentageError }"
          placeholder="e.g. 50"
          @keyup.enter="addSolvent"
        />
        <span v-if="percentageError" class="text-xs text-error mt-0.5">{{ percentageError }}</span>
      </div>

      <!-- Solvent select -->
      <div class="flex flex-col flex-[2]">
        <div class="label py-1 invisible" aria-hidden="true">
          <span class="label-text text-base">&nbsp;</span>
        </div>
        <SelectWithOther
          v-model="selectedSolvent"
          :options="solventOptions"
          placeholder="Select solvent..."
          other-placeholder="Please specify..."
          hide-label
        />
      </div>

      <!-- Add button -->
      <div class="flex flex-col shrink-0">
        <div class="label py-1 invisible" aria-hidden="true">
          <span class="label-text text-base">&nbsp;</span>
        </div>
        <button
          class="btn btn-primary btn-square"
          @click="addSolvent"
          :disabled="!canAdd"
          title="Add solvent"
        >
          <SvgIcon type="plus" class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- Error -->
    <span v-if="error" class="text-sm text-error">{{ error }}</span>

    <!-- Solvent list -->
    <div v-if="solventEntries.length > 0" class="flex flex-col gap-1">
      <div
        v-for="(entry, index) in solventEntries"
        :key="index"
        class="flex items-center justify-between bg-base-200 rounded-lg px-3 py-1.5"
      >
        <span class="text-sm">{{ entry }}</span>
        <button
          class="btn btn-ghost btn-xs text-error"
          @click="removeSolvent(index)"
          title="Remove"
        >
          <SvgIcon type="close" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Clear all -->
    <div v-if="solventEntries.length > 0" class="flex justify-end">
      <button class="btn btn-ghost btn-sm text-error" @click="clearAll">
        Clear All
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SelectWithOther from '@/shared/components/SelectWithOther.vue'

const props = defineProps<{
  modelValue: string
  solventOptions: readonly string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

// Local state
const percentageStr = ref('')
const selectedSolvent = ref('')
const error = ref('')

// Parse percentage string to number (null if invalid)
const percentage = computed(() => {
  const val = parseFloat(percentageStr.value)
  if (isNaN(val)) return null
  return val
})

const percentageError = computed(() => {
  if (!percentageStr.value) return ''
  const val = percentage.value
  if (val === null || val < 1 || val > 100) return 'Percentage must be a number between 1 and 100'
  return ''
})

// Parse existing solvent string into entries
const solventEntries = computed(() => {
  if (!props.modelValue) return []
  return props.modelValue.split(',').map(s => s.trim()).filter(Boolean)
})

// Can add check
const canAdd = computed(() => {
  return percentage.value !== null && percentage.value >= 1 && percentage.value <= 100 && selectedSolvent.value.trim() !== ''
})

// Add solvent
function addSolvent() {
  error.value = ''

  if (percentage.value === null || percentage.value < 1 || percentage.value > 100) {
    error.value = 'Please enter a valid percentage (1-100)'
    return
  }

  if (!selectedSolvent.value.trim()) {
    error.value = 'Please select a solvent'
    return
  }

  const newEntry = `${percentage.value}% ${selectedSolvent.value.trim()}`
  const currentEntries = solventEntries.value.length > 0
    ? [...solventEntries.value, newEntry]
    : [newEntry]

  emit('update:modelValue', currentEntries.join(', '))

  // Reset
  percentageStr.value = ''
  selectedSolvent.value = ''
}

// Remove single entry
function removeSolvent(index: number) {
  const entries = [...solventEntries.value]
  entries.splice(index, 1)
  emit('update:modelValue', entries.join(', '))
}

// Clear all
function clearAll() {
  emit('update:modelValue', '')
  error.value = ''
}
</script>
