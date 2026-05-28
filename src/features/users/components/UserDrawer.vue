<script setup lang="ts">
import type { AdminUser } from '@/features/users/api/userAdminApi'
import { getRegionName } from '@/shared/utils/regionOptions'

defineProps<{
  selectedUser: AdminUser | null
  currentUsername?: string
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'delete'): void
}>()
</script>

<template>
  <div class="drawer-side z-50">
    <div aria-label="close sidebar" class="drawer-overlay" @click="$emit('close')"></div>
    <div
      class="menu w-[400px] max-w-[100vw] min-h-full bg-base-100 p-0 flex flex-col text-base-content shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-base-200"
    >
      <div class="px-6 py-5 border-b border-base-200 flex items-center justify-between bg-base-100">
        <h2 class="text-lg font-bold">User Details</h2>
        <button
          class="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:bg-base-200"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>

      <div class="p-6 flex-1 overflow-y-auto" v-if="selectedUser">
        <div
          class="flex items-center gap-5 mb-8 p-4 bg-base-200/40 rounded-2xl border border-base-200/60"
        >
          <div class="avatar placeholder">
            <div
              class="bg-base-100 shadow-sm border border-base-200 text-base-content rounded-full w-14 h-14 flex items-center justify-center"
            >
              <span class="text-xl font-bold uppercase">{{
                selectedUser.username.substring(0, 1)
              }}</span>
            </div>
          </div>
          <div>
            <h3 class="text-lg font-bold mb-1">{{ selectedUser.username }}</h3>
            <div class="flex gap-2 items-center">
              <span
                class="badge badge-sm font-medium border-0"
                :class="
                  selectedUser.active
                    ? 'badge-success badge-soft bg-success/10 text-success'
                    : 'badge-neutral badge-soft bg-base-200/80 text-base-content/60'
                "
              >
                {{ selectedUser.active ? 'Active' : 'Inactive' }}
              </span>
              <span
                class="badge badge-sm badge-neutral badge-outline opacity-60 uppercase text-[10px]"
              >
                {{ selectedUser.identity }}
              </span>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="flex flex-wrap gap-4">
            <div class="w-full sm:w-1/2">
              <span class="text-xs font-semibold text-base-content/40 tracking-wider"
                >Institution</span
              >
              <p class="text-sm font-medium mt-1">{{ selectedUser.institution || '—' }}</p>
            </div>
            <div class="w-full sm:w-1/2">
              <span class="text-xs font-semibold text-base-content/40 tracking-wider">Region</span>
              <p class="text-sm font-medium mt-1">{{ getRegionName(selectedUser.region) || '—' }}</p>
            </div>
          </div>
          <hr class="border-base-200/60" />
          <div class="flex flex-wrap gap-4">
            <div class="w-full sm:w-1/2">
              <span class="text-xs font-semibold text-base-content/40 tracking-wider"
                >Position</span
              >
              <p class="text-sm font-medium mt-1">{{ selectedUser.position || '—' }}</p>
            </div>
            <div class="w-full sm:w-1/2">
              <span class="text-xs font-semibold text-base-content/40 tracking-wider">Field</span>
              <p class="text-sm font-medium mt-1">{{ selectedUser.research_field || '—' }}</p>
            </div>
          </div>
          <hr class="border-base-200/60" />
          <div class="space-y-4">
            <div>
              <span class="text-xs font-semibold text-base-content/40 tracking-wider">Email</span>
              <p class="text-sm font-medium mt-1">{{ selectedUser.email || '—' }}</p>
            </div>
            <div>
              <span class="text-xs font-semibold text-base-content/40 tracking-wider">ORCID</span>
              <p class="text-sm font-medium mt-1">{{ selectedUser.orcid || '—' }}</p>
            </div>
            <div>
              <span class="text-xs font-semibold text-base-content/40 tracking-wider"
                >Homepage</span
              >
              <p class="text-sm font-medium mt-1 truncate">
                <a
                  v-if="selectedUser.homepage"
                  :href="selectedUser.homepage"
                  target="_blank"
                  class="hover:underline"
                >
                  {{ selectedUser.homepage }}
                </a>
                <template v-else>—</template>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="selectedUser" class="px-6 py-5 border-t border-base-200 bg-base-100 flex gap-3">
        <button
          class="btn border-base-200 bg-base-100 hover:bg-base-200 hover:border-base-300 text-base-content flex-1 rounded-xl shadow-sm font-medium"
        >
          Edit
        </button>
        <button
          v-if="selectedUser?.username !== currentUsername"
          class="btn flex-1 rounded-xl shadow-sm text-white border-none font-medium bg-error hover:bg-error/80"
          @click="$emit('delete')"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>
