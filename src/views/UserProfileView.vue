<template>
  <div class="flex-1 w-full flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8 bg-base-200">
    <!-- Navbar Removed (Using global Navbar) -->

    <!-- Main Content -->
    <div class="w-full max-w-7xl">
      <div class="card bg-base-100 border border-base-200 shadow-sm overflow-hidden flex flex-col">
        
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

                       <!-- Email (Editable) -->
                       <BaseInput label="Email" v-model="formData.email" type="email" />
    
                       <!-- Password (Editable) -->
                       <BaseInput label="New Password" v-model="formData.password" type="password" placeholder="Leave blank to keep current" />
                    </div>
                </div>
            </div>
          </div>

          <div class="divider">Academic Profile</div>

          <!-- Edit Form -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- Institution -->
            <BaseInput label="Institution" v-model="formData.institution" placeholder="University Name" />

            <!-- Position -->
            <BaseSelect label="Position" v-model="formData.position" :options="positionOptions" placeholder="Select Position" />

            <!-- Research Field -->
            <BaseInput label="Research Field" v-model="formData.research_field" placeholder="e.g. Computer Vision" />

            <!-- Region -->
            <BaseSelect label="Region" v-model="formData.region" :options="regionOptions" placeholder="Select Region" />

            <!-- ORCID -->
            <BaseInput label="ORCID" v-model="formData.orcid" placeholder="0000-0000-0000-0000" />

            <!-- Homepage -->
            <BaseInput label="Homepage" v-model="formData.homepage" placeholder="https://example.com" />

          </div>
          
           <div class="flex justify-end pt-4 border-t border-base-200 mt-6">
              <button class="btn btn-primary" @click="handleSave" :disabled="loading">
                <span v-if="loading" class="loading loading-spinner"></span>
                Save All Changes
              </button>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getCurrentUser, updateUserProfile } from '../utils/usr-api';
import { useToast } from '../utils/toast';  // Import toast
import { useAuthStore } from '../stores/auth';
// 引入国家列表库 (与 RegisterView 保持一致)
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import BaseInput from '../components/BaseInput.vue';
import BaseSelect from '../components/BaseSelect.vue';

countries.registerLocale(enLocale);

const router = useRouter();
const { showToast } = useToast();  // Initialize toast
const authStore = useAuthStore();
const loading = ref(false);

// 1. Dropdown options
const regionOptions = computed(() => {
  const countryObj = countries.getNames("en");
  return Object.entries(countryObj)
    .map(([code, name]) => {
      // China code handling
      if (code === 'CN') return { code, name: "China" };
      return { code, name };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
});

const positionOptions = [
  "Researcher", "Postdoctoral Researcher", "Research Assistant", 
  "Research Engineer", "Senior Researcher", "Professor", 
  "Associate Professor", "Lecture", "PhD Student", "Master's Student"
];

// 2. Form Data Model
const formData = reactive({
  id: null as number | null,
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

// 3. Fetch Current User
onMounted(async () => {
    loading.value = true;
    try {
        const res = await getCurrentUser();
    const data = res.data || {};
    
    formData.id = (data as any).id || null;
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

// 4. Save Changes
const handleSave = async () => {
  loading.value = true;
  const messages: string[] = [];
  
  try {
    // --- 1. Update Academic Profile (using user_change as temporary solution) ---
    // Ensure payload matches backend expectations (explicitly including username/email/id)
    const profilePayload = {
      // Add ID if available (often required for updates)
      ...((formData as any).id ? { id: (formData as any).id } : {}),
      username: formData.username,
      email: formData.email,
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
    const detailedMsg = profileError.response?.data?.detail 
        ? JSON.stringify(profileError.response.data.detail) 
        : profileError.message;
    messages.push(`Profile update failed: ${detailedMsg}`);
  }
  
  // --- 2. Update Account Info (Password) if changed ---
  let logoutRequired = false;

  // Check if password field has content
  if (formData.password && formData.password.trim() !== "") {
    try {
        await updateUserProfile({ password: formData.password } as any);
        logoutRequired = true;
        messages.push("Password updated.");
    } catch (pwError: any) {
            console.warn("Password update failed:", pwError);
            messages.push("Failed to update password.");
    }
  }
  
  formData.password = ''; // Clear password field after successful update

  // Re-fetch user data to display latest values
  try {
    const refreshRes = await getCurrentUser();
    // Defensive check
    if (refreshRes.data) {
        const data = refreshRes.data;
        formData.id = (data as any).id || formData.id;
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
  // Check if any failure occurred to decide toast type
  const isFailure = messages.some(msg => msg.includes("failed"));
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