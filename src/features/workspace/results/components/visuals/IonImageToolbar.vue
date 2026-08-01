<template>
  <div class="flex flex-wrap items-center gap-3 mb-3 pt-1">
    <div>
      <h3 class="text-lg font-semibold">{{ title }}</h3>
    </div>
    <div class="ml-auto flex flex-wrap items-center gap-2">
      <!-- m/z 显示（continuous 模式） -->
      <div
        v-if="dataMode === 'continuous'"
        class="bg-base-100 border border-base-300 rounded-lg px-3 py-1 text-base h-8 flex items-center"
      >
        <span class="text-base-content/50">m/z&nbsp;</span>
        <span class="font-mono font-semibold">{{ selectedMz.toFixed(4) }}</span>
      </div>
      <!-- 像素坐标显示（processed 模式） -->
      <div
        v-if="dataMode === 'processed' && pixelCoord"
        class="bg-base-100 border border-base-300 rounded-lg px-3 py-1 text-base h-8 flex items-center"
      >
        <span class="text-base-content/50">Pixel&nbsp;</span>
        <span class="font-mono font-semibold">({{ pixelCoord.x }}, {{ pixelCoord.y }})</span>
      </div>
      <!-- m/z 容差（仅 continuous 模式） -->
      <div v-if="dataMode === 'continuous'" class="flex items-center gap-1 text-base">
        <span class="text-base-content/50">Tolerance &plusmn;</span>
        <input
          type="number"
          class="input input-sm input-bordered w-20 font-mono text-base"
          :value="mzTolerance"
          step="any"
          :min="ZARR_STORE.minMzTolerance"
          :max="ZARR_STORE.maxMzTolerance"
          @input="onToleranceInput"
        />
      </div>
      <!-- Colormap（两种模式都可用） -->
      <select
        data-testid="colormap-select"
        class="select select-sm select-bordered w-28 text-base"
        :value="colormap"
        @change="$emit('update:colormap', ($event.target as HTMLSelectElement).value)"
      >
        <option value="viridis">Viridis</option>
        <option value="inferno">Inferno</option>
        <option value="plasma">Plasma</option>
        <option value="gray">Gray</option>
      </select>
      <!-- 强度标度 -->
      <select
        class="select select-sm select-bordered w-28 text-base"
        :value="intensityScale"
        @change="$emit('update:intensityScale', ($event.target as HTMLSelectElement).value)"
      >
        <option value="linear">Linear</option>
        <option v-if="dataMode !== 'processed'" value="rms">RMS</option>
        <option v-if="dataMode !== 'processed'" value="tic">TIC</option>
        <option value="log">Log</option>
      </select>
      <button class="btn btn-sm btn-ghost text-base" @click="$emit('reset')">Reset</button>
      <button class="btn btn-sm btn-ghost text-base gap-1" title="Export current view as PNG" @click="$emit('download')">
        <SvgIcon type="download" class="w-4 h-4" />
        PNG
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DataMode } from '@/services/zarrOssStore'
import { ZARR_STORE } from '@/shared/config/defaults'
import SvgIcon from '@/shared/components/SvgIcon.vue'

defineProps<{
  selectedMz: number
  mzTolerance: number
  colormap: string
  intensityScale: string
  /** 数据模式 */
  dataMode?: DataMode | null
  /** 当前选中像素坐标（processed 模式） */
  pixelCoord?: { x: number; y: number } | null
  /** 工具栏标题 */
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:mzTolerance', v: number): void
  (e: 'update:colormap', v: string): void
  (e: 'update:intensityScale', v: string): void
  (e: 'reset'): void
  (e: 'download'): void
}>()

/** 容差输入钳位到 [min, max]；空输入/NaN 时回退到下限，避免触发 NaN 加载 */
function onToleranceInput(e: Event) {
  const raw = Number((e.target as HTMLInputElement).value)
  const v = Number.isNaN(raw)
    ? ZARR_STORE.minMzTolerance
    : Math.min(ZARR_STORE.maxMzTolerance, Math.max(ZARR_STORE.minMzTolerance, raw))
  emit('update:mzTolerance', v)
}
</script>
