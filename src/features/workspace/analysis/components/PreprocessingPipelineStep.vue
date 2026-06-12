<script setup lang="ts">
import IconSelect from '@/shared/components/IconSelect.vue'
import type { MethodGroup } from '@/features/workspace/analysis/composables/usePreprocessingMethods'

defineProps<{
  availableMethods: MethodGroup[]
  isFiltered: boolean
  modeNotice: string
  selectedMethods: Record<string, string>
  methodParams: Record<string, string | number>
  buildParamKey: (groupKey: string, methodId: string, paramKey: string) => string
  getParam: (groupKey: string, methodId: string, paramKey: string) => string | number | undefined
  isSelected: (groupKey: string, methodId: string) => boolean
  toggleSingle: (groupKey: string, methodId: string, event?: MouseEvent) => void
  onIntInput: (groupKey: string, methodId: string, paramKey: string, event: Event) => void
  onFloatInput: (groupKey: string, methodId: string, paramKey: string, event: Event) => void
  onNumBlur: (groupKey: string, methodId: string, paramKey: string, kind: 'int' | 'float') => void
}>()
</script>

<template>
  <details open class="bg-base-100 rounded-lg border border-base-200 p-6 shadow-sm">
    <summary class="text-3xl font-medium mb-4 list-none">Step 2: Preprocessing Pipeline</summary>

    <div class="space-y-4 mt-2">
      <div
        v-if="isFiltered"
        class="flex items-start gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-lg text-blue-700 dark:text-blue-300"
      >
        <span class="mt-0.5">ℹ</span>
        <span>{{ modeNotice }}</span>
      </div>
      <div
        v-for="group in availableMethods"
        :key="group.key"
        class="border border-base-200 rounded-md p-4"
      >
        <div>
          <div class="flex items-center justify-between">
            <div class="font-medium text-xl">{{ group.title }}</div>
          </div>
          <div v-if="group.hint" class="text-base text-base-content/60 mt-1">
            {{ group.hint }}
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-3">
          <div v-for="method in group.methods" :key="method.id" class="flex flex-col">
            <label
              :class="[
                'flex items-center gap-2 h-10 px-4 rounded-md text-lg transition-colors cursor-pointer select-none',
                isSelected(group.key, method.id)
                  ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                  : 'bg-base-100 border border-base-300 text-base-content hover:bg-base-200',
              ]"
              @click="toggleSingle(group.key, method.id, $event)"
            >
              <input
                type="radio"
                class="sr-only"
                :name="group.key"
                :value="method.id"
                :checked="isSelected(group.key, method.id)"
              />
              <span v-if="isSelected(group.key, method.id)" class="text-blue-600 dark:text-blue-400">✔</span>
              <span class="truncate">{{ method.label }}</span>
              <span v-if="method.note" class="ml-2 text-base text-base-content/50">{{
                method.note
              }}</span>
            </label>

            <div
              v-if="isSelected(group.key, method.id) && method.params?.length"
              class="mt-2 ml-4 grid grid-cols-2 gap-2"
            >
              <div v-for="param in method.params" :key="param.key" class="flex items-center gap-2">
                <span class="text-lg text-base-content/60 w-32 shrink-0 whitespace-nowrap" :title="param.hint">{{
                  param.label
                }}</span>
                <template v-if="param.type === 'select'">
                  <IconSelect
                    class="flex-1 max-w-28"
                    size="sm"
                    :model-value="String(getParam(group.key, method.id, param.key) ?? '')"
                    :options="[...new Set(param.options!.map((o) => o.value))]"
                    :placeholder="param.hint || 'Select...'"
                    hide-label
                    required
                    @update:model-value="
                      methodParams[buildParamKey(group.key, method.id, param.key)] = $event
                    "
                  />
                </template>
                <template v-else-if="param.type === 'text'">
                  <input
                    class="input input-sm input-bordered flex-1 max-w-28 text-lg font-mono"
                    type="text"
                    :placeholder="param.hint || String(param.default ?? '')"
                    :value="getParam(group.key, method.id, param.key)"
                    @input="
                      methodParams[buildParamKey(group.key, method.id, param.key)] = (
                        $event.target as HTMLInputElement
                      ).value
                    "
                  />
                </template>
                <template v-else-if="param.type === 'number'">
                  <input
                    class="input input-sm input-bordered flex-1 max-w-28 text-lg font-mono"
                    type="text"
                    inputmode="numeric"
                    :placeholder="param.hint || String(param.default ?? '')"
                    :value="getParam(group.key, method.id, param.key)"
                    @input="onIntInput(group.key, method.id, param.key, $event)"
                    @blur="onNumBlur(group.key, method.id, param.key, 'int')"
                  />
                </template>
                <template v-else-if="param.type === 'float'">
                  <input
                    class="input input-sm input-bordered flex-1 max-w-28 text-lg font-mono"
                    type="text"
                    inputmode="decimal"
                    :placeholder="param.hint || String(param.default ?? '')"
                    :value="getParam(group.key, method.id, param.key)"
                    @input="onFloatInput(group.key, method.id, param.key, $event)"
                    @blur="onNumBlur(group.key, method.id, param.key, 'float')"
                  />
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </details>
</template>
