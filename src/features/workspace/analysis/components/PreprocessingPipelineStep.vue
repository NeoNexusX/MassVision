<script setup lang="ts">
import IconSelect from '@/shared/components/IconSelect.vue'

defineProps<{
  availableMethods: any[]
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
  <details open class="bg-white rounded-lg border border-base-200 p-6 shadow-sm">
    <summary class="text-xl font-medium mb-4 list-none">Step 2: Preprocessing Pipeline</summary>

    <div class="space-y-4 mt-2">
      <div
        v-if="isFiltered"
        class="flex items-start gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-700"
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
            <div class="font-medium text-base">{{ group.title }}</div>
          </div>
          <div v-if="group.hint" class="text-xs text-base-content/60 mt-1">
            {{ group.hint }}
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-3">
          <div v-for="method in group.methods" :key="method.id" class="flex flex-col">
            <label
              :class="[
                'flex items-center gap-2 h-10 px-4 rounded-md text-sm transition-colors cursor-pointer select-none',
                isSelected(group.key, method.id)
                  ? 'bg-blue-50 border border-blue-200 text-blue-800'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
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
              <span v-if="isSelected(group.key, method.id)" class="text-blue-700">✔</span>
              <span class="truncate">{{ method.label }}</span>
              <span v-if="method.note" class="ml-2 text-xs text-base-content/50">{{
                method.note
              }}</span>
            </label>

            <div
              v-if="isSelected(group.key, method.id) && method.params?.length"
              class="mt-2 ml-4 grid grid-cols-2 gap-2"
            >
              <div v-for="param in method.params" :key="param.key" class="flex items-center gap-2">
                <span class="text-sm text-base-content/60 w-24 shrink-0" :title="param.hint">{{
                  param.label
                }}</span>
                <template v-if="param.type === 'select'">
                  <IconSelect
                    class="flex-1"
                    :model-value="String(getParam(group.key, method.id, param.key) ?? '')"
                    :options="param.options!.map((option: any) => option.value)"
                    :placeholder="String(param.default ?? '')"
                    hide-label
                    @update:model-value="
                      methodParams[buildParamKey(group.key, method.id, param.key)] = $event
                    "
                  />
                </template>
                <template v-else-if="param.type === 'text'">
                  <input
                    class="input input-sm input-bordered flex-1 text-sm font-mono"
                    type="text"
                    :placeholder="String(param.default ?? '')"
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
                    class="input input-sm input-bordered flex-1 text-sm font-mono"
                    type="text"
                    inputmode="numeric"
                    :placeholder="String(param.default ?? '')"
                    :value="getParam(group.key, method.id, param.key)"
                    @input="onIntInput(group.key, method.id, param.key, $event)"
                    @blur="onNumBlur(group.key, method.id, param.key, 'int')"
                  />
                </template>
                <template v-else-if="param.type === 'float'">
                  <input
                    class="input input-sm input-bordered flex-1 text-sm font-mono"
                    type="text"
                    inputmode="decimal"
                    :placeholder="String(param.default ?? '')"
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
