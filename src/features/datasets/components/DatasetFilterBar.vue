<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import DatasetFilterPanel from '@/features/datasets/components/DatasetFilterPanel.vue'
import { useClickOutside } from '@/shared/composables/useClickOutside'

interface SortOption {
  label: string
  value: string
}

withDefaults(
  defineProps<{
    showUpload?: boolean
    showVisibilityFilter?: boolean
    showAddFilter?: boolean
    searchPlaceholder?: string
  }>(),
  {
    showUpload: false,
    showVisibilityFilter: false,
    showAddFilter: false,
    searchPlaceholder: 'Search by name/sample/institution',
  },
)

const emit = defineEmits<{
  (e: 'search', query: string): void
  (e: 'filter-status', status: string[]): void
  (e: 'filter-visibility', visibility: string): void
  (e: 'apply-filters', payload: Record<string, any>): void
  (e: 'sort', value: string): void
  (e: 'upload'): void
}>()

const searchQuery = ref('')
const selectedStatuses = ref<string[]>([])
const selectedVisibility = ref('My Submissions')
const sortValue = ref('submission_time')

const visibilityOptions = ['My Submissions', 'Shared with Me', 'Publicly Shared']
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
watch(selectedVisibility, (value) => emit('filter-visibility', value))
watch(sortValue, (value) => emit('sort', value))
</script>

<template>
  <div
    class="flex flex-col gap-4 bg-base-100 dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-base-300 mb-6"
  >
    <div class="flex flex-col md:flex-row gap-4 justify-between items-center">
      <div class="flex items-center gap-2 w-full md:w-auto min-w-0">
        <div v-if="showVisibilityFilter" class="relative group shrink-0">
          <select
            v-model="selectedVisibility"
            class="appearance-none bg-base-200 border border-base-300 text-base-content py-2 pl-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer text-lg font-medium"
          >
            <option v-for="opt in visibilityOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <div
            class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-base-content/60"
          >
            <SvgIcon type="chevron_down" class="fill-current h-4 w-4" />
          </div>
        </div>

        <div class="relative md:w-80 flex items-center gap-2 min-w-0">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SvgIcon type="search" class="h-4 w-4 text-slate-400" />
          </div>
          <input
            v-model="searchQuery"
            @keydown.enter.prevent="onSearchClick"
            type="text"
            class="w-full min-w-0 bg-base-200 border border-base-300 text-base-content text-lg rounded-lg focus:ring-primary focus:border-primary pl-10 p-2 placeholder:text-base-content/40"
            :placeholder="searchPlaceholder"
          />
          <button @click="onSearchClick" class="btn btn-sm btn-primary shrink-0">Search</button>
        </div>

        <div v-if="showAddFilter" class="relative group">
          <button
            ref="filterBtn"
            @click="toggleFilterPanel"
            class="flex items-center gap-2 bg-base-100 dark:bg-slate-800 border border-base-300 text-base-content py-2 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-lg font-medium"
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

      <div
        class="flex flex-row flex-nowrap items-center gap-2 w-full md:w-auto shrink-0 overflow-hidden"
      >
        <button
          v-if="showUpload"
          @click="$emit('upload')"
          class="flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 border-none rounded-lg shadow-sm transition-all transform active:scale-95 text-lg font-medium py-2 px-4 min-w-0 overflow-hidden"
        >
          <SvgIcon type="upload" class="w-4 h-4 shrink-0" />
          <span class="truncate">Upload New Dataset</span>
        </button>

        <div class="relative w-full sm:w-auto">
          <select
            v-model="sortValue"
            class="appearance-none w-full bg-base-100 dark:bg-slate-800 border border-base-300 text-base-content py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer text-lg truncate"
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
