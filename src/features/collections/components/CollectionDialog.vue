<template>
  <!-- 集合元信息编辑弹窗（overview 内嵌 Edit）：表单体直接复用 CollectionFormCard
       （name≤80 / description≤300 校验现成）。提交只发送出现且变化的字段
       （exclude_unset 语义），成功后由父级用返回的 CollectionDetail 更新页面。 -->
  <dialog class="modal" :class="{ 'modal-open': open }">
    <div class="modal-box max-w-lg page-type">
      <h3 class="text-[1.15em] font-bold text-base-content mb-4">Edit Collection</h3>

      <CollectionFormCard v-model:name="name" v-model:description="description" />

      <p v-if="validationError" class="text-error text-[0.85em] mt-2">{{ validationError }}</p>

      <div class="modal-action">
        <button class="btn text-[1em]" :disabled="saving" @click="close">Cancel</button>
        <button
          class="btn btn-primary text-[1em]"
          :disabled="saving || !name.trim() || !dirty"
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
import { computed, ref, watch } from 'vue'
import type { PropType } from 'vue'
import CollectionFormCard from '@/features/collections/components/CollectionFormCard.vue'
import { useToast } from '@/shared/composables/useToast'
import { collectionErrorMessage, updateCollection } from '../api/collectionApi'
import type { CollectionDetail, CollectionPatchPayload } from '../types/collection'

const props = defineProps({
  open: { type: Boolean, required: true },
  collection: { type: Object as PropType<CollectionDetail | null>, default: null },
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', detail: CollectionDetail): void
}>()

const { showToast } = useToast()

const name = ref('')
const description = ref('')
const saving = ref(false)
const validationError = ref('')

// 每次打开时用集合当前值初始化表单
watch(
  () => props.open,
  (open) => {
    if (open && props.collection) {
      name.value = props.collection.name
      description.value = props.collection.description ?? ''
      validationError.value = ''
    }
  },
)

const dirty = computed(() => {
  if (!props.collection) return false
  return (
    name.value !== props.collection.name ||
    description.value !== (props.collection.description ?? '')
  )
})

async function save() {
  if (!props.collection || saving.value) return
  const trimmed = name.value.trim()
  if (!trimmed) {
    validationError.value = 'Name is required.'
    return
  }
  if (trimmed.length > 80) {
    validationError.value = 'Name must be at most 80 characters.'
    return
  }
  if (description.value.length > 300) {
    validationError.value = 'Description must be at most 300 characters.'
    return
  }

  // 只放变化字段（PATCH exclude_unset 语义）
  const patch: CollectionPatchPayload = {}
  if (trimmed !== props.collection.name) patch.name = trimmed
  if (description.value !== (props.collection.description ?? ''))
    patch.description = description.value

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
