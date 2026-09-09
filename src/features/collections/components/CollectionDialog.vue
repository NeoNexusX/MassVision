<template>
  <!-- Create / Edit Collection 弹窗：沿用 ConfirmDialog 的 modal 骨架（dialog.modal + modal-box + backdrop） -->
  <dialog class="modal" :class="{ 'modal-open': open }">
    <div class="modal-box">
      <h3 class="text-lg font-bold flex items-center gap-2">
        <SvgIcon :type="editing ? 'pencil' : 'plus'" class="w-5 h-5 text-primary" />
        {{ editing ? 'Edit Collection' : 'Create Collection' }}
      </h3>

      <form class="py-4 flex flex-col gap-4" @submit.prevent="submit">
        <!-- 名称 -->
        <label class="flex flex-col gap-1.5">
          <span class="text-[0.9em] font-medium text-base-content/80">Name</span>
          <input
            v-model.trim="form.name"
            type="text"
            maxlength="80"
            class="input input-bordered w-full text-[0.95em]"
            placeholder="e.g. Human Kidney MALDI Atlas"
          />
        </label>

        <!-- 简介（可选） -->
        <label class="flex flex-col gap-1.5">
          <span class="text-[0.9em] font-medium text-base-content/80">
            Description <span class="font-normal text-base-content/50">(optional)</span>
          </span>
          <textarea
            v-model.trim="form.description"
            rows="3"
            maxlength="300"
            class="textarea textarea-bordered w-full text-[0.95em] resize-none"
            placeholder="What datasets does this collection bring together?"
          ></textarea>
          <span class="text-right text-xs text-base-content/50">
            {{ form.description.length }}/300
          </span>
        </label>

        <!-- 可见性 -->
        <div class="flex flex-col gap-1.5">
          <span class="text-[0.9em] font-medium text-base-content/80">Visibility</span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label
              class="flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors"
              :class="
                form.isPublic
                  ? 'border-primary bg-primary/5'
                  : 'border-base-300 hover:bg-base-200/60 dark:hover:bg-slate-700/60'
              "
            >
              <input type="radio" :value="true" v-model="form.isPublic" class="radio radio-primary radio-sm mt-0.5" />
              <span class="min-w-0">
                <span class="flex items-center gap-1.5 font-medium text-[0.95em] text-base-content">
                  <SvgIcon type="region" class="w-[1.05em] h-[1.05em]" />
                  Public
                </span>
                <span class="block mt-0.5 text-[0.8em] text-base-content/60">
                  Visible to all signed-in users.
                </span>
              </span>
            </label>
            <label
              class="flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors"
              :class="
                !form.isPublic
                  ? 'border-primary bg-primary/5'
                  : 'border-base-300 hover:bg-base-200/60 dark:hover:bg-slate-700/60'
              "
            >
              <input type="radio" :value="false" v-model="form.isPublic" class="radio radio-primary radio-sm mt-0.5" />
              <span class="min-w-0">
                <span class="flex items-center gap-1.5 font-medium text-[0.95em] text-base-content">
                  <SvgIcon type="password" class="w-[1.05em] h-[1.05em]" />
                  Private
                </span>
                <span class="block mt-0.5 text-[0.8em] text-base-content/60">
                  Only you and collaborators.
                </span>
              </span>
            </label>
          </div>
        </div>
      </form>

      <div class="modal-action">
        <button class="btn" @click="$emit('cancel')">Cancel</button>
        <button class="btn btn-primary" :disabled="!form.name" @click="submit">
          {{ editing ? 'Save Changes' : 'Create' }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="$emit('cancel')">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { Collection, CollectionDraft } from '@/features/collections/types/collection'

const props = defineProps<{
  open: boolean
  /** 传入则为编辑态，否则为新建态 */
  editing?: Collection | null
}>()

const emit = defineEmits<{
  (e: 'save', draft: CollectionDraft): void
  (e: 'cancel'): void
}>()

const form = reactive({ name: '', description: '', isPublic: true })

// 每次打开时按新建/编辑态初始化表单
watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.name = props.editing?.name ?? ''
    form.description = props.editing?.description ?? ''
    form.isPublic = props.editing?.isPublic ?? true
  },
)

const submit = () => {
  if (!form.name) return
  emit('save', {
    name: form.name,
    description: form.description,
    isPublic: form.isPublic,
    // 弹窗只改元信息，成员列表透传原集合的 datasetIds 以保留
    datasetIds: props.editing?.datasetIds ? [...props.editing.datasetIds] : [],
  })
}
</script>
