<template>
  <!-- 集合元数据编辑表单：由 metadataFields 定义表驱动（与只读面板同一张表，
       单一事实来源）。list 字段用 TagInput（带词表的字段同时有下拉建议），long 字段用 textarea，其余 input。
       草稿由父级（CollectionOverviewView / CreateCollectionView）持有并传入，
       本组件只做字段绑定与「自动推导」提示，不做提交。
       excludeKeys：创建页把 name/description 交给专门的卡片，这里不重复渲染；
       autoKeys/editedKeys：可从选中数据集推导的字段，及其中与识别值不一致（用户手改）的字段。 -->
  <div class="flex flex-col gap-5">
    <section v-for="group in METADATA_GROUPS" :key="group.id">
      <h4
        v-if="fieldsOf(group.id).length"
        class="kawaru-text-87 font-semibold uppercase tracking-wide text-base-content/50
          border-b border-base-200 dark:border-slate-700 pb-1 mb-3"
      >
        {{ group.label() }}
      </h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <div
          v-for="field in fieldsOf(group.id)"
          :key="field.key"
          class="flex flex-col gap-1 min-w-0"
          :class="field.type === 'long' ? 'sm:col-span-2' : ''"
        >
          <!-- list 字段不能包在 <label> 里：label 会把点击转发给首个可标注的后代，
               也就是第一个 chip 的 ✕ 按钮，点字段名就会误删标签 -->
          <component
            :is="field.type === 'list' ? 'div' : 'label'"
            class="flex flex-col gap-1 min-w-0"
          >
            <span class="kawaru-text-81 font-medium text-base-content/70">
              {{ field.label() }}
              <span v-if="field.key === 'name' || requiredKeys.includes(field.key)" class="text-error">*</span>
            </span>

            <input
              v-if="field.type === 'text'"
              v-model="d[field.key]"
              type="text"
              class="input input-bordered w-full kawaru-text-95"
              :maxlength="field.key === 'name' ? 80 : undefined"
              :placeholder="placeholderOf(field)"
            />
            <!-- date 档位：原生日期选择器（点选录入，杜绝手输格式问题）。空值格式提示
                 跟随浏览器语言、无法定制，属可接受代价；值/草稿均为 YYYY-MM-DD（ISO 8601），
                 清空即显式置空，PATCH 会发送 '' -->
            <input
              v-else-if="field.type === 'date'"
              v-model="d[field.key]"
              type="date"
              class="input input-bordered w-full kawaru-text-95"
            />
            <!-- 长文本统一 300 上限（与创建页 description 的 maxlength 一致；
                 后端逐字段上限确认后可再按字段细化） -->
            <textarea
              v-else-if="field.type === 'long'"
              v-model="d[field.key]"
              rows="2"
              maxlength="300"
              class="textarea textarea-bordered w-full kawaru-text-95 resize-none"
              :placeholder="placeholderOf(field)"
            ></textarea>
            <TagInput
              v-else
              v-model="d[field.key]"
              :name="field.label()"
              :options="field.options"
              :label-of="collectionVocabLabel"
              :placeholder="placeholderOf(field)"
            />
          </component>

          <!-- 用户接管了自动推导的字段后，给一个回到「按数据集识别」的入口 -->
          <div
            v-if="autoKeys.includes(field.key) && editedKeys.includes(field.key)"
            class="flex items-center gap-1.5 kawaru-text-75 text-base-content/50"
          >
            <span>{{ $t('collections.metaForm.editedByHand') }}</span>
            <button
              type="button"
              class="text-primary hover:underline"
              @click="emit('reset-field', field.key)"
            >
              {{ $t('collections.metaForm.resetToDetected') }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import TagInput from '@/shared/components/TagInput.vue'
import { collectionVocabLabel } from '../constants/collectionVocab'
import {
  METADATA_FIELDS,
  METADATA_GROUPS,
  type MetadataFieldDef,
  type MetadataGroupId,
} from '../constants/metadataFields'
import type { CollectionMetadataDraft } from '../types/collection'

const props = defineProps({
  /** 父级持有的草稿（reactive），本组件直接绑定其字段 */
  draft: { type: Object as PropType<CollectionMetadataDraft>, required: true },
  /** 由父级另行渲染、本表单跳过的字段键 */
  excludeKeys: { type: Array as PropType<readonly string[]>, default: () => [] },
  /** 当前由选中数据集自动推导（预填）的字段键 */
  autoKeys: { type: Array as PropType<readonly string[]>, default: () => [] },
  /** 与识别值不一致（用户手改）的字段键：显示「已手动修改 / 恢复为自动识别值」 */
  editedKeys: { type: Array as PropType<readonly string[]>, default: () => [] },
  /** 前端必填的字段键（红 * 标注）。仅创建流程传入；编辑流程不传，维持 PATCH 全可选语义 */
  requiredKeys: { type: Array as PropType<readonly string[]>, default: () => [] },
})

const emit = defineEmits<{
  (e: 'reset-field', key: string): void
}>()

// v-model 到「联合键」的索引写入在 TS 下不可赋值，松化一层仅用于模板绑定；
// 对外 API 仍以 CollectionMetadataDraft 强类型约束。
const d = computed(() => props.draft as Record<string, any>)

function fieldsOf(group: MetadataGroupId) {
  return METADATA_FIELDS.filter(
    (f) => f.group === group && !props.excludeKeys.includes(f.key as string),
  )
}

function placeholderOf(field: MetadataFieldDef): string | undefined {
  return field.placeholder?.()
}
</script>
