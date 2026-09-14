<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AdminUser, UserQuotaLimits } from '@/features/users/types/user'
import { getRegionName } from '@/shared/utils/regionOptions'
import { profileOptionLabel } from '@/shared/constants/profileOptions'
import { identityLabel } from '@/features/users/utils/identityLabel'
import { t } from '@/i18n'

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
    errors.value[key] = t('users.drawer.mustBeNumber')
  } else if (!isFinite(value)) {
    errors.value[key] = t('users.drawer.mustBeNumber')
  } else if (integerOnly && !Number.isInteger(value)) {
    errors.value[key] = t('users.drawer.mustBeInteger')
  } else if (value < 1) {
    errors.value[key] = t('users.drawer.mustBeNumber')
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
        <h2 class="kawaru-text-125 font-semibold">{{ $t('users.drawer.title') }}</h2>
        <button
          class="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:bg-base-200 kawaru-text-75"
          :aria-label="$t('common.action.close')"
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
              <span class="kawaru-text-150 font-bold uppercase">{{
                selectedUser.username.substring(0, 1)
              }}</span>
            </div>
          </div>
          <div class="min-w-0">
            <h3 class="kawaru-text-125 font-semibold truncate">{{ selectedUser.username }}</h3>
            <div class="flex gap-2 items-center mt-1.5">
              <span
                class="badge font-medium border-0 kawaru-text-87"
                :class="
                  selectedUser.active
                    ? 'badge-success badge-soft bg-success/10 text-success'
                    : 'badge-neutral badge-soft bg-base-200/80 text-base-content/60'
                "
              >
                {{ selectedUser.active ? $t('common.status.active') : $t('common.status.inactive') }}
              </span>
              <span
                class="badge uppercase kawaru-text-75 font-medium border-0"
                :class="
                  selectedUser.identity === 'admin'
                    ? 'bg-info/15 text-info'
                    : 'bg-success/15 text-success'
                "
              >
                {{ identityLabel(selectedUser.identity) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Detail Fields -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <span class="kawaru-text-87 font-medium text-base-content/50">{{ $t('users.field.id') }}</span>
            <p class="kawaru-text-100 mt-0.5">{{ selectedUser.id }}</p>
          </div>
          <div>
            <span class="kawaru-text-87 font-medium text-base-content/50">{{ $t('common.field.email') }}</span>
            <p class="kawaru-text-100 mt-0.5 truncate">{{ selectedUser.email || '—' }}</p>
          </div>
          <div>
            <span class="kawaru-text-87 font-medium text-base-content/50">{{ $t('users.field.institution') }}</span>
            <p class="kawaru-text-100 mt-0.5">{{ selectedUser.institution || '—' }}</p>
          </div>
          <div>
            <span class="kawaru-text-87 font-medium text-base-content/50">{{ $t('common.field.region') }}</span>
            <p class="kawaru-text-100 mt-0.5">{{ getRegionName(selectedUser.region) || '—' }}</p>
          </div>
          <div>
            <span class="kawaru-text-87 font-medium text-base-content/50">{{ $t('common.field.position') }}</span>
            <p class="kawaru-text-100 mt-0.5">{{ profileOptionLabel(selectedUser.position) || '—' }}</p>
          </div>
          <div>
            <span class="kawaru-text-87 font-medium text-base-content/50">{{ $t('common.field.researchField') }}</span>
            <p class="kawaru-text-100 mt-0.5">{{ profileOptionLabel(selectedUser.research_field) || '—' }}</p>
          </div>
          <div>
            <span class="kawaru-text-87 font-medium text-base-content/50">{{ $t('users.field.orcid') }}</span>
            <p class="kawaru-text-100 mt-0.5">{{ selectedUser.orcid || '—' }}</p>
          </div>
          <div>
            <span class="kawaru-text-87 font-medium text-base-content/50">{{ $t('users.field.homepage') }}</span>
            <p class="kawaru-text-100 mt-0.5 truncate">
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
          <h3 class="kawaru-text-100 font-semibold mb-3">{{ $t('users.drawer.currentUsage') }}</h3>
          <div class="grid grid-cols-2 gap-x-6 gap-y-3">
            <div class="bg-base-200/40 rounded-lg p-3 text-center">
              <div class="kawaru-text-87 text-base-content/50">{{ $t('common.stat.files') }}</div>
              <div class="kawaru-text-125 font-semibold mt-1">{{ selectedUser.file_count ?? 0 }}</div>
            </div>
            <div class="bg-base-200/40 rounded-lg p-3 text-center">
              <div class="kawaru-text-87 text-base-content/50">{{ $t('users.drawer.storageUsed') }}</div>
              <div class="kawaru-text-125 font-semibold mt-1">{{ formatFileSize(selectedUser.total_file_size ?? 0) }}</div>
            </div>
          </div>
        </div>

        <!-- Quota Limits -->
        <div>
          <h3 class="kawaru-text-100 font-semibold mb-3">{{ $t('users.drawer.quotaLimits') }}</h3>
          <div class="grid grid-cols-2 gap-x-6 gap-y-3">
            <label class="form-control">
              <span class="kawaru-text-87 font-medium text-base-content/50 mb-1">{{ $t('users.drawer.maxFileCount') }}</span>
              <input
                v-model.number="quotaLimits.max_file_count"
                type="number"
                min="1"
                step="1"
                class="input input-bordered kawaru-text-87 h-8"
                :class="{ 'input-error': errors['max_file_count'] }"
                placeholder="≥ 1"
                @input="validateQuotaField('max_file_count', quotaLimits.max_file_count, true)"
                @blur="validateQuotaField('max_file_count', quotaLimits.max_file_count, true)"
              />
              <span v-if="errors['max_file_count']" class="kawaru-text-75 text-error mt-0.5">{{ errors['max_file_count'] }}</span>
            </label>
            <label class="form-control">
              <span class="kawaru-text-87 font-medium text-base-content/50 mb-1">{{ $t('users.drawer.maxStorage') }}</span>
              <input
                v-model.number="quotaLimits.max_total_file_size"
                type="number"
                min="1"
                class="input input-bordered kawaru-text-87 h-8"
                :class="{ 'input-error': errors['max_total_file_size'] }"
                placeholder="≥ 1"
                @input="validateQuotaField('max_total_file_size', quotaLimits.max_total_file_size)"
                @blur="validateQuotaField('max_total_file_size', quotaLimits.max_total_file_size)"
              />
              <span v-if="errors['max_total_file_size']" class="kawaru-text-75 text-error mt-0.5">{{ errors['max_total_file_size'] }}</span>
            </label>
            <label class="form-control">
              <span class="kawaru-text-87 font-medium text-base-content/50 mb-1">{{ $t('users.drawer.maxProcessing') }}</span>
              <input
                v-model.number="quotaLimits.max_processing_size"
                type="number"
                min="1"
                class="input input-bordered kawaru-text-87 h-8"
                :class="{ 'input-error': errors['max_processing_size'] }"
                placeholder="≥ 1"
                @input="validateQuotaField('max_processing_size', quotaLimits.max_processing_size)"
                @blur="validateQuotaField('max_processing_size', quotaLimits.max_processing_size)"
              />
              <span v-if="errors['max_processing_size']" class="kawaru-text-75 text-error mt-0.5">{{ errors['max_processing_size'] }}</span>
            </label>
            <label class="form-control">
              <span class="kawaru-text-87 font-medium text-base-content/50 mb-1">{{ $t('users.drawer.maxDownloads') }}</span>
              <input
                v-model.number="quotaLimits.max_download_count"
                type="number"
                min="1"
                step="1"
                class="input input-bordered kawaru-text-87 h-8"
                :class="{ 'input-error': errors['max_download_count'] }"
                placeholder="≥ 1"
                @input="validateQuotaField('max_download_count', quotaLimits.max_download_count, true)"
                @blur="validateQuotaField('max_download_count', quotaLimits.max_download_count, true)"
              />
              <span v-if="errors['max_download_count']" class="kawaru-text-75 text-error mt-0.5">{{ errors['max_download_count'] }}</span>
            </label>
          </div>
          <button
            class="btn btn-primary w-full mt-3 rounded-lg font-medium kawaru-text-87"
            :disabled="quotaLoading || hasErrors"
            @click="$emit('save-quota')"
          >
            <span v-if="quotaLoading" class="loading loading-spinner loading-sm"></span>
            {{ $t('users.drawer.saveQuota') }}
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div
        v-if="selectedUser.username !== currentUsername && selectedUser.identity !== 'admin'"
        class="px-6 py-4 border-t border-base-200 bg-base-200/40 rounded-b-2xl flex"
      >
        <button
          class="btn flex-1 rounded-xl shadow-sm text-white border-none font-medium bg-error hover:bg-error/80 kawaru-text-87"
          @click="$emit('delete')"
        >
          {{ $t('common.action.delete') }}
        </button>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button @click="$emit('close')">{{ $t('common.action.close') }}</button>
    </form>
  </dialog>
</template>
