<template>
  <div class="card bg-base-100 shadow-sm border border-base-200 p-0">
    <div class="w-full overflow-x-auto">
      <table class="table w-full table-fixed">
        <colgroup>
          <col style="width: 19%" />
          <col style="width: 13%" />
          <col style="width: 31%" />
          <col style="width: 15%" />
          <col style="width: 17%" />
          <col style="width: 5%" />
        </colgroup>
        <thead>
          <tr class="text-sm text-base-content/70">
            <th class="pl-6 text-left">Name</th>
            <th class="text-left">Dataset</th>
            <th class="text-left">Methods</th>
            <th class="text-left">Status</th>
            <th class="text-left">{{ type === 'running' ? 'Progress' : 'Created' }}</th>
            <th class="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.id"
            class="hover:bg-base-200 transition-colors"
            :style="{ cursor: rowCursor }"
          >
            <td class="font-medium pl-6 min-w-0">{{ r.name }}</td>
            <td class="min-w-0">{{ r.dataset }}</td>
            <td class="break-words whitespace-normal">{{ r.methods?.join(' + ') }}</td>
            <td class="min-w-0">
              <StatusBadge :status="normalizeStatus(r)" />
            </td>
            <td>
              <template v-if="type === 'running'">
                <progress
                  class="progress progress-primary w-full"
                  :value="r.progress || 0"
                  max="100"
                ></progress>
                <div class="text-xs text-base-content/60 mt-1">{{ r.progress || 0 }}%</div>
              </template>
              <template v-else>
                <div class="text-sm text-base-content/60">
                  {{ r.createdTime || r.created || '' }}
                </div>
              </template>
            </td>
            <td class="text-right pr-2">
              <button
                @click="openRow(r.id)"
                class="btn btn-ghost btn-sm btn-circle hover:bg-base-200"
                aria-label="Open"
              >
                <svg-icon type="chevron_right" class="w-5 h-5 text-base-content/60" />
              </button>
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
