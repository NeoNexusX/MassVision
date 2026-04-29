<template>
  <div class="flex-1 w-full flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8 bg-base-200">
    <!-- Navbar Removed (Using global Navbar) -->

    <!-- Main Content -->
    <div class="w-full max-w-7xl">
      <div class="card bg-base-100 border border-base-200 shadow-sm overflow-visible flex flex-col">
        
        <!-- Header / Banner -->
        <div class="h-32 shrink-0 bg-gradient-to-r from-primary/20 to-secondary/20 flex items-center px-8">
           <h1 class="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent w-fit">Profile</h1>
        </div>

    <div class="card-body p-8 space-y-6">
          <!-- User Avatar & Basic Info -->
          <div class="flex flex-col gap-6 mb-6">
            <div class="flex flex-col sm:flex-row gap-6 items-center">
                <div class="avatar placeholder ring ring-base-100 ring-offset-2 rounded-full">
                  <div class="bg-primary text-primary-content rounded-full w-24 h-24 flex items-center justify-center text-3xl">
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
                             <button class="btn btn-sm w-28" type="button" @click="openEmailModal">Change Email</button>
                           </div>
                         </div>
                       </div>
    
                       <!-- Password (Editable) -->
                       <BaseInput label="New Password" v-model="formData.password" type="password" placeholder="Leave blank to keep current" />
                    </div>
                </div>
            </div>
          </div>

          <div class="divider">Academic Profile</div>

          <!-- Edit Form -->
          <form @submit.prevent="handleSave" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Institution -->
              <BaseInput label="Institution" v-model="formData.institution" placeholder="University Name" />

              <!-- Position -->
              <div>
                <label class="label mb-0"><span class="label-text font-semibold">Position</span></label>
                <div class="bold-select">
                  <DropdownSelect v-model="formData.position" :options="positionOptions" placeholder="Select Position" />
                </div>
              </div>

              <!-- Research Field -->
              <BaseInput label="Research Field" v-model="formData.research_field" placeholder="e.g. Computer Vision" />

              <!-- Region -->
              <div>
                <label class="label mb-0"><span class="label-text font-semibold">Region</span></label>
                <div class="bold-select">
                  <DropdownSelect v-model="regionLabel" :options="regionNames" placeholder="Select Region" />
                </div>
              </div>

              <!-- ORCID -->
              <BaseInput label="ORCID" v-model="formData.orcid" placeholder="0000-0000-0000-0000" />

              <!-- Homepage -->
              <BaseInput label="Homepage" v-model="formData.homepage" placeholder="https://example.com" />
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
    
      <!-- Email Change Modal -->
      <div v-if="isEmailModalOpen" class="modal modal-open">
        <div class="modal-box max-w-md">
          <h3 class="font-bold text-lg">Change Email</h3>
          <p class="py-2">Enter new email and the verification code sent to it.</p>

          <div class="form-control">
            <label class="label"><span class="label-text">New Email</span></label>
            <input type="email" v-model="newEmail" placeholder="you@example.com" class="input input-bordered w-full" />
          </div>

          <div class="form-control mt-3">
            <label class="label"><span class="label-text">Verification Code</span></label>
            <div class="flex gap-2">
              <input type="text" v-model="emailCode" placeholder="123456" class="input input-bordered flex-1" />
              <button class="btn btn-outline btn-neutral border-base-300 shadow-none" :disabled="sendingCode || codeCooldown>0" @click="sendVerificationCode">
                <span v-if="codeCooldown>0">Resend ({{ codeCooldown }})</span>
                <span v-else>Send Code</span>
              </button>
            </div>
          </div>

          <div class="modal-action">
            <button class="btn" type="button" @click="closeEmailModal">Cancel</button>
            <button class="btn btn-primary" type="button" @click="submitEmailChange" :disabled="loading">Confirm</button>
          </div>
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { getCurrentUser, updateUserProfile, sendEmailCode } from '../utils/usr-api';
import { formatErrorMessage } from '../utils/api';
import { useToast } from '@/composables/useToast';  // Import toast
import { useAuthStore } from '../stores/auth';
// Import country list library (consistent with RegisterView)
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import BaseInput from '../components/BaseInput.vue';
import DropdownSelect from '../components/BaseSelect.vue';

countries.registerLocale(enLocale);

const router = useRouter();
const { showToast } = useToast();  // Initialize toast
const authStore = useAuthStore();
const loading = ref(false);

// 1. Dropdown options
const countryObj = countries.getNames("en");
const countryList = Object.entries(countryObj)
  .map(([code, name]) => ({ code, name: code === 'CN' ? 'China' : name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const regionOptions = computed(() => countryList);
const regionNames = computed(() => countryList.map(c => c.name));

const regionLabel = computed<string>({
  get() {
    const found = countryList.find(c => c.code === formData.region);
    return found ? found.name : '';
  },
  set(val: string) {
    const found = countryList.find(c => c.name === val);
    formData.region = found ? found.code : val;
  }
});

const positionOptions = [
  "Researcher", "Postdoctoral Researcher", "Research Assistant", 
  "Research Engineer", "Senior Researcher", "Professor", 
  "Associate Professor", "Lecture", "PhD Student", "Master's Student"
];

// 2. Form Data Model
const formData = reactive({
  username: '',
  email: '',
  password: '', // New password field
  identity: '',
  institution: '',
  position: '',
  research_field: '',
  region: '',
  orcid: '',
  homepage: ''
});

// Email change modal state
const isEmailModalOpen = ref(false);
const newEmail = ref('');
const emailCode = ref('');
const sendingCode = ref(false);
const codeCooldown = ref(0);
let codeTimer: number | null = null;

const startCodeCooldown = (seconds = 60) => {
  codeCooldown.value = seconds;
  if (codeTimer) window.clearInterval(codeTimer);
  codeTimer = window.setInterval(() => {
    codeCooldown.value -= 1;
    if (codeCooldown.value <= 0 && codeTimer) {
      window.clearInterval(codeTimer);
      codeTimer = null;
    }
  }, 1000);
};

const openEmailModal = () => {
  newEmail.value = '';
  emailCode.value = '';
  isEmailModalOpen.value = true;
};

const closeEmailModal = () => {
  isEmailModalOpen.value = false;
  // clear any running cooldown timer when modal is closed
  if (codeTimer !== null) {
    window.clearInterval(codeTimer);
    codeTimer = null;
  }
  codeCooldown.value = 0;
};

const sendVerificationCode = async () => {
  if (!newEmail.value || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.value)) {
    showToast('Please enter a valid email address', 'warning');
    return;
  }
    try {
    sendingCode.value = true;
    await sendEmailCode(newEmail.value, 'update');
    showToast('Verification code sent to email', 'success');
    startCodeCooldown(60);
  } catch (err: any) {
    showToast(err?.message || 'Failed to send verification code', 'error');
  } finally {
    sendingCode.value = false;
  }
};

const submitEmailChange = async () => {
  if (!newEmail.value || !emailCode.value) {
    showToast('Please enter new email and verification code', 'warning');
    return;
  }
    try {
    loading.value = true;
    // Build payload: include email + verify_code and current profile fields (backend requires other info)
    const payload: any = {
      email: newEmail.value,
      verify_code: emailCode.value,
      username: formData.username,
      institution: formData.institution,
      position: formData.position,
      research_field: formData.research_field,
      region: formData.region,
      orcid: formData.orcid,
      homepage: formData.homepage
    };
    await updateUserProfile(payload as any);
    formData.email = newEmail.value;
    showToast('Email updated successfully', 'success');
    closeEmailModal();
  } catch (err: any) {
    // Prefer formatted backend message when available
    console.error('Email change failed:', err?.response?.data ?? err);
    const backendDetail = err?.response?.data?.detail ?? err?.response?.data;
    const friendly = formatErrorMessage(backendDetail || err?.message || 'Failed to update email');
    showToast(friendly, 'error');
  } finally {
    loading.value = false;
  }
};

// 3. Fetch Current User
onMounted(async () => {
    loading.value = true;
    try {
        const res = await getCurrentUser();
    const data = res.data || {};
    
    formData.username = data.username || '';
    formData.email = data.email || '';
    formData.identity = data.identity || '';
    formData.institution = data.institution || '';
    formData.position = data.position || '';
    formData.research_field = data.research_field || '';
    formData.region = data.region || '';
    formData.orcid = data.orcid || '';
    formData.homepage = data.homepage || '';

    // Clear password field as it should be empty initially
    formData.password = ''; 
    } catch (error: any) {
        console.error("Failed to fetch user profile:", error);
        if (error.response && error.response.status === 401) {
            handleLogout();
        }
    } finally {
        loading.value = false;
    }
});

onUnmounted(() => {
  if (codeTimer !== null) {
    window.clearInterval(codeTimer);
    codeTimer = null;
  }
});

// 4. Save Changes
const handleSave = async () => {
  loading.value = true;
  const messages: string[] = [];
  
  try {
    // --- 1. Update Academic Profile (using user_change as temporary solution) ---
    // Ensure payload matches backend expectations (explicitly including username/email/id)
    const profilePayload = {
      username: formData.username,
      institution: formData.institution,
      position: formData.position,
      research_field: formData.research_field,
      region: formData.region,
      orcid: formData.orcid,
      homepage: formData.homepage,
    };

    // Cast to any to avoid TS error
    await updateUserProfile(profilePayload as any);
    messages.push("Profile info updated.");
  } catch (profileError: any) {
    console.warn("Profile update failed:", profileError);
    const candidate = profileError?.response?.data?.detail ?? profileError?.response?.data?.message ?? profileError?.response?.data?.msg ?? profileError?.message;
    messages.push(`Profile update failed: ${formatErrorMessage(candidate)}`);
  }
  
  // --- 2. Update Account Info (Password) if changed ---
  let logoutRequired = false;

  // Check if password field has content
  if (formData.password && formData.password.trim() !== "") {
    try {
        await updateUserProfile({ password: formData.password });
        logoutRequired = true;
        messages.push("Password updated.");
    } catch (pwError: any) {
            console.warn("Password update failed:", pwError);
            const candidate = pwError?.response?.data?.detail ?? pwError?.response?.data?.message ?? pwError?.response?.data?.msg ?? pwError?.message;
            messages.push(`Failed to update password: ${formatErrorMessage(candidate)}`);
    }
  }
  
  formData.password = ''; // Clear password field after successful update

  // Re-fetch user data to display latest values
  try {
    const refreshRes = await getCurrentUser();
    // Defensive check
    if (refreshRes.data) {
        const data = refreshRes.data;
        // ID is not required by backend; do not update it
        formData.username = data.username || formData.username;
        formData.email = data.email || formData.email;
        formData.identity = data.identity || formData.identity;
        formData.institution = data.institution || formData.institution;
        formData.position = data.position || formData.position;
        formData.research_field = data.research_field || formData.research_field;
        formData.region = data.region || formData.region;
        formData.orcid = data.orcid || formData.orcid;
        formData.homepage = data.homepage || formData.homepage;
    }
  } catch (refreshError) {
        console.warn("Silent refresh failed after save:", refreshError);
  }

  const fullMessage = messages.join("\n") + (logoutRequired ? "\n\nPlease login again with your new password." : "");
  // Check if any failure occurred to decide toast type (case-insensitive)
  const isFailure = messages.some(msg => msg.toLowerCase().includes("failed"));
  showToast(fullMessage, isFailure ? 'error' : 'success');
  
  if (logoutRequired) {
    setTimeout(() => {
            handleLogout();
    }, 1500);
  }

  loading.value = false;
};

// 5. Logout
const handleLogout = async () => {
    // authStore.logout() handles API, state cleanup and toasts
    await authStore.logout();
    router.push('/login');
};
</script>

<style scoped>
/* Make dropdown displayed value bold only on this page for elements wrapped in .bold-select */
.bold-select ::v-deep .truncate {
  font-weight: 600 !important;
}
</style>