<template>
  <div
    class="flex-1 w-full flex flex-col justify-center items-center py-6 sm:py-8 px-4 sm:px-6 lg:px-8 bg-base-200 page-type"
  >
    <!-- Main Content -->
    <div class="w-full max-w-7xl">
      <div class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden flex flex-col">
        <!-- Header / Banner -->
        <div class="max-h-36 shrink-0 bg-gradient-to-r from-primary/20 to-secondary/20 flex items-center px-4 sm:px-8 py-6 sm:py-8">

          <h1
            class="page-title font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent w-fit"
          >
            Profile
          </h1>
        </div>

        <div class="card-body p-4 sm:p-8 space-y-6">
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
                  <IconInput label="Username" :model-value="formData.username" readonly />

                  <!-- Identity (Read Only) -->
                  <IconInput label="Identity" :model-value="formData.identity" readonly />

                  <!-- Email (read-only, changed via modal) -->
                  <div class="flex flex-col sm:flex-row sm:items-end gap-3">
                    <IconInput class="flex-[3]" label="Email" :model-value="formData.email" readonly />
                    <button class="sm:flex-[2] btn whitespace-nowrap w-full sm:w-auto" type="button" @click="openEmailModal">
                      Change Email
                    </button>
                  </div>

                  <!-- Password (via modal) -->
                  <div class="flex flex-col sm:flex-row sm:items-end gap-3">
                    <IconInput class="flex-[3]" label="Password" model-value="••••••••" readonly />
                    <button class="sm:flex-[2] btn whitespace-nowrap w-full sm:w-auto" type="button" @click="openPasswordModal">
                      Change Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="divider text-xl">Quota Usage</div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-base-200 rounded-lg p-4">
              <div class="text-[1em] lg:text-[1.1em] text-base-content/60 mb-1">Storage Upload</div>
              <div class="text-[1em] font-semibold">
                {{ quota.uploadUsed }} / {{ quota.uploadMax }}
              </div>
              <progress
                class="progress progress-primary w-full mt-2"
                :value="quota.uploadPercent"
                max="100"
              ></progress>
            </div>
            <div class="bg-base-200 rounded-lg p-4">
              <div class="text-[1em] lg:text-[1.1em] text-base-content/60 mb-1">Files</div>
              <div class="text-[1em] font-semibold">{{ quota.fileCount }} / {{ quota.maxFiles }}</div>
              <progress
                class="progress progress-secondary w-full mt-2"
                :value="quota.filePercent"
                max="100"
              ></progress>
            </div>
            <div class="bg-base-200 rounded-lg p-4">
              <div class="text-[1em] lg:text-[1.1em] text-base-content/60 mb-1">Processing</div>
              <div class="text-[1em] font-semibold">{{ quota.procUsed }} / {{ quota.procMax }}</div>
              <progress
                class="progress progress-accent w-full mt-2"
                :value="quota.procPercent"
                max="100"
              ></progress>
            </div>
            <div class="bg-base-200 rounded-lg p-4">
              <div class="text-[1em] lg:text-[1.1em] text-base-content/60 mb-1">Downloads</div>
              <div class="text-[1em] font-semibold">{{ quota.downloadUsed }} / {{ quota.downloadMax }}</div>
              <progress
                class="progress progress-info w-full mt-2"
                :value="quota.downloadPercent"
                max="100"
              ></progress>
            </div>
          </div>

          <div class="divider text-xl">Academic Profile</div>

          <!-- Edit Form -->
          <form @submit.prevent="handleSave" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Institution -->
              <IconInput
                label="Institution"
                v-model="formData.institution"
                placeholder="University Name"
              />

              <!-- Position -->
              <IconSelect
                label="Position"
                v-model="formData.position"
                :options="positionOptions"
                placeholder="Select Position"
              />

              <!-- Research Field -->
              <IconInput
                label="Research Field"
                v-model="formData.research_field"
                placeholder="e.g. Computer Vision"
              />

              <!-- Region -->
              <IconSelect
                label="Region"
                v-model="formData.region"
                :options="regionOptions"
                placeholder="Select Region"
              />

              <!-- ORCID -->
              <IconInput 
                label="ORCID" v-model="formData.orcid" 
                placeholder="0000-0000-0000-0000" 
                />

              <!-- Homepage -->
              <IconInput
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
      :is-cooldown-active="isCooldownActive"
      :is-exhausted="isExhausted"
      :loading="loading"
      @send-code="sendVerificationCode"
      @confirm="submitEmailChange"
      @close="closeEmailModal"
    />

    <ChangePasswordModal
      v-model:new-password="newPassword"
      v-model:confirm-password="confirmPassword"
      :is-open="isPasswordModalOpen"
      :loading="savingPassword"
      @confirm="submitPasswordChange"
      @close="closePasswordModal"
    />
  </div>
</template>

<script setup lang="ts">
import IconInput from '@/shared/components/IconInput.vue'
import IconSelect from '@/shared/components/IconSelect.vue'
import EmailChangeModal from '@/features/users/components/EmailChangeModal.vue'
import ChangePasswordModal from '@/features/users/components/ChangePasswordModal.vue'
import { useUserProfileForm } from '@/features/users/composables/useUserProfileForm'

const {
  loading,
  positionOptions,
  regionOptions,
  formData,
  isEmailModalOpen,
  newEmail,
  emailCode,
  sendingCode,
  codeCooldown,
  isCooldownActive,
  isExhausted,
  isPasswordModalOpen,
  newPassword,
  confirmPassword,
  savingPassword,
  quota,
  openEmailModal,
  closeEmailModal,
  sendVerificationCode,
  submitEmailChange,
  openPasswordModal,
  closePasswordModal,
  submitPasswordChange,
  handleSave,
} = useUserProfileForm()
</script>
