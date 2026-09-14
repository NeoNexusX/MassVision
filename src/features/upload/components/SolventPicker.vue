<template>
  <div class="flex flex-col gap-2">
    <!-- Row 1: percentage + solvent + add button -->
    <div class="flex items-start gap-2">
      <!-- Percentage text input -->
      <div class="flex flex-col flex-1">
        <label class="label py-1">
          <span class="label-text kawaru-text-100">{{ $t('upload.solvent.percentage') }}</span>
        </label>
        <input
          v-model="percentageStr"
          type="text"
          inputmode="decimal"
          class="input input-bordered w-full kawaru-text-100"
          :class="{ 'input-error': percentageError }"
          :placeholder="$t('common.input.example', { value: 50 })"
          @keyup.enter="addSolvent"
        />
        <span v-if="percentageError" class="kawaru-text-75 text-error mt-0.5">{{ percentageError }}</span>
      </div>

      <!-- Solvent select -->
      <div class="flex flex-col flex-[2]">
        <div class="label py-1 invisible" aria-hidden="true">
          <span class="label-text kawaru-text-100">&nbsp;</span>
        </div>
        <SelectWithOther
          v-model="selectedSolvent"
          :options="solventOptions"
          :label-of="vocabLabel"
          :placeholder="$t('common.input.selectShort')"
          :other-placeholder="$t('common.input.specifyOther')"
          hide-label
        />
      </div>

      <!-- Add button -->
      <div class="flex flex-col shrink-0">
        <div class="label py-1 invisible" aria-hidden="true">
          <span class="label-text kawaru-text-100">&nbsp;</span>
        </div>
        <button
          class="btn btn-primary btn-square kawaru-text-87"
          @click="addSolvent"
          :disabled="!canAdd"
:title="$t('upload.solvent.add')"
        >
          <SvgIcon type="plus" class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- Error -->
    <span v-if="error" class="kawaru-text-87 text-error">{{ error }}</span>

    <!-- Solvent list -->
    <div v-if="solventEntries.length > 0" class="flex flex-col gap-1">
      <div
        v-for="(entry, index) in solventEntries"
        :key="index"
        class="flex items-center justify-between bg-base-200 rounded-lg px-3 py-1.5"
      >
        <span class="kawaru-text-87">{{ entryLabel(entry) }}</span>
        <button
          class="btn btn-ghost btn-xs text-error kawaru-text-68"
          @click="removeSolvent(index)"
:title="$t('common.action.remove')"
        >
          <SvgIcon type="close" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Clear all -->
    <div v-if="solventEntries.length > 0" class="flex justify-end">
      <button class="btn btn-ghost btn-sm text-error kawaru-text-75" @click="clearAll">
        {{ $t('common.action.clearAll') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SelectWithOther from '@/shared/components/SelectWithOther.vue'
import { vocabLabel } from '@/features/datasets/constants/vocabLabels'
import { t } from '@/i18n'

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
  if (val === null || val < 1 || val > 100) return t('upload.solvent.percentageError')
  return ''
})

// Parse existing solvent string into entries
const solventEntries = computed(() => {
  if (!props.modelValue) return []
  return props.modelValue.split(',').map(s => s.trim()).filter(Boolean)
})

/** 条目形如 "50% Water"：提交的仍是这个英文串，只把溶剂名部分换成显示文字 */
function entryLabel(entry: string): string {
  const m = /^(\S+%)\s+(.+)$/.exec(entry)
  return m ? `${m[1]} ${vocabLabel(m[2])}` : entry
}

// Can add check
const canAdd = computed(() => {
  return percentage.value !== null && percentage.value >= 1 && percentage.value <= 100 && selectedSolvent.value.trim() !== ''
})

// Add solvent
function addSolvent() {
  error.value = ''

  if (percentage.value === null || percentage.value < 1 || percentage.value > 100) {
    error.value = t('upload.solvent.invalidPercentage')
    return
  }

  if (!selectedSolvent.value.trim()) {
    error.value = t('upload.solvent.selectSolvent')
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
