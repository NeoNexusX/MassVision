<template>
  <div class="flex flex-col gap-3 text-lg">
    <!-- ROI Tools -->
    <div>
      <div class="text-lg font-semibold text-base-content mb-2 tracking-wide">ROI Tools</div>
      <div class="flex gap-1.5">
        <button
          class="btn btn-sm flex-1 text-base"
          :class="selectedTool === 'rectangle' ? 'btn-primary' : 'btn-ghost'"
          @click="$emit('update:selectedTool', selectedTool === 'rectangle' ? null : 'rectangle')"
        >
          <SvgIcon type="square" class="w-4 h-4" /> Rect
        </button>
        <button
          class="btn btn-sm flex-1 text-base"
          :class="selectedTool === 'freehand' ? 'btn-primary' : 'btn-ghost'"
          @click="$emit('update:selectedTool', selectedTool === 'freehand' ? null : 'freehand')"
        >
          <SvgIcon type="pencil" class="w-4 h-4" /> Lasso
        </button>
      </div>
      <div v-if="draftReady" class="flex gap-1.5 mt-1.5">
        <button class="btn btn-sm btn-success flex-1 text-base" @click="$emit('confirm')">
          <SvgIcon type="check" class="w-4 h-4" /> Confirm
        </button>
        <button
          class="btn btn-sm btn-ghost flex-1 text-base text-error"
          @click="$emit('cancel')"
        >
          <SvgIcon type="close" class="w-4 h-4" /> Cancel
        </button>
      </div>
      <button v-if="showReset" class="btn btn-sm btn-warning w-full text-base mt-1.5" @click="$emit('reset')">
        <SvgIcon type="plus" class="w-4 h-4" /> New
      </button>
      <div v-if="draftReady" class="text-base text-base-content mt-1">
        Selection ready — confirm or drag handles to adjust
      </div>
      <div v-else-if="selectedTool === 'rectangle'" class="text-base text-base-content mt-1">
        Drag on the ion image to draw a rectangle
      </div>
      <div v-else-if="selectedTool === 'freehand'" class="text-base text-base-content mt-1">
        Draw a freeform outline on the ion image
      </div>
      <button
        v-if="showImport"
        class="btn btn-sm btn-outline w-full text-base mt-1.5"
        title="Import pre-computed reference regions (e.g. pathology annotation)"
        @click="$emit('import-reference')"
      >
        <SvgIcon type="download" class="w-4 h-4" /> Import reference ROIs
      </button>
    </div>

    <!-- ROI List -->
    <div v-if="rois.length">
      <div class="text-lg font-semibold text-base-content mb-2 tracking-wide">
        ROIs
        <button class="text-lg text-error ml-2 hover:underline" @click="$emit('clearAll')">
          Clear all
        </button>
      </div>
      <div class="space-y-2 max-h-64 overflow-y-auto">
        <div
          v-for="roi in rois"
          :key="roi.id"
          class="rounded-lg border p-2"
          :style="{ borderColor: cssWithAlpha(roi.color, 0.25), background: cssWithAlpha(roi.color, 0.03) }"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="font-semibold text-lg" :style="{ color: roi.color }">{{
              roi.label
            }}</span>
            <button
              class="text-lg text-base-content hover:text-error"
              @click="$emit('delete', roi.id)"
            >
              <SvgIcon type="trash" class="w-4 h-4" />
            </button>
          </div>
          <span class="text-lg text-base-content">{{
            roi.type === 'freehand' ? 'Lasso' : 'Rectangle'
          }}</span>
          <div v-if="roi.stats" class="mt-1 space-y-0.5 text-lg font-mono text-base-content">
            <div class="flex justify-between">
              <span>Pixels</span><span>{{ roi.stats.pixelCount }}</span>
            </div>
            <div class="flex justify-between">
              <span>Mean</span><span>{{ fmt(roi.stats.mean) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Std</span><span>{{ fmt(roi.stats.std) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Min</span><span>{{ fmt(roi.stats.min) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Max</span><span>{{ fmt(roi.stats.max) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!selectedTool" class="text-lg text-base-content">
      Select Rect or Lasso to draw on the ion image.
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { cssWithAlpha } from '@/features/workspace/results/utils/regionPalette'

defineProps<{
  selectedTool: string | null
  draftReady: boolean
  showReset: boolean
  rois: any[]
  /** Local datasets: show the reference-ROI import button. */
  showImport?: boolean
}>()

defineEmits<{
  (e: 'update:selectedTool', v: string | null): void
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'delete', id: string): void
  (e: 'clearAll'): void
  (e: 'reset'): void
  (e: 'import-reference'): void
}>()

function fmt(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1e6) return v.toExponential(1)
  if (Math.abs(v) >= 1e3) return v.toExponential(1)
  if (Math.abs(v) < 0.01) return v.toExponential(2)
  return v.toFixed(2)
}
</script>
