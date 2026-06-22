<template>
  <div class="flex flex-wrap items-center gap-3 mb-3 pt-1">
    <div>
      <h3 class="text-lg font-semibold">Ion Image</h3>
    </div>
    <div
      v-if="metaInfo"
      class="hidden sm:flex items-center gap-3 text-base text-base-content/60 ml-2"
    >
      <span v-if="metaInfo.ionSource"
        >Source <strong class="text-base-content">{{ metaInfo.ionSource }}</strong></span
      >
      <span v-if="metaInfo.pixelSize"
        >Pixel <strong class="text-base-content">{{ metaInfo.pixelSize }}</strong></span
      >
    </div>
    <div class="ml-auto flex flex-wrap items-center gap-2">
      <div class="bg-base-100 border border-base-300 rounded-lg px-3 py-1 text-base h-8 flex items-center">
        <span class="text-base-content/50">m/z&nbsp;</span>
        <span class="font-mono font-semibold">{{ selectedMz.toFixed(4) }}</span>
      </div>
      <div class="flex items-center gap-1 text-base">
        <span class="text-base-content/50">Tolerance &plusmn;</span>
        <input
          type="number"
          class="input input-sm input-bordered w-20 font-mono text-base"
          :value="mzTolerance"
          step="0.001"
          min="0.001"
          @input="$emit('update:mzTolerance', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <select
        class="select select-sm select-bordered w-28 text-base"
        :value="colormap"
        @change="$emit('update:colormap', ($event.target as HTMLSelectElement).value)"
      >
        <option value="viridis">Viridis</option>
        <option value="inferno">Inferno</option>
        <option value="plasma">Plasma</option>
        <option value="gray">Gray</option>
      </select>
      <select
        class="select select-sm select-bordered w-28 text-base"
        :value="intensityScale"
        @change="$emit('update:intensityScale', ($event.target as HTMLSelectElement).value)"
      >
        <option value="linear">Linear</option>
        <option value="log">Log</option>
      </select>
      <button class="btn btn-sm btn-ghost text-base" @click="$emit('reset')">Reset</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  selectedMz: number
  mzTolerance: number
  colormap: string
  intensityScale: string
  metaInfo?: { ionSource?: string; pixelSize?: string } | null
}>()

defineEmits<{
  (e: 'update:mzTolerance', v: number): void
  (e: 'update:colormap', v: string): void
  (e: 'update:intensityScale', v: string): void
  (e: 'reset'): void
}>()
</script>
