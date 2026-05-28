<template>
  <div
    class="flex flex-col gap-4 bg-base-100 dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-base-300 mb-6"
  >
    <div class="flex flex-col md:flex-row gap-4 justify-between items-center">
      <div class="flex items-center gap-2 w-full md:w-auto ">
        <div class="flex flex-1 items-center gap-2">
          <IconInput
            v-model="searchQuery"
            icon-type="search"
            :placeholder="searchPlaceholder"
            @keydown.enter.prevent="onSearchClick"
          />
          <button @click="onSearchClick" class="btn btn-primary shrink-0 text-lg">Search</button>
        </div>

        <div v-if="showAddFilter" class="flex relative group truncate">
          <button
            ref="filterBtn"
            @click="toggleFilterPanel"
            class="items-center gap-2 bg-base-100 dark:bg-slate-800 border border-base-300 text-base-content py-2 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-lg font-medium"
          >
            <SvgIcon type="plus" class="w-4 h-4" />
            Add filter
          </button>
          <teleport to="body">
            <div
              v-if="showFilterPanel"
              ref="filterPanelRef"
              :style="panelStyle"
              class="bg-base-100 dark:bg-slate-800 border border-base-300 rounded-lg p-5 shadow-2xl"
            >
              <DatasetFilterPanel
                @apply="(payload) => emit('apply-filters', payload)"
                @close="closeFilterPanel"
              />
            </div>
          </teleport>
        </div>
      </div>

      <div class="flex flex-row items-center gap-2 w-full md:w-auto min-w-0 overflow-hidden">
        <button
          v-if="showUpload"
          @click="$emit('upload')"
          class="flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 border-none rounded-lg shadow-sm transition-all transform active:scale-95 text-lg font-medium py-2 px-4 min-w-0 overflow-hidden"
        >
          <SvgIcon type="upload" class="w-4 h-4 shrink-0" />
          <span class="truncate">Upload New Dataset</span>
        </button>

        <div class="relative flex-1 w-full min-w-0">
          <select
            v-model="sortValue"
            class="appearance-none w-full bg-base-100 dark:bg-slate-800 border border-base-300 text-base-content py-2 pl-3 pr-8 rounded-lg cursor-pointer text-lg"
          >
            <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <div
            class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-base-content/60"
          >
            <SvgIcon type="chevron_down" class="fill-current h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import DatasetFilterPanel from '@/features/datasets/components/DatasetFilterPanel.vue'
import IconInput from '@/shared/components/IconInput.vue'
import { useClickOutside } from '@/shared/composables/useClickOutside'

interface SortOption {
  label: string
  value: string
}

withDefaults(
  defineProps<{
    showUpload?: boolean
    showAddFilter?: boolean
    searchPlaceholder?: string
  }>(),
  {
    showUpload: false,
    showAddFilter: false,
    searchPlaceholder: 'Search by name/sample/institution',
  },
)

const emit = defineEmits<{
  (e: 'search', query: string): void
  (e: 'filter-status', status: string[]): void
  (e: 'apply-filters', payload: Record<string, any>): void
  (e: 'sort', value: string): void
  (e: 'upload'): void
}>()

const searchQuery = ref('')
const selectedStatuses = ref<string[]>([])
const sortValue = ref('submission_time')

const sortOptions: SortOption[] = [
  { label: 'Sort by submission time', value: 'submission_time' },
  { label: 'Sort by file size', value: 'size_bytes' },
]

const showFilterPanel = ref(false)
const filterBtn = ref<HTMLElement | null>(null)
const filterPanelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const computePanelPosition = () => {
  const btn = filterBtn.value
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  const panelWidth = Math.min(650, window.innerWidth - 32)
  const left = Math.min(Math.max(16, rect.left), window.innerWidth - panelWidth - 16)
  const top = rect.bottom + window.scrollY + 8
  panelStyle.value = {
    position: 'absolute',
    top: `${top}px`,
    left: `${left + window.scrollX}px`,
    width: `${panelWidth}px`,
    zIndex: '9999',
  }
}

const toggleFilterPanel = () => {
  showFilterPanel.value = !showFilterPanel.value
  if (showFilterPanel.value) {
    setTimeout(() => computePanelPosition(), 0)
  }
}

const closeFilterPanel = () => {
  showFilterPanel.value = false
}

const onSearchClick = () => emit('search', searchQuery.value)

useClickOutside(filterPanelRef, closeFilterPanel, [filterBtn])

onMounted(() => {
  window.addEventListener('resize', computePanelPosition)
})

onUnmounted(() => {
  window.removeEventListener('resize', computePanelPosition)
})

watch(selectedStatuses, (value) => emit('filter-status', value))
watch(sortValue, (value) => emit('sort', value))
</script>