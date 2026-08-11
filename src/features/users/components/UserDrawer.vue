<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AdminUser, UserQuotaLimits } from '@/features/users/types/user'
import { getRegionName } from '@/shared/utils/regionOptions'

defineProps<{
  selectedUser: AdminUser | null
  currentUsername?: string
  quotaLimits: UserQuotaLimits
  quotaLoading: boolean
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'delete'): void
  (e: 'save-quota'): void
}>()

const formatFileSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

// Quota validation
const errors = ref<Record<string, string>>({})

function validateQuotaField(key: string, value: number | null, integerOnly = false) {
  if (value === null || value === undefined) {
    errors.value[key] = 'Must be a number ≥ 1'
  } else if (!isFinite(value)) {
    errors.value[key] = 'Must be a number ≥ 1'
  } else if (integerOnly && !Number.isInteger(value)) {
    errors.value[key] = 'Must be an integer ≥ 1'
  } else if (value < 1) {
    errors.value[key] = 'Must be a number ≥ 1'
  } else {
    delete errors.value[key]
  }
}

const hasErrors = computed(() => Object.keys(errors.value).length > 0)
</script>

<template>
  <dialog v-if="selectedUser" class="modal modal-open">
    <div class="modal-box max-w-xl p-0 bg-base-100 text-base-content">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-base-200 flex items-center justify-between">
        <h2 class="text-xl font-semibold">User Details</h2>
        <button
          class="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:bg-base-200"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-4 space-y-4">
        <!-- User Info Card -->
        <div class="flex items-center gap-4 p-4 bg-base-200/40 rounded-xl border border-base-200/60">
          <div class="avatar placeholder shrink-0">
            <div
              class="bg-base-100 shadow-sm border border-base-200 text-base-content rounded-full w-16 h-16 flex items-center justify-center"
            >
              <span class="text-2xl font-bold uppercase">{{
                selectedUser.username.substring(0, 1)
              }}</span>
            </div>
          </div>
          <div class="min-w-0">
            <h3 class="text-xl font-semibold truncate">{{ selectedUser.username }}</h3>
            <div class="flex gap-2 items-center mt-1.5">
              <span
                class="badge font-medium border-0"
                :class="
                  selectedUser.active
                    ? 'badge-success badge-soft bg-success/10 text-success'
                    : 'badge-neutral badge-soft bg-base-200/80 text-base-content/60'
                "
              >
                {{ selectedUser.active ? 'Active' : 'Inactive' }}
              </span>
              <span
                class="badge uppercase text-xs font-medium border-0"
                :class="
                  selectedUser.identity === 'admin'
                    ? 'bg-info/15 text-info'
                    : 'bg-success/15 text-success'
                "
              >
                {{ selectedUser.identity }}
              </span>
            </div>
          </div>
        </div>

        <!-- Detail Fields -->
        <div class="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <span class="text-sm font-medium text-base-content/50">ID</span>
            <p class="text-base mt-0.5">{{ selectedUser.id }}</p>
          </div>
          <div>
            <span class="text-sm font-medium text-base-content/50">Email</span>
            <p class="text-base mt-0.5 truncate">{{ selectedUser.email || '—' }}</p>
          </div>
          <div>
            <span class="text-sm font-medium text-base-content/50">Institution</span>
            <p class="text-base mt-0.5">{{ selectedUser.institution || '—' }}</p>
          </div>
          <div>
            <span class="text-sm font-medium text-base-content/50">Region</span>
            <p class="text-base mt-0.5">{{ getRegionName(selectedUser.region) || '—' }}</p>
          </div>
          <div>
            <span class="text-sm font-medium text-base-content/50">Position</span>
            <p class="text-base mt-0.5">{{ selectedUser.position || '—' }}</p>
          </div>
          <div>
            <span class="text-sm font-medium text-base-content/50">Research Field</span>
            <p class="text-base mt-0.5">{{ selectedUser.research_field || '—' }}</p>
          </div>
          <div>
            <span class="text-sm font-medium text-base-content/50">ORCID</span>
            <p class="text-base mt-0.5">{{ selectedUser.orcid || '—' }}</p>
          </div>
          <div>
            <span class="text-sm font-medium text-base-content/50">Homepage</span>
            <p class="text-base mt-0.5 truncate">
              <a
                v-if="selectedUser.homepage"
                :href="selectedUser.homepage"
                target="_blank"
                class="link link-primary"
              >
                {{ selectedUser.homepage }}
              </a>
              <template v-else>—</template>
            </p>
          </div>
        </div>

        <hr class="border-base-200/60" />

        <!-- Current Usage -->
        <div>
          <h3 class="text-base font-semibold mb-3">Current Usage</h3>
          <div class="grid grid-cols-2 gap-x-6 gap-y-3">
            <div class="bg-base-200/40 rounded-lg p-3 text-center">
              <div class="text-sm text-base-content/50">Files</div>
              <div class="text-xl font-semibold mt-1">{{ selectedUser.file_count ?? 0 }}</div>
            </div>
            <div class="bg-base-200/40 rounded-lg p-3 text-center">
              <div class="text-sm text-base-content/50">Storage Used</div>
              <div class="text-xl font-semibold mt-1">{{ formatFileSize(selectedUser.total_file_size ?? 0) }}</div>
            </div>
          </div>
        </div>

        <!-- Quota Limits -->
        <div>
          <h3 class="text-base font-semibold mb-3">Quota Limits</h3>
          <div class="grid grid-cols-2 gap-x-6 gap-y-3">
            <label class="form-control">
              <span class="text-sm font-medium text-base-content/50 mb-1">Max File Count</span>
              <input
                v-model.number="quotaLimits.max_file_count"
                type="number"
                min="1"
                step="1"
                class="input input-bordered text-sm h-8"
                :class="{ 'input-error': errors['max_file_count'] }"
                placeholder="≥ 1"
                @input="validateQuotaField('max_file_count', quotaLimits.max_file_count, true)"
                @blur="validateQuotaField('max_file_count', quotaLimits.max_file_count, true)"
              />
              <span v-if="errors['max_file_count']" class="text-xs text-error mt-0.5">{{ errors['max_file_count'] }}</span>
            </label>
            <label class="form-control">
              <span class="text-sm font-medium text-base-content/50 mb-1">Max Storage (GB)</span>
              <input
                v-model.number="quotaLimits.max_total_file_size"
                type="number"
                min="1"
                class="input input-bordered text-sm h-8"
                :class="{ 'input-error': errors['max_total_file_size'] }"
                placeholder="≥ 1"
                @input="validateQuotaField('max_total_file_size', quotaLimits.max_total_file_size)"
                @blur="validateQuotaField('max_total_file_size', quotaLimits.max_total_file_size)"
              />
              <span v-if="errors['max_total_file_size']" class="text-xs text-error mt-0.5">{{ errors['max_total_file_size'] }}</span>
            </label>
            <label class="form-control">
              <span class="text-sm font-medium text-base-content/50 mb-1">Max Processing (GB)</span>
              <input
                v-model.number="quotaLimits.max_processing_size"
                type="number"
                min="1"
                class="input input-bordered text-sm h-8"
                :class="{ 'input-error': errors['max_processing_size'] }"
                placeholder="≥ 1"
                @input="validateQuotaField('max_processing_size', quotaLimits.max_processing_size)"
                @blur="validateQuotaField('max_processing_size', quotaLimits.max_processing_size)"
              />
              <span v-if="errors['max_processing_size']" class="text-xs text-error mt-0.5">{{ errors['max_processing_size'] }}</span>
            </label>
            <label class="form-control">
              <span class="text-sm font-medium text-base-content/50 mb-1">Max Downloads</span>
              <input
                v-model.number="quotaLimits.max_download_count"
                type="number"
                min="1"
                step="1"
                class="input input-bordered text-sm h-8"
                :class="{ 'input-error': errors['max_download_count'] }"
                placeholder="≥ 1"
                @input="validateQuotaField('max_download_count', quotaLimits.max_download_count, true)"
                @blur="validateQuotaField('max_download_count', quotaLimits.max_download_count, true)"
              />
              <span v-if="errors['max_download_count']" class="text-xs text-error mt-0.5">{{ errors['max_download_count'] }}</span>
            </label>
          </div>
          <button
            class="btn btn-primary w-full mt-3 rounded-lg font-medium"
            :disabled="quotaLoading || hasErrors"
            @click="$emit('save-quota')"
          >
            <span v-if="quotaLoading" class="loading loading-spinner loading-sm"></span>
            Save Quota
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div
        v-if="selectedUser.username !== currentUsername && selectedUser.identity !== 'admin'"
        class="px-6 py-4 border-t border-base-200 bg-base-200/40 rounded-b-2xl flex"
      >
        <button
          class="btn flex-1 rounded-xl shadow-sm text-white border-none font-medium bg-error hover:bg-error/80"
          @click="$emit('delete')"
        >
          Delete
        </button>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button @click="$emit('close')">close</button>
    </form>
  </dialog>
</template>
