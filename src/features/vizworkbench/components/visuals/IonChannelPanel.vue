<template>
  <div class="kawaru-text-81">
    <!-- Mode toggle -->
    <label class="flex items-center justify-between mb-2 cursor-pointer select-none kawaru-text-87">
      <span class="text-base-content">{{ $t('vizworkbench.channels.overlayMode') }}</span>
      <input
        type="checkbox"
        class="toggle toggle-sm toggle-primary"
        :checked="enabled"
        @change="emit('update:enabled', ($event.target as HTMLInputElement).checked)"
      />
    </label>

    <div class="text-base-content/60 mb-2">
      {{ $t('vizworkbench.channels.hint') }}
    </div>

    <!-- Channel list -->
    <div v-if="channels.length" class="space-y-0.5 mb-2">
      <div
        v-for="c in channels"
        :key="c.id"
        class="flex items-center gap-1.5 py-0.5"
        :class="{ 'opacity-50': !enabled }"
      >
        <input
          type="checkbox"
          class="checkbox checkbox-xs checkbox-primary shrink-0"
          :checked="c.visible"
          :disabled="!enabled || !c.matrix"
          :aria-label="$t('vizworkbench.channels.show', { mz: c.mz })"
          @change="emit('toggle-visible', c.id)"
        />
        <span
          class="w-3 h-3 rounded-sm border border-base-content/30 shrink-0"
          :style="{ backgroundColor: `rgb(${c.color.r},${c.color.g},${c.color.b})` }"
        ></span>
        <span class="font-mono text-base-content truncate" :title="`m/z ${c.mz.toFixed(6)}`">
          {{ c.mz.toFixed(6) }}
        </span>
        <span v-if="c.loading" class="loading loading-spinner loading-xs text-base-content/50" />
        <button
          v-else-if="c.error"
          class="text-error shrink-0"
          :title="$t('vizworkbench.channels.loadFailed', { error: c.error })"
          @click="emit('retry', c.id)"
        >
          <SvgIcon type="warning" class="w-[1.1em] h-[1.1em]" />
        </button>
        <button
          class="ml-auto text-base-content/50 hover:text-error shrink-0"
          :aria-label="$t('vizworkbench.channels.remove', { mz: c.mz })"
          @click="emit('remove', c.id)"
        >
          <SvgIcon type="trash" class="w-[1em] h-[1em]" />
        </button>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1">
      <button
        class="btn btn-sm btn-primary flex-1 kawaru-text-81"
        :disabled="!enabled || !canAdd"
        :title="addTitle"
        @click="emit('add-current')"
      >
        <span v-if="anyLoading" class="loading loading-spinner loading-xs"></span>
        <SvgIcon v-else type="plus" />
        {{ $t('vizworkbench.channels.add', { mz: currentMz.toFixed(6) }) }}
      </button>
      <button
        class="btn btn-ghost btn-sm kawaru-text-81"
        :disabled="!channels.length"
        @click="emit('clear')"
      >
        {{ $t('common.action.clear') }}
      </button>
    </div>

    <div v-if="!channels.length" class="text-base-content/60 mt-1.5">
      {{ $t('vizworkbench.channels.empty') }}
    </div>
    <div v-else-if="channels.length >= maxChannels" class="text-base-content/60 mt-1.5">
      {{ $t('vizworkbench.channels.full', { max: maxChannels }) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import type { IonChannel } from '@/features/vizworkbench/composables/useIonChannels'
import { t } from '@/i18n'

const props = defineProps<{
  enabled: boolean
  /** Channel metadata (matrices are not needed by this panel). */
  channels: IonChannel[]
  /** Current m/z — what "Add" would add. */
  currentMz: number
  /** False when the mode is off, full, or a load is in flight. */
  canAdd: boolean
  /** A channel is still loading. */
  anyLoading: boolean
  maxChannels: number
}>()

const emit = defineEmits<{
  (e: 'update:enabled', value: boolean): void
  (e: 'add-current'): void
  (e: 'remove', id: number): void
  (e: 'toggle-visible', id: number): void
  (e: 'retry', id: number): void
  (e: 'clear'): void
}>()

const addTitle = computed(() => {
  if (!props.enabled) return t('vizworkbench.channels.enableFirst')
  if (props.channels.length >= props.maxChannels) return t('vizworkbench.channels.colorsInUse')
  return t('vizworkbench.channels.addHint', { mz: props.currentMz.toFixed(6) })
})
</script>
