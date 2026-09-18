<template>
  <div class="flex flex-col gap-3 kawaru-text-81">
    <!-- ROI Tools -->
    <div>
      <div class="font-semibold text-base-content mb-2 tracking-wide">{{ $t('vizworkbench.roi.tools') }}</div>
      <div class="flex gap-1.5">
        <button
          class="btn btn-sm flex-1 kawaru-text-81"
          :class="selectedTool === 'rectangle' ? 'btn-primary' : 'btn-ghost'"
          @click="$emit('update:selectedTool', selectedTool === 'rectangle' ? null : 'rectangle')"
        >
          <SvgIcon type="square" /> {{ $t('vizworkbench.roi.rect') }}
        </button>
        <button
          class="btn btn-sm flex-1 kawaru-text-81"
          :class="selectedTool === 'freehand' ? 'btn-primary' : 'btn-ghost'"
          @click="$emit('update:selectedTool', selectedTool === 'freehand' ? null : 'freehand')"
        >
          <SvgIcon type="lasso" /> {{ $t('vizworkbench.roi.lasso') }}
        </button>
      </div>
      <div v-if="draftReady" class="flex gap-1.5 mt-1.5">
        <button class="btn btn-sm btn-success flex-1 kawaru-text-81" @click="$emit('confirm')">
          <SvgIcon type="check" /> {{ $t('common.action.confirm') }}
        </button>
        <button
          class="btn btn-sm btn-ghost flex-1 text-error kawaru-text-81"
          @click="$emit('cancel')"
        >
          <SvgIcon type="close" /> {{ $t('common.action.cancel') }}
        </button>
      </div>
      <button
        v-if="rois.length"
        class="btn btn-sm w-full mt-1.5 kawaru-text-81"
        :class="viewingRoi ? 'btn-primary' : 'btn-ghost'"
        :title="viewingRoi ? $t('vizworkbench.roi.viewingRoiHint') : $t('vizworkbench.roi.viewingAllHint')"
        @click="$emit('update:viewingRoi', !viewingRoi)"
      >
        {{ viewingRoi ? $t('vizworkbench.roi.roiOnly') : $t('vizworkbench.roi.showAll') }}
      </button>
      <div v-if="draftReady" class="text-base-content mt-1">
        {{
          selectedTool === 'freehand'
            ? $t('vizworkbench.roi.readyLasso')
            : $t('vizworkbench.roi.readyRect')
        }}
      </div>
      <div v-else-if="selectedTool === 'rectangle'" class="text-base-content mt-1">
        {{ $t('vizworkbench.roi.rectHint') }}
      </div>
      <div v-else-if="selectedTool === 'freehand'" class="text-base-content mt-1">
        {{ $t('vizworkbench.roi.lassoHint') }}
      </div>
    </div>

    <!-- ROI List -->
    <div v-if="rois.length">
      <div class="flex items-center justify-between mb-2">
        <span class="font-semibold text-base-content tracking-wide">{{ $t('vizworkbench.roi.rois') }}</span>
        <button class="text-error hover:underline" @click="$emit('clearAll')">
          {{ $t('common.action.clearAll') }}
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
            <div class="flex items-center gap-1">
              <button
                class="text-base-content hover:text-error"
                @click="$emit('delete', roi.id)"
              >
                <SvgIcon type="trash" />
              </button>
            </div>
          </div>
          <span class="text-base-content">{{
            roi.type === 'freehand' ? $t('vizworkbench.roi.lasso') : $t('vizworkbench.roi.rectangle')
          }}</span>
          <div v-if="roi.stats" class="mt-1 space-y-0.5 font-mono text-base-content">
            <div class="flex justify-between">
              <span>{{ $t('vizworkbench.roi.pixels') }}</span><span>{{ roi.stats.pixelCount }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ $t('vizworkbench.roi.mean') }}</span><span>{{ fmt(roi.stats.mean) }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ $t('vizworkbench.roi.std') }}</span><span>{{ fmt(roi.stats.std) }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ $t('vizworkbench.roi.min') }}</span><span>{{ fmt(roi.stats.min) }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ $t('vizworkbench.roi.max') }}</span><span>{{ fmt(roi.stats.max) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Imported mask（文件导入：独立于手绘 ROI，虚线边框区分；trash = 清除导入） -->
    <div v-if="importedMask">
      <div class="font-semibold text-base-content mb-2 tracking-wide">
        {{ $t('vizworkbench.roi.importedMask') }}
      </div>
      <div class="rounded-lg border border-dashed border-base-content/30 bg-base-content/[0.03] p-2">
        <div class="flex items-center justify-between mb-1 gap-2">
          <span
            class="font-semibold text-base-content truncate"
            :title="importedMask.name"
          >
            {{ importedMask.name }}
          </span>
          <button
            class="text-base-content hover:text-error shrink-0"
            :title="$t('vizworkbench.mask.clearImport')"
            @click="$emit('clearImportedMask')"
          >
            <SvgIcon type="trash" />
          </button>
        </div>
        <span class="text-base-content/70 uppercase">{{ importedMask.format }}</span>
        <div class="mt-1 space-y-0.5 font-mono text-base-content">
          <div class="flex justify-between">
            <span>{{ $t('vizworkbench.roi.pixels') }}</span><span>{{ importedMask.pixelCount }}</span>
          </div>
          <template v-if="importedMask.stats">
            <div class="flex justify-between">
              <span>{{ $t('vizworkbench.roi.mean') }}</span><span>{{ fmt(importedMask.stats.mean) }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ $t('vizworkbench.roi.std') }}</span><span>{{ fmt(importedMask.stats.std) }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ $t('vizworkbench.roi.min') }}</span><span>{{ fmt(importedMask.stats.min) }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ $t('vizworkbench.roi.max') }}</span><span>{{ fmt(importedMask.stats.max) }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="!rois.length && !importedMask && !selectedTool" class="text-base-content">
      {{ $t('vizworkbench.roi.empty') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { cssWithAlpha } from '@/features/vizworkbench/utils/regionPalette'
import type { ConfirmedROI } from '@/features/vizworkbench/composables/useROI'
import type { ImportedMaskSummary } from '@/features/vizworkbench/utils/maskExport'

defineProps<{
  selectedTool: string | null
  draftReady: boolean
  rois: ConfirmedROI[]
  /** When true, the ion image is filtered to the ROI union ("ROI only"). */
  viewingRoi: boolean
  /** 文件导入的掩膜摘要（独立于 rois，只读展示；trash 清除导入） */
  importedMask?: ImportedMaskSummary | null
}>()

defineEmits<{
  (e: 'update:selectedTool', v: string | null): void
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'delete', id: string): void
  (e: 'clearAll'): void
  (e: 'clearImportedMask'): void
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
