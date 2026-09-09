<template>
  <!-- Step 3 表单卡片：字段标记复制自 CollectionDialog（name/描述计数/可见性
       radio 卡片），但无状态——form 由父级持有，v-model:name 等三路绑定。
       这使 Edit 迁移到页面时可原样复用。 -->
  <section
    class="bg-base-100 dark:bg-slate-800 rounded-xl shadow-sm border border-base-300 p-4 sm:p-6"
  >
    <h2 class="text-[1.25em] font-bold text-base-content mb-4">Step 3: Collection Details</h2>

    <div class="flex flex-col gap-4">
      <!-- 名称 -->
      <label class="flex flex-col gap-1.5">
        <span class="text-[0.9em] font-medium text-base-content/80">
          Name <span class="text-error">*</span>
        </span>
        <input
          :value="name"
          type="text"
          maxlength="80"
          class="input input-bordered w-full text-[0.95em]"
          placeholder="e.g. Human Kidney MALDI Atlas"
          @update="$emit('update:name', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <!-- 简介（可选） -->
      <label class="flex flex-col gap-1.5">
        <span class="text-[0.9em] font-medium text-base-content/80">
          Description <span class="font-normal text-base-content/50">(optional)</span>
        </span>
        <textarea
          :value="description"
          rows="3"
          maxlength="300"
          class="textarea textarea-bordered w-full text-[0.95em] resize-none"
          placeholder="What datasets does this collection bring together?"
          @update="$emit('update:description', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <span class="text-right text-xs text-base-content/50">
          {{ description.length }}/300
        </span>
      </label>

      <!-- 可见性 -->
      <div class="flex flex-col gap-1.5">
        <span class="text-[0.9em] font-medium text-base-content/80">Visibility</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label
            class="flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors"
            :class="
              isPublic
                ? 'border-primary bg-primary/5'
                : 'border-base-300 hover:bg-base-200/60 dark:hover:bg-slate-700/60'
            "
          >
            <input
              type="radio"
              :value="true"
              :checked="isPublic"
              class="radio radio-primary radio-sm mt-0.5"
              @change="$emit('update:isPublic', true)"
            />
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
              !isPublic
                ? 'border-primary bg-primary/5'
                : 'border-base-300 hover:bg-base-200/60 dark:hover:bg-slate-700/60'
            "
          >
            <input
              type="radio"
              :value="false"
              :checked="!isPublic"
              class="radio radio-primary radio-sm mt-0.5"
              @change="$emit('update:isPublic', false)"
            />
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
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  name: string
  description: string
  isPublic: boolean
}>()

defineEmits<{
  (e: 'update:name', value: string): void
  (e: 'update:description', value: string): void
  (e: 'update:isPublic', value: boolean): void
}>()
</script>
