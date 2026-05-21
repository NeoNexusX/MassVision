<template>
  <div
    class="flex-1 w-full flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8 bg-base-200"
  >
    <!-- Navbar Removed (Using global Navbar) -->

    <!-- Main Content -->
    <div class="w-full max-w-7xl">
      <div class="card bg-base-100 border border-base-200 shadow-sm overflow-visible flex flex-col">
        <!-- Header / Banner -->
        <div
          class="h-32 shrink-0 bg-gradient-to-r from-primary/20 to-secondary/20 flex items-center px-8"
        >
          <h1
            class="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent w-fit"
          >
            Profile
          </h1>
        </div>

        <div class="card-body p-8 space-y-6">
          <!-- User Avatar & Basic Info -->
          <div class="flex flex-col gap-6 mb-6">
            <div class="flex flex-col sm:flex-row gap-6 items-center">
              <div class="avatar placeholder ring ring-base-100 ring-offset-2 rounded-full">
                <div
                  class="bg-primary text-primary-content rounded-full w-24 h-24 flex items-center justify-center text-3xl"
                >
                  <span>{{ (formData.username || 'U').charAt(0).toUpperCase() }}</span>
                </div>
              </div>

              <div class="flex-1 w-full">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- Username (Read Only) -->
                  <BaseInput label="Username" :model-value="formData.username" readonly />

                  <!-- Identity (Read Only) -->
                  <BaseInput label="Identity" :model-value="formData.identity" readonly />

                  <!-- Email (read-only, changed via modal) -->
                  <div class="w-full">
                    <label class="label mb-0">
                      <span class="label-text font-semibold">Email</span>
                    </label>
                    <div class="flex items-center gap-3">
                      <div class="flex-1">
                        <BaseInput hideLabel label="Email" :model-value="formData.email" readonly />
                      </div>
                      <div class="flex-shrink-0">
                        <button class="btn btn-sm w-28" type="button" @click="openEmailModal">
                          Change Email
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Password (Editable) -->
                  <BaseInput
                    label="New Password"
                    v-model="formData.password"
                    type="password"
                    placeholder="Leave blank to keep current"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="divider">Quota Usage</div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-base-200 rounded-lg p-4">
              <div class="text-xs text-base-content/60 mb-1">Storage Upload</div>
              <div class="text-lg font-semibold">
                {{ quota.uploadUsed }} / {{ quota.uploadMax }}
              </div>
              <progress
                class="progress progress-primary w-full mt-2"
                :value="quota.uploadPercent"
                max="100"
              ></progress>
            </div>
            <div class="bg-base-200 rounded-lg p-4">
              <div class="text-xs text-base-content/60 mb-1">Files</div>
              <div class="text-lg font-semibold">{{ quota.fileCount }} / {{ quota.maxFiles }}</div>
              <progress
                class="progress progress-secondary w-full mt-2"
                :value="quota.filePercent"
                max="100"
              ></progress>
            </div>
            <div class="bg-base-200 rounded-lg p-4">
              <div class="text-xs text-base-content/60 mb-1">Processing</div>
              <div class="text-lg font-semibold">{{ quota.procUsed }} / {{ quota.procMax }}</div>
              <progress
                class="progress progress-accent w-full mt-2"
                :value="quota.procPercent"
                max="100"
              ></progress>
            </div>
          </div>

          <div class="divider">Academic Profile</div>

          <!-- Edit Form -->
          <form @submit.prevent="handleSave" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Institution -->
              <BaseInput
                label="Institution"
                v-model="formData.institution"
                placeholder="University Name"
              />

              <!-- Position -->
              <div>
                <label class="label mb-0"
                  ><span class="label-text font-semibold">Position</span></label
                >
                <div class="bold-select">
                  <IconSelect
                    v-model="formData.position"
                    :options="positionOptions"
                    placeholder="Select Position"
                  />
                </div>
              </div>

              <!-- Research Field -->
              <BaseInput
                label="Research Field"
                v-model="formData.research_field"
                placeholder="e.g. Computer Vision"
              />

              <!-- Region -->
              <div>
                <label class="label mb-0"
                  ><span class="label-text font-semibold">Region</span></label
                >
                <div class="bold-select">
                  <IconSelect
                    v-model="regionLabel"
                    :options="regionNames"
                    placeholder="Select Region"
                  />
                </div>
              </div>

              <!-- ORCID -->
              <BaseInput label="ORCID" v-model="formData.orcid" placeholder="0000-0000-0000-0000" />

              <!-- Homepage -->
              <BaseInput
                label="Homepage"
                v-model="formData.homepage"
                placeholder="https://example.com"
              />
            </div>

            <div class="flex justify-end pt-4 border-t border-base-200 mt-6">
              <button class="btn btn-primary" type="submit" :disabled="loading">
                <span v-if="loading" class="loading loading-spinner"></span>
                Save All Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <EmailChangeModal
      v-model:new-email="newEmail"
      v-model:email-code="emailCode"
      :is-open="isEmailModalOpen"
      :sending-code="sendingCode"
      :code-cooldown="codeCooldown"
      :loading="loading"
      @send-code="sendVerificationCode"
      @confirm="submitEmailChange"
      @close="closeEmailModal"
    />
  </div>
</template>

<script setup lang="ts">
import BaseInput from '@/shared/components/BaseInput.vue'
import IconSelect from '@/shared/components/IconSelect.vue'
import EmailChangeModal from '@/features/users/components/EmailChangeModal.vue'
import { useUserProfileForm } from '@/features/users/composables/useUserProfileForm'

const {
  loading,
  positionOptions,
  regionNames,
  regionLabel,
  formData,
  isEmailModalOpen,
  newEmail,
  emailCode,
  sendingCode,
  codeCooldown,
  quota,
  openEmailModal,
  closeEmailModal,
  sendVerificationCode,
  submitEmailChange,
  handleSave,
} = useUserProfileForm()
</script>

<style scoped>
.bold-select :deep(.truncate) {
  font-weight: 600 !important;
}
</style>
