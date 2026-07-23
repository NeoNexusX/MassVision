<template>
  <div class="card bg-base-100 shadow-sm border border-base-300 p-0 rounded-none">
    <!-- Empty / Loading state (shared between table and cards) -->
    <div v-if="rows.length === 0" class="text-center py-8">
      <template v-if="loading">
        <span class="loading loading-spinner loading-md text-primary"></span>
        <span class="text-base-content/50 text-base ml-2">Loading...</span>
      </template>
      <template v-else>
        <span class="text-base-content/40 text-base">No data available</span>
      </template>
    </div>

    <template v-else>
      <!-- ===== Desktop Table (md+) ===== -->
      <div class="hidden md:block w-full overflow-x-auto">
        <table class="table w-full table-fixed min-w-[900px]">
          <colgroup>
            <col style="width: 12%" />
            <col style="width: 20%" />
            <col style="width: 22%" />
            <col style="width: 11%" />
            <col style="width: 11%" />
            <col style="width: 12%" />
            <col style="width: 6%" />
            <col style="width: 6%" />
          </colgroup>
          <thead>
            <tr class="text-sm lg:text-lg text-base-content/70">
              <th class="text-center py-3 px-2">Process</th>
              <th class="text-center py-3 px-2">Dataset</th>
              <th class="text-center py-3 px-2">Methods</th>
              <th class="text-center py-3 px-2">Created</th>
              <th class="text-center py-3 px-2">Finished</th>
              <th class="text-center py-3 px-2">Status</th>
              <th class="text-center py-3 px-1">View</th>
              <th class="text-center py-3 px-1">Delete</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in rows"
              :key="r.id"
              class="hover:bg-base-300 transition-colors text-sm lg:text-lg"
              :style="{ cursor: rowCursor }"
            >
              <td class="font-medium truncate text-center py-3 px-2" :title="r.name">{{ r.name }}</td>
              <td class="truncate text-center py-3 px-2" :title="r.dataset">{{ r.dataset }}</td>
              <td class="text-center py-3 px-2">
                <div class="flex flex-wrap justify-center gap-1">
                  <span
                    v-for="m in r.methods"
                    :key="m"
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs lg:text-sm font-medium"
                    :class="methodBadgeClass(m)"
                  >{{ m }}</span>
                </div>
              </td>
              <td class="text-center py-3 px-2">
                <div class="text-xs lg:text-sm text-base-content/60">
                  <div>{{ r.createdDate || '' }}</div>
                  <div>{{ r.createdTime || '' }}</div>
                </div>
              </td>
              <td class="text-center py-3 px-2">
                <div class="text-xs lg:text-sm text-base-content/60">
                  <div>{{ r.finishedDate || '' }}</div>
                  <div>{{ r.finishedTime || '' }}</div>
                </div>
              </td>
              <td class="text-center py-3 px-2">
                <StatusBadge :status="normalizeStatus(r)" compact class="text-xs lg:text-base" />
              </td>
              <td class="text-center py-3 px-1">
                <button
                  v-if="r.status !== 'processing'"
                  @click="openRow(r)"
                  class="btn btn-ghost btn-sm btn-circle hover:bg-base-200"
                  aria-label="View"
                >
                  <svg-icon type="chevron_right" class="w-6 h-6 text-base-content/60" />
                </button>
                <span v-else class="text-base-content/30 text-sm">—</span>
              </td>
              <td class="text-center py-3 px-1">
                <button
                  v-if="type === 'results' && (['completed', 'failed'].includes(r.status) || isStaleRunning(r))"
                  @click.stop="$emit('delete', r.id)"
                  class="btn btn-ghost btn-sm btn-circle hover:bg-error/10 hover:text-error"
                  aria-label="Delete"
                >
                  <svg-icon type="trash" class="w-5 h-5 text-base-content/50" />
                </button>
                <span v-else class="text-base-content/30 text-sm">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ===== Mobile Cards (<md) ===== -->
      <div class="md:hidden flex flex-col divide-y divide-base-200">
        <div
          v-for="r in rows"
          :key="'m-' + r.id"
          class="p-4 flex flex-col gap-2"
        >
          <!-- Top: Process name -->
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-semibold text-base truncate flex-1 min-w-0" :title="r.name">{{ r.name }}</h3>
            <StatusBadge :status="normalizeStatus(r)" compact class="flex-shrink-0" />
          </div>

          <!-- Middle: Dataset, Methods, Created, Finished -->
          <div class="flex flex-col gap-1 text-sm text-base-content/70 pl-0.5">
            <div class="flex items-center gap-2">
              <span class="text-base-content/40 w-16 flex-shrink-0">Dataset</span>
              <span class="truncate" :title="r.dataset">{{ r.dataset }}</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-base-content/40 w-16 flex-shrink-0">Methods</span>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="m in r.methods"
                  :key="m"
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs lg:text-sm font-medium"
                  :class="methodBadgeClass(m)"
                >{{ m }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-base-content/40 w-16 flex-shrink-0">Created</span>
              <span>{{ r.createdDate }} {{ r.createdTime }}</span>
            </div>
            <div v-if="r.finishedDate" class="flex items-center gap-2">
              <span class="text-base-content/40 w-16 flex-shrink-0">Finished</span>
              <span>{{ r.finishedDate }} {{ r.finishedTime }}</span>
            </div>
          </div>

          <!-- Bottom: Actions -->
          <div class="flex items-center justify-end gap-2 pt-1">
            <button
              v-if="r.status !== 'processing'"
              @click="openRow(r)"
              class="btn btn-ghost btn-sm"
              aria-label="View"
            >
              <svg-icon type="chevron_right" class="w-5 h-5" />
              <span>View</span>
            </button>
            <span v-else class="text-base-content/30 text-sm px-2">Processing</span>
            <button
              v-if="type === 'results' && (['completed', 'failed'].includes(r.status) || isStaleRunning(r))"
              @click.stop="$emit('delete', r.id)"
              class="btn btn-ghost btn-sm text-error/70 hover:text-error hover:bg-error/10"
              aria-label="Delete"
            >
              <svg-icon type="trash" class="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import StatusBadge from '@/shared/components/StatusBadge.vue'
import { parseUtcDate } from '@/shared/utils/date'

const props = defineProps<{
  title?: string
  rows: Array<any>
  type?: 'running' | 'results'
  cursor?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'delete', id: string): void
  (e: 'view-error', errorMessage: string): void
}>()

const router = useRouter()
const rows = computed(() => props.rows || [])
const type = computed(() => props.type || 'results')
const rowCursor = computed(() => props.cursor || 'pointer')

const normalizeStatus = (r: any) => {
  if (!r?.status) return ''
  return r.status.toLowerCase()
}

/** 方法名 → 柔和配色映射：浅底 + 深色文字，支持 dark mode */
const METHOD_COLOR_MAP: Record<string, string> = {
  'Noise Reduction':
    'bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300',
  'Baseline Correction':
    'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300',
  'Normalization':
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300',
  'Peak Picking':
    'bg-violet-100 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300',
  'Peak Alignment':
    'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-300',
  'Direct conversion\n(no preprocessing)':
    'bg-base-200 text-base-content/60 dark:bg-base-300 dark:text-base-content/50',
}

const methodBadgeClass = (m: string) => {
  return METHOD_COLOR_MAP[m] || 'bg-base-200 text-base-content/60'
}


const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000 // 3 hours

const isStaleRunning = (r: any) => {
  if (r.status !== 'processing') return false
  const date = parseUtcDate(r.createdAt)
  if (!date) return false
  const elapsed = Date.now() - date.getTime()
  return elapsed > STALE_THRESHOLD_MS
}

const openRow = (r: any) => {
  if (r.status === 'failed') {
    emit('view-error', r.errorMessage || 'Unknown error')
    return
  }
  router.push({
    name: 'WorkspaceResultDetail',
    state: {
      runId: r.id,
      processName: r.name,
      datasetName: r.dataset,
      filename: r.filename,
      fileId: r.fileId,
      methods: r.methods,
      status: r.status,
    },
  })
}
</script>
