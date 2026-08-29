<template>
  <div class="flex flex-col gap-3 text-[1.125em]">
    <!-- ROI Tools -->
    <div>
      <div class="font-semibold text-base-content mb-2 tracking-wide">ROI Tools</div>
      <div class="flex gap-1.5">
        <button
          class="btn btn-sm flex-1 text-[1em]"
          :class="selectedTool === 'rectangle' ? 'btn-primary' : 'btn-ghost'"
          @click="$emit('update:selectedTool', selectedTool === 'rectangle' ? null : 'rectangle')"
        >
          <SvgIcon type="square" /> Rect
        </button>
        <button
          class="btn btn-sm flex-1 text-[1em]"
          :class="selectedTool === 'freehand' ? 'btn-primary' : 'btn-ghost'"
          @click="$emit('update:selectedTool', selectedTool === 'freehand' ? null : 'freehand')"
        >
          <SvgIcon type="lasso" /> Lasso
        </button>
      </div>
      <div v-if="draftReady" class="flex gap-1.5 mt-1.5">
        <button class="btn btn-sm btn-success flex-1 text-[1em]" @click="$emit('confirm')">
          <SvgIcon type="check" /> Confirm
        </button>
        <button
          class="btn btn-sm btn-ghost flex-1 text-error text-[1em]"
          @click="$emit('cancel')"
        >
          <SvgIcon type="close" /> Cancel
        </button>
      </div>
      <button
        v-if="rois.length"
        class="btn btn-sm w-full mt-1.5 text-[1em]"
        :class="viewingRoi ? 'btn-primary' : 'btn-ghost'"
        :title="viewingRoi ? '当前：仅显示 ROI 区域内' : '当前：显示完整离子图'"
        @click="$emit('update:viewingRoi', !viewingRoi)"
      >
        {{ viewingRoi ? 'ROI only' : 'Show all' }}
      </button>
      <div v-if="draftReady" class="text-base-content mt-1">
        {{
          selectedTool === 'freehand'
            ? 'Selection ready — confirm, or drag inside to move'
            : 'Selection ready — confirm or drag handles to adjust'
        }}
      </div>
      <div v-else-if="selectedTool === 'rectangle'" class="text-base-content mt-1">
        Drag on the ion image to draw a rectangle
      </div>
      <div v-else-if="selectedTool === 'freehand'" class="text-base-content mt-1">
        Draw a freeform outline on the ion image
      </div>
    </div>

    <!-- ROI List -->
    <div v-if="rois.length">
      <div class="flex items-center justify-between mb-2">
        <span class="font-semibold text-base-content tracking-wide">ROIs</span>
        <button class="text-error hover:underline" @click="$emit('clearAll')">
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
            <span class="font-semibold" :style="{ color: roi.color }">{{
              roi.label
            }}</span>
            <button
              class="text-base-content hover:text-error"
              @click="$emit('delete', roi.id)"
            >
              <SvgIcon type="trash" />
            </button>
          </div>
          <span class="text-base-content">{{
            roi.type === 'freehand' ? 'Lasso' : 'Rectangle'
          }}</span>
          <div v-if="roi.stats" class="mt-1 space-y-0.5 font-mono text-base-content">
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

    <div v-else-if="!selectedTool" class="text-base-content">
      Select Rect or Lasso to draw on the ion image.
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { cssWithAlpha } from '@/features/workspace/results/utils/regionPalette'
import type { ConfirmedROI } from '@/features/workspace/results/composables/useROI'

defineProps<{
  selectedTool: string | null
  draftReady: boolean
  rois: ConfirmedROI[]
  /** When true, the ion image is filtered to the ROI union ("ROI only"). */
  viewingRoi: boolean
}>()

defineEmits<{
  (e: 'update:selectedTool', v: string | null): void
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'delete', id: string): void
  (e: 'clearAll'): void
  (e: 'update:viewingRoi', v: boolean): void
}>()

function fmt(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1e6) return v.toExponential(1)
  if (Math.abs(v) >= 1e3) return v.toExponential(1)
  if (Math.abs(v) < 0.01) return v.toExponential(2)
  return v.toFixed(2)
}
</script>
