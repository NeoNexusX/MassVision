<template>
  <!-- 集合学术元数据的只读面板：由 metadataFields 定义表驱动（单一事实来源，
       二期编辑表单复用同表）。按组分区渲染，未填写的字段隐藏（避免大片空白），
       组内全部为空时整组隐藏；头部显示“已填写 N/M”概览。 -->
  <section
    class="bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm border border-base-300 p-4 sm:p-6"
  >
    <div class="flex items-center justify-between gap-3 mb-4">
      <h2 class="text-[1.25em] font-bold text-base-content">Collection Metadata</h2>
      <span
        v-if="filledCount"
        class="badge badge-sm font-medium border border-base-300 bg-base-200 text-base-content/70 whitespace-nowrap"
      >
        {{ filledCount }}/{{ METADATA_FIELDS.length }} fields
      </span>
    </div>

    <template v-for="group in visibleGroups" :key="group.id">
      <h3
        class="text-[0.95em] font-semibold uppercase tracking-wide text-base-content/50
          border-b border-base-200 dark:border-slate-700 pb-1 mb-3"
      >
        {{ group.label }}
      </h3>
      <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mb-6">
        <div
          v-for="field in fieldsOf(group.id)"
          :key="field.key"
          class="flex flex-col gap-0.5 min-w-0"
          :class="field.type === 'long' ? 'md:col-span-2' : ''"
        >
          <dt class="text-[0.8em] font-medium text-base-content/50">{{ field.label }}</dt>
          <!-- list 字段渲染为 chips，text/long 直接展示文本 -->
          <dd v-if="field.type === 'list'" class="flex flex-wrap gap-1.5">
            <span
              v-for="item in asList(metadata[field.key])"
              :key="String(item)"
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.8em] font-medium
                bg-base-200/80 text-base-content/70 border border-base-300
                dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
            >
              {{ item }}
            </span>
          </dd>
          <dd
            v-else-if="field.type === 'long'"
            class="text-[0.92em] leading-relaxed text-base-content/80 whitespace-pre-line"
          >
            {{ metadata[field.key] }}
          </dd>
          <dd v-else class="text-[0.95em] text-base-content/80 break-words">
            {{ metadata[field.key] }}
          </dd>
        </div>
      </dl>
    </template>

    <!-- 全部字段都未填写 -->
    <div
      v-if="!filledCount"
      class="border-2 border-dashed border-base-300 dark:border-slate-600 rounded-lg p-6 text-center text-base-content/50"
    >
      <p>No metadata has been added to this collection yet.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
import {
  METADATA_FIELDS,
  METADATA_GROUPS,
  hasMetadataValue,
  type MetadataGroupId,
} from '../constants/metadataFields'
import type { CollectionMetadata } from '../types/collection'

const props = defineProps({
  metadata: { type: Object as PropType<CollectionMetadata>, required: true },
})

function fieldsOf(group: MetadataGroupId) {
  return METADATA_FIELDS.filter(
    (f) => f.group === group && hasMetadataValue(props.metadata, f),
  )
}

const visibleGroups = computed(() =>
  METADATA_GROUPS.filter((g) => fieldsOf(g.id).length > 0),
)

const filledCount = computed(
  () => METADATA_FIELDS.filter((f) => hasMetadataValue(props.metadata, f)).length,
)

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value]
}
</script>
