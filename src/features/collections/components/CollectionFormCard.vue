<template>
  <!-- Step 3 表单卡片：无状态——form 由父级持有，v-model:name / v-model:description
       两路绑定。Create Collection 与 overview 内嵌 Edit 共用（集合均为公开，
       无可见性开关）。 -->
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
          @input="$emit('update:name', ($event.target as HTMLInputElement).value)"
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
          @input="$emit('update:description', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <span class="text-right text-xs text-base-content/50">
          {{ description.length }}/300
        </span>
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  name: string
  description: string
}>()

defineEmits<{
  (e: 'update:name', value: string): void
  (e: 'update:description', value: string): void
}>()
</script>
