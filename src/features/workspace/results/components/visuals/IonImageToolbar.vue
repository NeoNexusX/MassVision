<template>
  <div class="flex flex-wrap items-center gap-3 mb-1 pt-1">
    <div>
      <h3 class="text-xl font-semibold">{{ title }}</h3>
    </div>
    <div class="ml-auto flex flex-wrap items-center gap-2">
      <!-- m/z 搜索（continuous 模式）：可填写目标值，Search/回车命中最近的峰；
           悬停显示更高精度的当前值 -->
      <template v-if="dataMode === 'continuous'">
        <div
          class="bg-base-100 border border-base-300 rounded-lg px-3 py-1 text-lg h-8 flex items-center"
          :title="`m/z ${selectedMz.toFixed(8)}`"
        >
          <span class="text-base-content/50"><i>m/z</i>&nbsp;</span>
          <input
            data-testid="selected-mz"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            spellcheck="false"
            class="bg-transparent outline-none w-24 font-mono font-semibold"
            :value="mzInput"
            @input="onMzInput"
            @blur="onMzBlur"
            @keydown.enter.prevent="onSearchMz"
          />
        </div>
        <button
          class="btn btn-sm h-8 btn-ghost text-lg"
          title="Jump to the nearest m/z peak within tolerance"
          @click="onSearchMz"
        >
          Search
        </button>
      </template>
      <!-- 像素坐标显示（processed 模式） -->
      <div
        v-if="dataMode === 'processed' && pixelCoord"
        class="bg-base-100 border border-base-300 rounded-lg px-3 py-1 text-lg h-8 flex items-center"
      >
        <span class="text-base-content/50">Pixel&nbsp;</span>
        <span class="font-mono font-semibold">({{ pixelCoord.x }}, {{ pixelCoord.y }})</span>
      </div>
      <!-- m/z 容差（仅 continuous 模式） -->
      <div v-if="dataMode === 'continuous'" class="flex items-center gap-1 text-lg">
        <span class="text-base-content/50">Tolerance &plusmn;</span>
        <input
          type="text"
          inputmode="decimal"
          autocomplete="off"
          spellcheck="false"
          class="input input-sm input-bordered w-20 font-mono text-lg"
          :value="mzTolerance"
          @input="onToleranceInput"
          @blur="onToleranceBlur"
        />
      </div>
      <!-- Colormap（两种模式都可用） -->
      <select
        data-testid="colormap-select"
        class="select select-sm select-bordered w-28 text-lg"
        :value="colormap"
        @change="$emit('update:colormap', ($event.target as HTMLSelectElement).value)"
      >
        <option value="viridis">Viridis</option>
        <option value="inferno">Inferno</option>
        <option value="magma">Magma</option>
        <option value="hot">Hot</option>
        <option value="gray">Gray</option>
      </select>
      <!-- 强度标度：TIC 归一化仅 continuous 模式（processed 本身就是 TIC 图） -->
      <div class="flex items-center gap-1.5">
        <span v-if="normalizationLoading" class="loading loading-spinner loading-xs text-primary"></span>
        <select
          data-testid="intensity-scale-select"
          class="select select-sm select-bordered w-36 text-lg"
          :class="normalizationError ? 'select-error' : ''"
          :title="normalizationError ? `Normalization failed: ${normalizationError}` : undefined"
          :value="intensityScale"
          @change="$emit('update:intensityScale', ($event.target as HTMLSelectElement).value)"
        >
          <option value="linear">Linear</option>
          <option value="log">Log</option>
          <option v-if="dataMode === 'continuous' && hasTic" value="tic" title="Divide each pixel by its total ion current (pre-computed stats/tic)">TIC norm</option>
        </select>
      </div>
      <button class="btn btn-sm btn-ghost text-lg" @click="$emit('reset')">Reset</button>
      <button class="btn btn-sm btn-ghost text-lg gap-1" title="Export current view as PNG" @click="$emit('download')">
        <SvgIcon type="download" class="" />
        PNG
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { DataMode } from '@/services/zarr/types/zarr'
import { ZARR_STORE } from '@/shared/config/defaults'
import SvgIcon from '@/shared/components/SvgIcon.vue'

const props = defineProps<{
  selectedMz: number
  mzTolerance: number
  colormap: string
  intensityScale: string
  /** 数据模式 */
  dataMode?: DataMode | null
  /** 当前选中像素坐标（processed 模式） */
  pixelCoord?: { x: number; y: number } | null
  /** TIC 归一化计算中（读取 stats/tic，通常很快） */
  normalizationLoading?: boolean
  /** 归一化计算失败的原因（保留原图并提示） */
  normalizationError?: string | null
  /** zarr 是否预存 stats/tic（TIC 归一化的唯一数据源） */
  hasTic?: boolean
  /** 工具栏标题 */
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:mzTolerance', v: number): void
  (e: 'update:colormap', v: string): void
  (e: 'update:intensityScale', v: string): void
  (e: 'search-mz', v: string): void
  (e: 'reset'): void
  (e: 'download'): void
}>()

// ---- m/z 搜索框 ----

/** 输入框内容：默认随 selectedMz 同步（谱图点击/搜索命中后刷新），
 *  用户键入的值保留为待搜索内容。 */
const mzInput = ref(props.selectedMz.toFixed(4))

watch(
  () => props.selectedMz,
  (v) => {
    mzInput.value = v.toFixed(4)
  },
)

function onMzInput(e: Event) {
  mzInput.value = (e.target as HTMLInputElement).value
}

/** 失焦时仅修正空/非法输入（含 Number('') === 0 的清空场景）：
 *  合法数值保留，避免 blur 先于 Search 的 click 触发把待搜索值冲掉。 */
function onMzBlur() {
  const raw = Number(mzInput.value)
  if (!(raw > 0)) mzInput.value = props.selectedMz.toFixed(4)
}

/** 发起搜索：解析、最近峰命中与容差判定在父级完成（需要 m/z 轴与 tolerance）。
 *  emit 后父级会同步更新 selectedMz（loadForMzIndex 在首个 await 前赋值索引），
 *  nextTick 强制回显实际命中值——命中的就是当前峰时 selectedMz 不变、
 *  watch 不触发，输入框会停留在用户的查询文本（如搜 445.0497 命中
 *  445.0494）；命中其他峰时 watch 也会同步，两种情况都收敛到实际值。 */
function onSearchMz() {
  emit('search-mz', mzInput.value)
  void nextTick(() => {
    mzInput.value = props.selectedMz.toFixed(4)
  })
}

/**
 * 容差输入钳位到 [min, max]。
 * 注意 Number('') === 0（不是 NaN），若直接 clamp 会把清空输入误判为 0 而跳到 min；
 * 因此非正数（空、'0'、'0.'、负数、NaN）一律不 emit，保持上一次有效值，
 * 避免输入过程中触发不必要的图像重载。
 */
function onToleranceInput(e: Event) {
  const raw = Number((e.target as HTMLInputElement).value)
  if (!(raw > 0)) return
  const v = Math.min(ZARR_STORE.maxMzTolerance, Math.max(ZARR_STORE.minMzTolerance, raw))
  emit('update:mzTolerance', v)
}

/** 失焦时校验：清空/非法输入回退到默认容差（0.0001），合法值则钳位后同步显示 */
function onToleranceBlur(e: Event) {
  const el = e.target as HTMLInputElement
  const raw = Number(el.value)
  const v = raw > 0
    ? Math.min(ZARR_STORE.maxMzTolerance, Math.max(ZARR_STORE.minMzTolerance, raw))
    : ZARR_STORE.defaultMzTolerance
  el.value = String(v)
  emit('update:mzTolerance', v)
}
</script>
