<template>
  <div class="flex flex-col gap-3 text-base">
    <!-- ROI Tools -->
    <div>
      <div class="text-base font-semibold text-base-content/50 mb-2 tracking-wide">ROI Tools</div>
      <div class="flex gap-1.5">
        <button
          class="btn btn-sm flex-1 text-base"
          :class="selectedTool === 'rectangle' ? 'btn-primary' : 'btn-ghost'"
          @click="$emit('update:selectedTool', selectedTool === 'rectangle' ? null : 'rectangle')"
        >
          ▭ Rect
        </button>
        <button
          class="btn btn-sm flex-1 text-base"
          :class="selectedTool === 'freehand' ? 'btn-primary' : 'btn-ghost'"
          @click="$emit('update:selectedTool', selectedTool === 'freehand' ? null : 'freehand')"
        >
          ✎ Lasso
        </button>
        <button v-if="draftReady" class="btn btn-sm btn-success flex-1 text-base" @click="$emit('confirm')">
          ✓ Confirm
        </button>
        <button
          v-if="draftReady"
          class="btn btn-sm btn-ghost flex-1 text-base text-error"
          @click="$emit('cancel')"
        >
          ✕ Cancel
        </button>
        <button v-if="showReset" class="btn btn-sm btn-warning flex-1 text-base" @click="$emit('reset')">
          ↺ Reset
        </button>
      </div>
      <div v-if="draftReady" class="text-base text-base-content/50 mt-1">
        Selection ready — confirm or drag handles to adjust
      </div>
      <div v-else-if="selectedTool === 'rectangle'" class="text-base text-base-content/50 mt-1">
        Drag on the ion image to draw a rectangle
      </div>
      <div v-else-if="selectedTool === 'freehand'" class="text-base text-base-content/50 mt-1">
        Draw a freeform outline on the ion image
      </div>
    </div>

    <!-- ROI List -->
    <div v-if="rois.length">
      <div class="text-base font-semibold text-base-content/50 mb-2 tracking-wide">
        ROIs
        <button class="text-base text-error ml-2 hover:underline" @click="$emit('clearAll')">
          Clear all
        </button>
      </div>
      <div class="space-y-2 max-h-64 overflow-y-auto">
        <div
          v-for="roi in rois"
          :key="roi.id"
          class="rounded-lg border p-2"
          :style="{ borderColor: roi.color + '40', background: roi.color + '08' }"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="font-semibold text-base" :style="{ color: roi.color }">{{
              roi.label
            }}</span>
            <button
              class="text-base text-base-content/30 hover:text-error"
              @click="$emit('delete', roi.id)"
            >
              ✕
            </button>
          </div>
          <span class="text-base text-base-content/40">{{
            roi.type === 'freehand' ? 'Lasso' : 'Rectangle'
          }}</span>
          <div v-if="roi.stats" class="mt-1 space-y-0.5 text-base font-mono text-base-content/60">
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

    <div v-else-if="!selectedTool" class="text-base text-base-content/40">
      Select Rect or Lasso to draw on the ion image.
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  selectedTool: string | null
  draftReady: boolean
  showReset: boolean
  rois: any[]
}>()

defineEmits<{
  (e: 'update:selectedTool', v: string | null): void
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'delete', id: string): void
  (e: 'clearAll'): void
  (e: 'reset'): void
}>()

function fmt(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1e6) return v.toExponential(1)
  if (Math.abs(v) >= 1e3) return v.toExponential(1)
  if (Math.abs(v) < 0.01) return v.toExponential(2)
  return v.toFixed(2)
}
</script>
