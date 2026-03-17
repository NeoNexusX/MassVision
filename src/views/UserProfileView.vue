<!-- filepath: d:\Users\lyk\MassVision\src\views\UserProfileView.vue -->
<template>
  <div class="w-full h-full flex justify-center items-center">
    <!-- Navbar Removed (Using global Navbar) -->

    <!-- Main Content -->
    <div class="w-full max-w-7xl mx-auto">
      <div class="card bg-base-100 border border-base-200 shadow-sm overflow-hidden max-h-[calc(100vh-8rem)] flex flex-col">
        
        <!-- Header / Banner -->
        <div class="h-32 shrink-0 bg-gradient-to-r from-primary/20 to-secondary/20 flex items-center px-8">
           <h1 class="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent w-fit">Profile</h1>
        </div>

    <div class="card-body overflow-y-auto custom-scrollbar">
          <!-- User Avatar & Basic Info -->
          <div class="flex flex-col gap-6 mb-6">
            <div class="flex flex-col sm:flex-row gap-6 items-center">
                <div class="avatar placeholder ring ring-base-100 ring-offset-2 rounded-full">
                  <div class="bg-primary text-primary-content rounded-full w-24 h-24 flex items-center justify-center text-3xl">
                    <span>{{ formData.username.charAt(0).toUpperCase() }}</span>
                  </div>
                </div>
                
                <div class="flex-1 w-full">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <!-- Username (Read Only) -->
                       <div class="form-control">
                         <label class="label"><span class="label-text font-semibold opacity-70">Username</span></label>
                         <input type="text" :value="formData.username" readonly class="input input-bordered w-full bg-base-200" />
                       </div>

                        <!-- Identity (Read Only) -->
                       <div class="form-control">
                         <label class="label"><span class="label-text font-semibold opacity-70">Identity</span></label>
                         <input type="text" :value="formData.identity" readonly class="input input-bordered w-full bg-base-200" />
                       </div>

                       <!-- Email (Editable) -->
                       <div class="form-control">
                         <label class="label"><span class="label-text font-semibold">Email</span></label>
                         <input type="email" v-model="formData.email" class="input input-bordered w-full" />
                       </div>
    
                       <!-- Password (Editable) -->
                       <div class="form-control">
                         <label class="label"><span class="label-text font-semibold">New Password</span></label>
                         <input type="password" v-model="formData.password" class="input input-bordered w-full" placeholder="Leave blank to keep current" />
                       </div>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end">
              <button class="btn btn-primary" @click="handleSave" :disabled="loading">
                <span v-if="loading" class="loading loading-spinner"></span>
                Save All Changes
              </button>
            </div>
          </div>

          <div class="divider">Academic Profile</div>

          <!-- Edit Form -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- Institution -->
            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Institution</span></label>
              <input type="text" v-model="formData.institution" class="input input-bordered w-full" placeholder="University Name" />
            </div>

            <!-- Position -->
            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Position</span></label>
              <select class="select select-bordered w-full" v-model="formData.position">
                <option disabled value="">Select Position</option>
                <option v-for="pos in positionOptions" :key="pos" :value="pos">{{ pos }}</option>
              </select>
            </div>

            <!-- Research Field -->
            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Research Field</span></label>
              <input type="text" v-model="formData.research_field" class="input input-bordered w-full" placeholder="e.g. Computer Vision" />
            </div>

            <!-- Region -->
            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Region</span></label>
              <select class="select select-bordered w-full" v-model="formData.region">
                <option disabled value="">Select Region</option>
                <option v-for="country in regionOptions" :key="country.code" :value="country.name">
                  {{ country.name }}
                </option>
              </select>
            </div>

            <!-- ORCID -->
            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">ORCID</span></label>
              <input type="text" v-model="formData.orcid" class="input input-bordered w-full" placeholder="0000-0000-0000-0000" />
            </div>

            <!-- Homepage -->
            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Homepage</span></label>
              <input type="text" v-model="formData.homepage" class="input input-bordered w-full" placeholder="https://example.com" />
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getCurrentUser, updateUserProfile, updateUserInfo, logoutApi } from '../utils/usr-api';
// 引入国家列表库 (与 RegisterView 保持一致)
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

const router = useRouter();
const loading = ref(false);

// 1. 下拉选项数据
const regionOptions = computed(() => {
  const countryObj = countries.getNames("en");
  return Object.entries(countryObj)
    .map(([code, name]) => {
      // 保持之前的特殊处理
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

// 2. 表单数据模型
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

// 3. 获取当前用户信息
onMounted(async () => {
    loading.value = true;
    try {
        const res = await getCurrentUser();
        const data = res.data || {};
        
        // 使用显式赋值以确保健壮性
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

// 4. 保存更改
const handleSave = async () => {
  loading.value = true;
  const messages: string[] = [];
  
  try {
    // --- 1. Update Academic Profile ---
    // We try to update this first. If it fails (e.g. 405 Method Not Allowed),
    // we catch the error so that we can still proceed to update the Account Info.
    try {
        const profilePayload = {
          institution: formData.institution,
          position: formData.position,
          research_field: formData.research_field,
          region: formData.region,
          orcid: formData.orcid,
          homepage: formData.homepage
        };

        const profileRes = await updateUserProfile(profilePayload);
        
        // 如果后端返回更新后的数据，刷新本地视图
        if (profileRes.data) {
            const { password, ...rest } = profileRes.data; 
            Object.assign(formData, rest);
        }
        messages.push("Academic profile updated.");
    } catch (profileError: any) {
        console.warn("Profile update failed:", profileError);
        if (profileError.response && profileError.response.status === 405) {
            // Backend doesn't support PATCH /user
            // messages.push("Note: Academic info update is not supported by server.");
        } else {
            messages.push("Failed to update academic profile.");
        }
    }
    
    // --- 2. Update Account Info (Email / Password) if changed ---
    let accountUpdated = false;
    let logoutRequired = false;

    // Only send if email or password is provided/changed.
    // Since we don't track dirty state for email, we send it if it's there.
    const accountPayload: any = {
        username: formData.username,
        email: formData.email,
        password: (formData.password && formData.password.trim() !== "") ? formData.password : ""
    };

    // Only call API if necessary? 
    // The previous logic was: always call it. 
    // If backend /user_change allows updating email/password, we should call it.
    await updateUserInfo(accountPayload);
    accountUpdated = true;
    messages.push("Account info (Email/Password) updated.");

    // Check if critical info changed that requires re-login
    if (accountPayload.password) {
        logoutRequired = true;
    }
    
    formData.password = ''; // Clear password field after successful update

    const fullMessage = messages.join("\n") + (logoutRequired ? "\n\nPlease login again with your new password." : "");
    alert(fullMessage);
    
    if (logoutRequired) {
        handleLogout();
    }

  } catch (error: any) {
    console.error("Account update failed:", error);
    const msg = error.message || "Failed to update account info";
    alert(`${messages.join("\n")}\nError: ${msg}`);
  } finally {
    loading.value = false;
  }
};

// 5. 登出逻辑
const handleLogout = async () => {
    console.log("Attempting to invalidate token on server...");
    try {
        await logoutApi();
        console.log("✅ Token successfully revoked by backend.");
    } catch (error) {
        // Even if backend fails (e.g. timeout), we must clear token locally
        console.warn("⚠️ Backend revocation failed or endpoint not ready:", error);
    } finally {
        localStorage.removeItem('access_token');
        router.push('/login');
        console.log("✅ Local session cleared.");
    }
};
</script>