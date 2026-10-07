<template>
  <!-- 技能按钮（前）+ 快捷提问（后）：技能按钮触发"加载 SKILL.md 并按模板
       执行"的完整分析流程，快捷提问是单句轻量提问。 -->
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="s in skills"
      :key="`skill-${s.name}`"
      class="btn btn-secondary btn-outline btn-xs rounded-full"
      @click="$emit('skill', s.text)"
    >
      {{ skillLabels[s.name] ?? s.name }}
    </button>
    <button
      v-for="p in prompts"
      :key="p.tKey"
      class="btn btn-outline btn-xs rounded-full"
      @click="$emit('ask', p.text)"
    >
      {{ labels[p.tKey] }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /** 技能按钮（在前）：name + 触发提示词 */
  skills: { name: string; text: string }[]
  /** 技能名 → 界面语言标签（缺省回退技能名本身） */
  skillLabels: Record<string, string>
  prompts: { tKey: string; text: string }[]
  labels: Record<string, string>
}>()

defineEmits<{ ask: [text: string]; skill: [text: string] }>()
</script>
