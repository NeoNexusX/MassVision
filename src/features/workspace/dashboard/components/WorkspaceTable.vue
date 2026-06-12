<template>
  <div class="card bg-base-100 shadow-sm border border-base-300 p-0 rounded-none">
    <div class="w-full overflow-x-auto">
      <table class="table w-full table-fixed" :class="{ 'empty-table': rows.length === 0 }">
        <colgroup>
          <col style="width: 14%" />
          <col style="width: 24%" />
          <col style="width: 24%" />
          <col style="width: 12%" />
          <col style="width: 14%" />
          <col style="width: 12%" />
        </colgroup>
        <thead>
          <tr class="text-lg text-base-content/70">
            <th class="text-center">Name</th>
            <th class="text-center">Dataset</th>
            <th class="text-center">Methods</th>
            <th class="text-center">Status</th>
            <th class="text-center">{{ type === 'running' ? 'Progress' : 'Created' }}</th>
            <th class="text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8 text-lg">
              No data available
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
              <template v-if="type === 'running'">
                <progress
                  class="progress progress-primary w-full"
                  :value="r.progress || 0"
                  max="100"
                ></progress>
                <div class="text-base text-base-content/60 mt-1">{{ r.progress || 0 }}%</div>
              </template>
              <template v-else>
                <div class="text-lg text-base-content/60">
                  {{ r.createdTime || r.created || '' }}
                </div>
              </template>
            </td>
            <td class="text-center">
              <div class="flex items-center justify-center gap-1">
                <button
                  v-if="type === 'results'"
                  @click.stop="$emit('delete', r.id)"
                  class="btn btn-ghost btn-sm btn-circle hover:bg-error/10 hover:text-error"
                  aria-label="Delete"
                >
                  <svg-icon type="trash" class="w-4 h-4 text-base-content/50" />
                </button>
                <button
                  @click="openRow(r.id)"
                  class="btn btn-ghost btn-sm btn-circle hover:bg-base-200"
                  aria-label="Open"
                >
                  <svg-icon type="chevron_right" class="w-5 h-5 text-base-content/60" />
                </button>
              </div>
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
  openRoute?: string
  cursor?: string
}>()

defineEmits<{
  (e: 'delete', id: string): void
}>()

const router = useRouter()
const rows = computed(() => props.rows || [])
const type = computed(() => props.type || 'results')
const rowCursor = computed(() => props.cursor || 'pointer')

const normalizeStatus = (r: any) => {
  if (!r?.status) return ''
  if (r.status === 'OK') return 'completed'
  return r.status.toLowerCase()
}

const openRow = (id: string) => {
  if (props.openRoute) {
    router.push({ name: props.openRoute, params: { id } })
  }
}
</script>

<style scoped>
.empty-table thead th {
  border-bottom-width: 0;
}
</style>
