<script setup lang="ts">
/**
 * Compare regions control panel.
 *
 * Lets the user pick two region GROUPS (each a set of KMeans clusters and/or
 * ROIs combined by mask union), set filtering thresholds, and kick off the
 * comparison scan. Collapsible like the results table so the user can
 * reclaim vertical space once configured.
 */
import { computed } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import type { RegionOption } from '@/features/workspace/results/composables/useRegionComparison'
import type { DataMode } from '@/services/zarr/types/zarr'
import { rgbCss, type RGB } from '@/features/workspace/results/utils/regionPalette'

const props = defineProps<{
  regions: RegionOption[]
  dataMode?: DataMode | null
  spectrumMode?: string
  regionAIds: string[]
  regionBIds: string[]
  minDetectionRate: number
  noiseFloorPercentile: number
  comparing: boolean
  progress: number
  error: string | null
  hasResults: boolean
  canCompare: boolean
  /** Identity colors of groups A/B (first member's color; gray when empty). */
  colorA: RGB
  colorB: RGB
  /** Shared expand state - opening either panel opens both. */
  expanded: boolean
}>()

const emit = defineEmits<{
  (e: 'update:regionAIds', v: string[]): void
  (e: 'update:regionBIds', v: string[]): void
  (e: 'update:minDetectionRate', v: number): void
  (e: 'update:noiseFloorPercentile', v: number): void
  (e: 'update:expanded', v: boolean): void
  (e: 'compare'): void
  (e: 'cancel'): void
}>()

function toggle() {
  emit('update:expanded', !props.expanded)
}

const noRegions = computed(() => props.regions.length < 2)
const isCentroid = computed(() => props.spectrumMode === 'centroid')
const isComparisonAvailable = computed(() => isCentroid.value)
const colorACss = computed(() => rgbCss(props.colorA))
const colorBCss = computed(() => rgbCss(props.colorB))

function toggleRegion(side: 'a' | 'b', value: string, checked: boolean) {
  const current = [...(side === 'a' ? props.regionAIds : props.regionBIds)]
  const idx = current.indexOf(value)
  if (checked && idx === -1) current.push(value)
  if (!checked && idx !== -1) current.splice(idx, 1)
  emit(side === 'a' ? 'update:regionAIds' : 'update:regionBIds', current)
}

/** A region already checked on the other side is disabled here (a region
 *  may not participate in both groups). */
function isDisabled(side: 'a' | 'b', value: string): boolean {
  if (props.comparing) return true
  return (side === 'a' ? props.regionBIds : props.regionAIds).includes(value)
}

function onDetectionRate(e: Event) {
  emit('update:minDetectionRate', Number((e.target as HTMLInputElement).value))
}
function onNoiseFloor(e: Event) {
  emit('update:noiseFloorPercentile', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="rounded-xl border-2 border-base-content/30 bg-base-100 overflow-hidden flex flex-col">
    <!-- Collapsible header bar -->
    <div
      class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-base-200/60 select-none"
      @click.stop="toggle"
    >
      <SvgIcon
        :type="expanded ? 'chevron_down' : 'chevron_right'"
        class="w-4 h-4 text-base-content/60"
      />
      <span class="text-base font-semibold text-base-content">Compare regions</span>
      <!-- Show a compact status when collapsed -->
      <span v-if="!expanded && comparing" class="ml-auto flex items-center gap-1 text-base text-base-content/50">
        <span class="loading loading-spinner loading-xs"></span>
        {{ progress }}%
      </span>
    </div>

    <!-- Expanded content -->
    <div v-if="expanded" class="px-3 pb-2.5 space-y-2">
      <div v-if="!isComparisonAvailable" class="text-base text-base-content/60 leading-relaxed">
        Region comparison is only available for centroid data
      </div>
      <!-- No regions hint -->
      <div v-else-if="noRegions" class="text-base text-base-content/50 leading-relaxed">
        Run KMeans or create ROIs first to compare regions.
      </div>

      <!-- Region group selectors (multi-select checkboxes) -->
      <template v-else-if="isComparisonAvailable">
        <div class="space-y-1.5">
          <div
            v-for="side in (['a', 'b'] as const)"
            :key="side"
            class="flex items-start gap-2"
          >
            <span
              class="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-base text-white font-bold mt-0.5"
              :style="{ backgroundColor: side === 'a' ? colorACss : colorBCss }"
              >{{ side.toUpperCase() }}</span
            >
            <div
              class="flex-1 min-w-0 max-h-28 overflow-y-auto rounded-md border border-base-300 px-2 py-1 space-y-0.5"
            >
              <label
                v-for="r in regions"
                :key="r.value"
                class="flex items-center gap-1.5 text-base cursor-pointer"
                :class="
                  isDisabled(side, r.value)
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-base-200/60'
                "
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-xs"
                  :checked="(side === 'a' ? regionAIds : regionBIds).includes(r.value)"
                  :disabled="isDisabled(side, r.value)"
                  @change="toggleRegion(side, r.value, ($event.target as HTMLInputElement).checked)"
                />
                <span
                  class="w-2.5 h-2.5 rounded-sm shrink-0 border border-base-content/30"
                  :style="{ backgroundColor: r.color }"
                ></span>
                <span class="truncate">{{ r.label }}</span>
              </label>
            </div>
          </div>
          <div class="text-base text-base-content/50">
            Members of a group are combined (union) before comparing.
          </div>
        </div>

        <!-- Detection rate slider -->
        <div class="space-y-0.5">
          <div class="flex items-center justify-between text-base text-base-content/60">
            <span>Min detection rate</span>
            <span class="font-mono text-base-content">{{ minDetectionRate }}%</span>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            :value="minDetectionRate"
            class="range range-xs range-primary"
            :disabled="comparing"
            @input="onDetectionRate"
          />
        </div>

        <!-- Noise floor (intensity percentile) slider -->
        <div class="space-y-0.5">
          <div class="flex items-center justify-between text-base text-base-content/60">
            <span>Intensity threshold</span>
            <span class="font-mono text-base-content">{{ noiseFloorPercentile }}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            :value="noiseFloorPercentile"
            class="range range-xs range-primary"
            :disabled="comparing"
            @input="onNoiseFloor"
          />
        </div>

        <!-- Progress bar -->
        <div v-if="comparing" class="space-y-1">
          <div class="flex items-center justify-between text-base text-base-content/60">
            <span class="flex items-center gap-1.5">
              <span class="loading loading-spinner loading-xs"></span>
              Scanning...
            </span>
            <span class="font-mono">{{ progress }}%</span>
          </div>
          <progress class="progress progress-primary w-full" :value="progress" max="100"></progress>
        </div>

        <!-- Error -->
        <div v-if="error" class="text-base text-error flex items-start gap-1.5">
          <SvgIcon type="error" class="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{{ error }}</span>
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <button
            v-if="!comparing"
            class="btn btn-sm btn-primary flex-1 gap-1.5 text-base"
            :disabled="!canCompare"
            @click="emit('compare')"
          >
            <SvgIcon type="scale" class="w-4 h-4" />
            Compare
          </button>
          <button
            v-else
            class="btn btn-sm btn-outline flex-1 gap-1.5 text-base"
            @click="emit('cancel')"
          >
            <SvgIcon type="close" class="w-4 h-4" />
            Cancel
          </button>
        </div>
      </template>
    </div>

    <div v-if="expanded" class="mt-3 border-t border-base-300 pt-3">
      <slot name="preview" />
    </div>
  </div>
</template>
