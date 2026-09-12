<template>
  <!-- Step 2 已选区卡片：序号 + 拖拽手柄 + 缩略图 + 名称/元信息 + 上移/下移 + 移除。
       拖拽为 HTML5 DnD 的「手柄武装」模式：只有按住手柄 pointerdown 后行才
       draggable，行内其他区域（按钮/文本）不受影响。触屏/键盘走上移/下移按钮。 -->
  <section
    class="bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm border border-base-300 p-4 sm:p-6"
  >
    <div class="flex items-center justify-between gap-3 mb-4">
      <h2 class="text-[1.25em] font-bold text-base-content flex items-center gap-2">
        Step 2: Arrange Order
        <span
          v-if="selected.length"
          class="badge badge-sm font-medium border border-base-300 bg-base-200 text-base-content/70"
        >
          {{ selected.length }} {{ selected.length === 1 ? 'dataset' : 'datasets' }}
        </span>
      </h2>
      <button
        v-if="selected.length"
        class="btn btn-ghost btn-sm text-[0.95em] text-error"
        @click="emit('clear-all')"
      >
        <SvgIcon type="trash" class="w-[1em] h-[1em]" />
        Clear all
      </button>
    </div>

    <div
      v-if="selected.length"
      class="flex flex-col gap-1 border border-base-200 dark:border-slate-700 rounded-md p-2"
    >
      <div
        v-for="(dataset, i) in selected"
        :key="dataset.id"
        :draggable="armed"
        :class="[
          'relative px-3 py-2 rounded-lg flex items-center gap-3 select-none transition-opacity',
          dragFrom === i ? 'opacity-40' : '',
          dragOver === i && dragFrom !== i ? 'border-t-2 border-t-primary' : '',
        ]"
        @dragstart="onDragStart($event, i)"
        @dragover.prevent="dragOver = i"
        @drop.prevent="onDrop"
        @dragend="resetDrag"
      >
        <!-- 序号 -->
        <span class="w-6 text-center tabular-nums text-base-content/50 text-[0.95em] shrink-0">
          {{ i + 1 }}
        </span>

        <!-- 拖拽手柄：pointerdown 武装 draggable，dragstart 前生效 -->
        <div
          class="shrink-0 cursor-grab active:cursor-grabbing text-base-content/40 hover:text-base-content/70 p-1"
          title="Drag to reorder"
          aria-hidden="true"
          @pointerdown="arm"
        >
          <SvgIcon type="bars3" class="w-[1em] h-[1em]" />
        </div>

        <div class="w-10 h-10 shrink-0">
          <DatasetThumb :file-id="dataset.id" :alt="`Preview of ${dataset.name}`" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="font-medium truncate text-base-content" :title="dataset.name">
            {{ dataset.name }}
          </div>
          <div class="text-[0.85em] text-base-content/60 truncate">
            {{ [dataset.organism, dataset.submitter].filter(Boolean).join(' · ') || '–' }}
          </div>
        </div>

        <!-- 上移/下移：触屏与键盘可用的排序通道，边界禁用 -->
        <div class="flex items-center gap-1 shrink-0">
          <button
            class="btn btn-ghost btn-sm btn-square text-[1em]"
            title="Move up"
            :disabled="i === 0"
            :aria-label="`Move ${dataset.name} up`"
            @click="emit('move-up', i)"
          >
            <SvgIcon type="chevron_up" class="w-[1em] h-[1em]" />
          </button>
          <button
            class="btn btn-ghost btn-sm btn-square text-[1em]"
            title="Move down"
            :disabled="i === selected.length - 1"
            :aria-label="`Move ${dataset.name} down`"
            @click="emit('move-down', i)"
          >
            <SvgIcon type="chevron_down" class="w-[1em] h-[1em]" />
          </button>
          <button
            class="btn btn-ghost btn-sm btn-square text-[1em] text-error"
            title="Remove from collection"
            :aria-label="`Remove ${dataset.name}`"
            @click="emit('remove', dataset.id)"
          >
            <SvgIcon type="close" class="w-[1em] h-[1em]" />
          </button>
        </div>
      </div>
    </div>

    <!-- 空态 -->
    <div
      v-else
      class="border-2 border-dashed border-base-300 dark:border-slate-600 rounded-lg p-8 text-center text-base-content/50"
    >
      <SvgIcon type="queue_list" class="h-10 w-10 mx-auto mb-3 text-base-content/30" />
      <p>No datasets selected yet — pick datasets from the list above.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import DatasetThumb from '@/features/collections/components/DatasetThumb.vue'
import { useDragReorder } from '@/features/collections/composables/useDragReorder'
import type { File } from '@/features/datasets/types/dataset'

defineProps({
  selected: { type: Array as PropType<File[]>, required: true },
})

const emit = defineEmits<{
  (e: 'reorder', from: number, to: number): void
  (e: 'move-up', index: number): void
  (e: 'move-down', index: number): void
  (e: 'remove', id: string): void
  (e: 'clear-all'): void
}>()

// ---- 拖拽状态：手柄武装模式的 DnD 调序（useDragReorder 共用逻辑）----
const { armed, arm, dragFrom, dragOver, onDragStart, onDrop, resetDrag } = useDragReorder(
  (from, to) => emit('reorder', from, to),
)
</script>
