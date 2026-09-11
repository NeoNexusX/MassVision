<template>
  <!-- 集合元数据编辑表单：由 metadataFields 定义表驱动（与只读面板同一张表，
       单一事实来源）。list 字段用 TagInput，long 字段用 textarea，其余 input。
       草稿由父级（CollectionDialog）持有并传入，本组件只做字段绑定，不做提交。 -->
  <div class="flex flex-col gap-5">
    <section v-for="group in visibleGroups" :key="group.id">
      <h4
        class="text-[0.85em] font-semibold uppercase tracking-wide text-base-content/50
          border-b border-base-200 dark:border-slate-700 pb-1 mb-3"
      >
        {{ group.label }}
      </h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <label
          v-for="field in fieldsOf(group.id)"
          :key="field.key"
          class="flex flex-col gap-1 min-w-0"
          :class="field.type === 'long' ? 'sm:col-span-2' : ''"
        >
          <span class="text-[0.8em] font-medium text-base-content/70">
            {{ field.label }}
            <span v-if="field.key === 'name'" class="text-error">*</span>
          </span>

          <input
            v-if="field.type === 'text'"
            v-model="d[field.key]"
            type="text"
            class="input input-bordered w-full text-[0.95em]"
            :maxlength="field.key === 'name' ? 80 : undefined"
            :placeholder="placeholderOf(field)"
          />
          <textarea
            v-else-if="field.type === 'long'"
            v-model="d[field.key]"
            rows="2"
            class="textarea textarea-bordered w-full text-[0.95em] resize-none"
            :placeholder="placeholderOf(field)"
          ></textarea>
          <TagInput v-else v-model="d[field.key]" :name="field.label" :placeholder="placeholderOf(field)" />
        </label>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import TagInput from '@/shared/components/TagInput.vue'
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
})

// v-model 到「联合键」的索引写入在 TS 下不可赋值，松化一层仅用于模板绑定；
// 对外 API 仍以 CollectionMetadataDraft 强类型约束。
const d = computed(() => props.draft as Record<string, any>)

function fieldsOf(group: MetadataGroupId) {
  return METADATA_FIELDS.filter((f) => f.group === group)
}

const visibleGroups = computed(() => METADATA_GROUPS)

function placeholderOf(field: MetadataFieldDef): string {
  if (field.key === 'doi') return '10.1000/xyz123'
  if (field.type === 'list') return `Add ${field.label.toLowerCase()}`
  return ''
}
</script>
