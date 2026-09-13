<template>
  <!-- 集合成员列表：行 = 缩略图 + 文件名 + 大小 + 下载。
       manageMode（owner/admin）下额外提供：Add Members 按钮、行复选多选 +
       Remove Selected（批量移除）、手柄拖拽 + 上移/下移（调序，全量重写语义）。
       只读模式（公开页/非 owner）隐藏全部管理控件。 -->
  <section
    class="bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm border border-base-300 p-4 sm:p-6"
  >
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 class="kawaru-text-125 font-bold text-base-content flex items-center gap-2">
        Members
        <span
          v-if="members.length"
          class="badge badge-sm font-medium border border-base-300 bg-base-200 text-base-content/70 kawaru-text-75"
        >
          {{ members.length }}/{{ limit }} datasets
        </span>
      </h2>

      <!-- 管理工具条 -->
      <div v-if="manageMode" class="flex flex-wrap items-center gap-2">
        <button
          class="btn btn-sm btn-primary kawaru-text-95"
          :disabled="adding"
          @click="emit('add')"
        >
          <SvgIcon v-if="!adding" type="plus" class="w-[1em] h-[1em]" />
          <span v-else class="loading loading-spinner loading-xs"></span>
          Add Members
        </button>
        <button
          class="btn btn-sm btn-outline border-base-300 text-error kawaru-text-95"
          :disabled="!selectedIds.size || removing"
          @click="confirmRemove"
        >
          <SvgIcon type="trash" class="w-[1em] h-[1em]" />
          Remove Selected{{ selectedIds.size ? ` (${selectedIds.size})` : '' }}
        </button>
      </div>
    </div>

    <div v-if="members.length" class="flex flex-col gap-1 border border-base-200 dark:border-slate-700 rounded-md p-2">
      <div class="kawaru-text-87"
        v-for="(member, i) in members"
        :key="member.id"
        :draggable="manageMode && armed"
        :class="[
          'relative px-3 py-2 rounded-lg flex items-center gap-3 select-none transition-opacity',
          manageMode ? 'cursor-default' : '',
          dragFrom === i ? 'opacity-40' : '',
          dragOver === i && dragFrom !== i ? 'border-t-2 border-t-primary' : '',
        ]"
        @dragstart="manageMode && onDragStart($event, i)"
        @dragover.prevent="manageMode && (dragOver = i)"
        @drop.prevent="manageMode && onDrop()"
        @dragend="manageMode && resetDrag()"
      >
        <!-- 多选框（仅管理模式） -->
        <input
          v-if="manageMode"
          type="checkbox"
          class="checkbox checkbox-sm checkbox-primary shrink-0"
          :checked="selectedIds.has(member.id)"
          :aria-label="`Select ${member.filename}`"
          @change="toggleSelect(member.id)"
        />

        <!-- 序号 + 拖拽手柄（管理模式） -->
        <span class="w-6 text-center tabular-nums text-base-content/50 kawaru-text-95 shrink-0">
          {{ i + 1 }}
        </span>
        <div
          v-if="manageMode"
          class="shrink-0 cursor-grab active:cursor-grabbing text-base-content/40 hover:text-base-content/70 p-1"
          title="Drag to reorder"
          aria-hidden="true"
          @pointerdown="arm"
        >
          <SvgIcon type="bars3" class="w-[1em] h-[1em]" />
        </div>

        <div class="w-10 h-10 shrink-0">
          <DatasetThumb :file-id="String(member.id)" :alt="`Preview of ${member.filename}`" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="font-medium truncate text-base-content" :title="member.filename">
            {{ member.filename }}
          </div>
          <div class="kawaru-text-87 text-base-content/60 truncate">
            {{ [member.experimentType, member.status].filter(Boolean).join(' · ') || '–' }}
          </div>
        </div>

        <div class="kawaru-text-87 text-base-content/60 whitespace-nowrap tabular-nums shrink-0">
          {{ formatBytes(member.size) }}
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <!-- 上移/下移：触屏与键盘可用的排序通道，边界禁用（e2e 也走这里） -->
          <template v-if="manageMode">
            <button
              class="btn btn-ghost btn-sm btn-square kawaru-text-100"
              title="Move up"
              :disabled="i === 0 || reordering"
              :aria-label="`Move ${member.filename} up`"
              @click="emit('reorder', i, i - 1)"
            >
              <SvgIcon type="chevron_up" class="w-[1em] h-[1em]" />
            </button>
            <button
              class="btn btn-ghost btn-sm btn-square kawaru-text-100"
              title="Move down"
              :disabled="i === members.length - 1 || reordering"
              :aria-label="`Move ${member.filename} down`"
              @click="emit('reorder', i, i + 1)"
            >
              <SvgIcon type="chevron_down" class="w-[1em] h-[1em]" />
            </button>
          </template>

          <button
            class="btn btn-ghost btn-sm kawaru-text-95 text-primary hover:text-primary-focus"
            :title="`Download ${member.filename}`"
            :aria-label="`Download ${member.filename}`"
            @click="emit('download', member)"
          >
            <SvgIcon type="download" class="w-[1em] h-[1em]" />
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
      <p v-if="manageMode">No members yet — add public imzML datasets to this collection.</p>
      <p v-else>This collection has no members.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { PropType } from 'vue'
import DatasetThumb from '@/features/collections/components/DatasetThumb.vue'
import { useDragReorder } from '@/features/collections/composables/useDragReorder'
import { formatBytes } from '@/shared/utils/format'
import type { CollectionMember } from '../types/collection'

const props = defineProps({
  members: { type: Array as PropType<CollectionMember[]>, required: true },
  /** owner/admin 视图：显示 Add/Remove/调序控件 */
  manageMode: { type: Boolean, default: false },
  adding: { type: Boolean, default: false },
  removing: { type: Boolean, default: false },
  reordering: { type: Boolean, default: false },
  /** 后端成员上限（超出 409 collection member limit exceeded）。
   *  必须是字面量：defineProps 会被提升到模块作用域，不能引用本地变量。 */
  limit: { type: Number, default: 300 },
})

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'remove', ids: number[]): void
  (e: 'reorder', from: number, to: number): void
  (e: 'download', member: CollectionMember): void
}>()

// ---- 多选（仅管理模式）----
const selectedIds = reactive(new Set<number>())

function toggleSelect(id: number) {
  if (selectedIds.has(id)) selectedIds.delete(id)
  else selectedIds.add(id)
}

function confirmRemove() {
  if (!selectedIds.size) return
  emit('remove', [...selectedIds])
}

// 成员列表变化后清掉失效的选择（移除成功/重拉都会走这里）
watch(
  () => props.members,
  (members) => {
    const valid = new Set(members.map((m) => m.id))
    for (const id of [...selectedIds]) {
      if (!valid.has(id)) selectedIds.delete(id)
    }
  },
)

// ---- 拖拽调序（手柄武装 DnD，与 SelectedDatasetList 同模式）----
const { armed, arm, dragFrom, dragOver, onDragStart, onDrop, resetDrag } = useDragReorder(
  (from, to) => emit('reorder', from, to),
)
</script>
