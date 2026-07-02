<template>
  <div class="card bg-base-100 shadow-sm border border-base-300 p-0 rounded-none">
    <div class="w-full overflow-x-auto">
      <table class="table w-full table-fixed" :class="{ 'empty-table': rows.length === 0 }">
        <colgroup>
          <col style="width: 14%" />
          <col style="width: 22%" />
          <col style="width: 22%" />
          <col style="width: 12%" />
          <col style="width: 12%" />
          <col style="width: 9%" />
          <col style="width: 9%" />
        </colgroup>
        <thead>
          <tr class="text-lg text-base-content/70">
            <th class="text-center">Process</th>
            <th class="text-center">Dataset</th>
            <th class="text-center">Methods</th>
            <th class="text-center">Status</th>
            <th class="text-center">Created</th>
            <th class="text-center">View</th>
            <th class="text-center">Delete</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0">
            <td colspan="7" class="text-center py-8">
              <template v-if="loading">
                <span class="loading loading-spinner loading-md text-primary"></span>
                <span class="text-base-content/50 text-lg ml-2">Loading...</span>
              </template>
              <template v-else>
                <span class="text-base-content/40 text-lg">No data available</span>
              </template>
            </td>
          </tr>
          <tr
            v-for="r in rows"
            :key="r.id"
            class="hover:bg-base-300 transition-colors text-lg"
            :style="{ cursor: rowCursor }"
          >
            <td class="font-medium truncate text-center" :title="r.name">{{ r.name }}</td>
            <td class="truncate text-center" :title="r.dataset">{{ r.dataset }}</td>
            <td class="break-words whitespace-normal text-center">{{ r.methods?.join(' + ') }}</td>
            <td class="text-center">
              <StatusBadge :status="normalizeStatus(r)" compact />
            </td>
            <td class="text-center">
              <div class="text-lg text-base-content/60">
                {{ r.createdTime || r.created || '' }}
              </div>
            </td>
            <td class="text-center">
              <button
                v-if="r.status !== 'processing'"
                @click="openRow(r)"
                class="btn btn-ghost btn-sm btn-circle hover:bg-base-200"
                aria-label="View"
              >
                <svg-icon type="chevron_right" class="w-5 h-5 text-base-content/60" />
              </button>
              <span v-else class="text-base-content/30 text-sm">—</span>
            </td>
            <td class="text-center">
              <button
                v-if="type === 'results' && ['completed', 'failed'].includes(r.status)"
                @click.stop="$emit('delete', r.id)"
                class="btn btn-ghost btn-sm btn-circle hover:bg-error/10 hover:text-error"
                aria-label="Delete"
              >
                <svg-icon type="trash" class="w-4 h-4 text-base-content/50" />
              </button>
              <span v-else class="text-base-content/30 text-sm">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import StatusBadge from '@/shared/components/StatusBadge.vue'

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

<style scoped>
.empty-table thead th {
  border-bottom-width: 0;
}
</style>
