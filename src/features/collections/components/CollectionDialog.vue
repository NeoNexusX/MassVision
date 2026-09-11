<template>
  <!-- 集合元数据编辑弹窗（overview 内嵌 Edit）：完整 22 字段表单，
       由 CollectionMetadataForm 表驱动渲染，草稿差量（buildMetadataPatch）
       决定提交内容——只发变化的字段（exclude_unset 语义）。
       内容较长，弹窗体限高滚动。 -->
  <dialog class="modal" :class="{ 'modal-open': open }">
    <div class="modal-box max-w-2xl page-type">
      <h3 class="text-[1.15em] font-bold text-base-content mb-4">Edit Collection</h3>

      <div class="max-h-[60vh] overflow-y-auto pr-1">
        <CollectionMetadataForm v-if="draft" :draft="draft" />
      </div>

      <p v-if="validationError" class="text-error text-[0.85em] mt-2">{{ validationError }}</p>

      <div class="modal-action">
        <button class="btn text-[1em]" :disabled="saving" @click="close">Cancel</button>
        <button
          class="btn btn-primary text-[1em]"
          :disabled="saving || !draft?.name?.trim() || !dirty"
          @click="save"
        >
          <span v-if="saving" class="loading loading-spinner loading-sm"></span>
          Save Changes
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="close">
      <button @click.prevent="close">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, type PropType } from 'vue'
import CollectionMetadataForm from '@/features/collections/components/CollectionMetadataForm.vue'
import { useToast } from '@/shared/composables/useToast'
import { collectionErrorMessage, updateCollection } from '../api/collectionApi'
import { buildMetadataPatch, toMetadataDraft } from '../utils/metadataPatch'
import type { CollectionDetail, CollectionMetadataDraft } from '../types/collection'

const props = defineProps({
  open: { type: Boolean, required: true },
  collection: { type: Object as PropType<CollectionDetail | null>, default: null },
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', detail: CollectionDetail): void
}>()

const { showToast } = useToast()

const draft = ref<CollectionMetadataDraft | null>(null)
const saving = ref(false)
const validationError = ref('')

// 每次打开时用集合当前元数据初始化草稿（name/description 以顶层字段为准）
watch(
  () => props.open,
  (open) => {
    if (open && props.collection) {
      draft.value = reactive(
        toMetadataDraft({
          ...props.collection.metadata,
          name: props.collection.name,
          description: props.collection.description ?? '',
        }),
      )
      validationError.value = ''
    }
  },
)

// 差量即脏态：没有变化的字段时 Save 禁用
const dirty = computed(() => {
  if (!props.collection || !draft.value) return false
  return Object.keys(currentPatch()).length > 0
})

function currentPatch() {
  return buildMetadataPatch(
    {
      ...props.collection!.metadata,
      name: props.collection!.name,
      description: props.collection!.description ?? '',
    },
    draft.value!,
  )
}

async function save() {
  if (!props.collection || !draft.value || saving.value) return
  const name = draft.value.name.trim()
  if (!name) {
    validationError.value = 'Name is required.'
    return
  }
  if (name.length > 80) {
    validationError.value = 'Name must be at most 80 characters.'
    return
  }
  if ((draft.value.description ?? '').length > 300) {
    validationError.value = 'Description must be at most 300 characters.'
    return
  }

  const patch = currentPatch()
  if (!Object.keys(patch).length) {
    close()
    return
  }

  saving.value = true
  validationError.value = ''
  try {
    const detail = await updateCollection(props.collection.id, patch)
    showToast('Collection updated', 'success')
    emit('saved', detail)
    emit('close')
  } catch (err: any) {
    showToast(collectionErrorMessage(err, 'Failed to update collection'), 'error')
  } finally {
    saving.value = false
  }
}

function close() {
  if (saving.value) return
  emit('close')
}
</script>
