<template>
  <!-- 数据集元信息编辑弹窗（Dataset Overview 内嵌）：
       PATCH /files/{file_id}，可改样本属性 8 个（文本 + 领域词表 datalist 建议）
       + spectrum_mode / storage_mode（枚举下拉）。差量提交只发变化的键；
       枚举字段空值（“—”）不发送。保存成功后把返回的 FilePublic 交回父级。 -->
  <dialog class="modal" :class="{ 'modal-open': open }">
    <div class="modal-box w-11/12 max-w-2xl page-type">
      <h3 class="text-[1.15em] font-bold text-base-content mb-1">Edit Metadata</h3>
      <p class="text-[0.8em] text-base-content/50 mb-4 truncate" :title="dataset?.filename">
        {{ dataset?.filename }}
      </p>

      <!-- v-if 守卫：dialog 常驻 DOM（modal-open 只切显隐），draft 在打开时才
           初始化；无守卫会在关闭状态下渲染 null 的字段绑定，整个页面崩掉 -->
      <div v-if="draft" class="max-h-[60vh] overflow-y-auto pr-2">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <!-- 8 个样本属性：与上传表单同款 SelectWithOther（词表 + Other 自定义输入）。
               当前值不在词表内时组件自动落到 Other 输入框回显。 -->
          <label
            v-for="field in TEXT_FIELDS"
            :key="field.key"
            class="flex flex-col gap-1 min-w-0"
          >
            <span class="text-[0.8em] font-medium text-base-content/70">{{ field.label }}</span>
            <SelectWithOther
              v-model="draft![field.key]"
              :options="field.suggestions"
              :placeholder="`Select ${field.label.toLowerCase()}...`"
              other-placeholder="Please specify..."
            />
          </label>

          <!-- 枚举：IconSelect 下拉；选回占位「—」= 不修改该字段 -->
          <label class="flex flex-col gap-1 min-w-0">
            <span class="text-[0.8em] font-medium text-base-content/70">Spectrum Mode</span>
            <IconSelect
              v-model="draft!.spectrum_mode"
              :options="SPECTRUM_MODES"
              placeholder="—"
              hide-label
            />
          </label>
          <label class="flex flex-col gap-1 min-w-0">
            <span class="text-[0.8em] font-medium text-base-content/70">Storage Mode</span>
            <IconSelect
              v-model="draft!.storage_mode"
              :options="STORAGE_MODES"
              placeholder="—"
              hide-label
            />
          </label>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn text-[1em]" :disabled="saving" @click="close">Cancel</button>
        <button class="btn btn-primary text-[1em]" :disabled="saving || !dirty" @click="save">
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
import IconSelect from '@/shared/components/IconSelect.vue'
import SelectWithOther from '@/shared/components/SelectWithOther.vue'
import {
  CONDITIONS,
  MALDI_MATRICES,
  MALDI_MATRIX_APPLICATIONS,
  ORGANISMS,
  ORGANISM_PARTS,
  SAMPLE_GROWTH_CONDITIONS,
  SAMPLE_STABILIZATIONS,
  SPECTRUM_MODES,
  STORAGE_MODES,
  TISSUE_MODIFICATIONS,
} from '@/features/datasets/constants/datasetMetadata'
import { mapItemToDataset } from '@/features/datasets/mappers/datasetMapper'
import { patchFileMetadata } from '@/features/datasets/api/datasetApi'
import {
  buildFileMetadataPatch,
  toFileMetadataDraft,
  type FileMetadataDraft,
  type FileMetadataKey,
} from '@/features/datasets/utils/fileMetadataPatch'
import type { File } from '@/features/datasets/types/dataset'
import { extractBackendError } from '@/shared/api/httpClient'
import { useToast } from '@/shared/composables/useToast'

const props = defineProps({
  open: { type: Boolean, required: true },
  dataset: { type: Object as PropType<File | null>, default: null },
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', file: File): void
}>()

const { showToast } = useToast()

const TEXT_FIELDS: { key: FileMetadataKey; label: string; suggestions: readonly string[] }[] = [
  { key: 'organism', label: 'Organism', suggestions: ORGANISMS },
  { key: 'organism_part', label: 'Organism Part', suggestions: ORGANISM_PARTS },
  { key: 'condition', label: 'Condition', suggestions: CONDITIONS },
  { key: 'sample_growth_conditions', label: 'Growth Conditions', suggestions: SAMPLE_GROWTH_CONDITIONS },
  { key: 'sample_stabilization', label: 'Stabilization', suggestions: SAMPLE_STABILIZATIONS },
  { key: 'tissue_modification', label: 'Tissue Modification', suggestions: TISSUE_MODIFICATIONS },
  { key: 'maldi_matrix', label: 'MALDI Matrix', suggestions: MALDI_MATRICES },
  { key: 'maldi_matrix_application', label: 'Matrix Application', suggestions: MALDI_MATRIX_APPLICATIONS },
]

const draft = ref<FileMetadataDraft | null>(null)
const saving = ref(false)

// 每次打开时从 File 当前值初始化草稿
watch(
  () => props.open,
  (open) => {
    if (open && props.dataset) {
      draft.value = reactive(toFileMetadataDraft(props.dataset))
    }
  },
)

const dirty = computed(() => {
  if (!props.dataset || !draft.value) return false
  return Object.keys(buildFileMetadataPatch(props.dataset, draft.value)).length > 0
})

async function save() {
  if (!props.dataset || !draft.value || saving.value) return
  const patch = buildFileMetadataPatch(props.dataset, draft.value)
  if (!Object.keys(patch).length) {
    close()
    return
  }

  saving.value = true
  try {
    const raw = await patchFileMetadata(props.dataset.id, patch)
    // 响应为更新后的 FilePublic（与列表行同构），复用 mapper 转成前端 File
    showToast('Metadata updated', 'success')
    emit('saved', mapItemToDataset(raw))
    emit('close')
  } catch (err: any) {
    showToast(extractBackendError(err, 'Failed to update metadata'), 'error')
  } finally {
    saving.value = false
  }
}

function close() {
  if (saving.value) return
  emit('close')
}
</script>
