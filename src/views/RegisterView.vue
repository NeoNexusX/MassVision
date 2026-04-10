<template>
  <div class="flex-1 w-full flex items-center justify-center p-8 bg-base-200/30">
    <div class="card max-w-5xl w-full bg-base-100 shadow-2xl rounded-2xl overflow-hidden border border-base-200">
      <div class="grid lg:grid-cols-2 gap-0 relative">
        
        <!-- Left Side: Account Credentials -->
        <div class="p-8 md:p-10 flex flex-col gap-5 border-b lg:border-b-0 lg:border-r border-base-200">
           <div class="mb-2">
             <h2 class="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent w-fit">Create Account</h2>
             <p class="text-base-content/60 mt-2 text-sm">Join MassFlow for scientific data analysis</p>
           </div>

           <!-- Username -->
           <AuthInput
              v-model="form.username"
              icon-type="user"
              type="text"
              required placeholder="Username"
              :pattern="patterns.username"
              :error="errors.username"
              @blur="validateField('username')"
              @focus="clearError('username')"
            />

            <!-- Email -->
            <AuthInput
              v-model="form.email"
              icon-type="email"
              type="email"
              required placeholder="Email"
              :pattern="patterns.email"
              :error="errors.email"
              @blur="validateField('email')"
              @focus="clearError('email')"
            />
            
            <!-- Password -->
            <div class="space-y-4">
                <AuthInput
                  v-model="form.password"
                  icon-type="password"
                  type="password"
                  required placeholder="Password"
                  :error="errors.password"
                  @input="validatePasswordStrength"
                  @focus="clearError('password')"
                  @blur="validateField('password')"
                />
                
                <!-- Password Strength Meter -->
                <div class="px-1 -mt-2">
                   <div class="flex justify-between text-xs mb-1 opacity-70">
                      <span>Strength</span>
                      <span>{{ ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][passwordScore - 1] || 'None' }}</span>
                   </div>
                   <progress :value="passwordScore" class="progress w-full h-2" :class="progressBarClass" max="5"></progress>
                </div>

                <AuthInput
                  v-model="form.confirm_password"
                  icon-type="password"
                  type="password"
                  required placeholder="Confirm Password"
                  :error="errors.confirm_password"
                  @blur="validateField('confirm_password')"
                  @focus="clearError('confirm_password')"
                />
            </div>

            <!-- Verify Code -->
            <div class="form-control">
                <div class="flex w-full gap-3 items-start">
                  <div class="flex-grow">
                    <AuthInput
                      v-model="form.verify_code"
                      icon-type="verify_code"
                      type="text"
                      required placeholder="Verify Code"
                      :pattern="patterns.verify_code"
                      :error="errors.verify_code"
                      @blur="validateField('verify_code')"
                      @focus="clearError('verify_code')"
                    />
                  </div>
                  <button
                    @click="sendVerificationCode"
                    class="btn btn-neutral min-w-[100px]"
                    :disabled="isCountdownActive || loading.sendCode || isExhausted"
                    :class="{'opacity-50 cursor-not-allowed': isExhausted}"
                    :title="isExhausted ? 'Too many requests for now' : ''">
                    <span v-if="loading.sendCode" class="loading loading-spinner loading-xs"></span>
                    <span v-else-if="isCountdownActive" class="font-mono">{{ countdown }}s</span>
                    <span v-else-if="isExhausted">Limit Reached</span>
                    <span v-else>Send Code</span>
                  </button>
                </div>
            </div>
            
             <div class="mt-auto pt-4 flex items-center justify-center text-sm">
                <span class="opacity-70">Already have an account?</span>
                <router-link to="/login" class="link link-primary font-bold ml-1 no-underline hover:underline">
                  Sign in
                </router-link>
            </div>
        </div>

        <!-- Right Side: Researcher Profile -->
        <div class="p-8 md:p-10 pb-32 flex flex-col gap-5 bg-base-50/50 dark:bg-base-200/20">
            <div class="mb-2">
               <h3 class="text-xl font-bold flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Researcher Profile
               </h3>
               <p class="text-base-content/60 text-sm mt-1">Complete your professional details</p>
            </div>

            <!-- Institution -->
            <AuthInput
              v-model="form.institution"
              icon-type="institution" 
              type="text"
              required placeholder="Institution / University"
              :error="errors.institution"
              @blur="validateField('institution')"
              @focus="clearError('institution')"
            />

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <!-- Position -->
                <AuthSelect
                  v-model="form.position"
                  :options="positionOptions"
                  icon-type="position"
                  placeholder="Position"
                  :error="errors.position"
                  @change="validateField('position')"
                  @focus="clearError('position')"
                />
                 <!-- Region -->
                <AuthSelect
                  v-model="form.region"
                  :options="regionOptions.map(c => ({ label: c.name, value: c.name }))"
                  icon-type="region"
                  placeholder="Region"
                  :error="errors.region"
                  @change="validateField('region')"
                  @focus="clearError('region')"
                />
            </div>

            <!-- Research Field -->
            <AuthSelect
              v-model="form.research_field"
              :options="researchFieldOptions"
              icon-type="research"
              placeholder="Research Field"
              :error="errors.research_field"
              @change="handleResearchFieldChange"
              @focus="clearError('research_field')"
            >
              <input 
                v-if="isOtherResearchField"
                type="text"
                v-model="customResearchField"
                class="input input-bordered w-full mt-3 input-sm"
                placeholder="Specify your field"
                @blur="validateField('research_field')"
              />
            </AuthSelect>

            <!-- Optional Fields Grid -->
            <div class="grid grid-cols-1 gap-4">
                <AuthInput
                  v-model="form.orcid"
                  icon-type="id-card" 
                  type="text"
                  placeholder="ORCID (Optional)"
                  :error="errors.orcid"
                  @blur="validateField('orcid')"
                  @focus="clearError('orcid')"
                />
                
                <AuthInput
                  v-model="form.homepage"
                  icon-type="link" 
                  type="text"
                  placeholder="Homepage URL (Optional)"
                  :error="errors.homepage"
                  @blur="validateField('homepage')"
                  @focus="clearError('homepage')"
                />
            </div>

            <!-- Action Button -->
            <div class="mt-8">
              <button class="btn btn-primary w-full btn-lg shadow-xl hover:scale-[1.01] transition-transform"
                @click="register"
                :disabled="loading.register">
                <span v-if="loading.register" class="loading loading-spinner loading-md"></span>
                <span v-else class="text-lg">Complete Registration</span>
              </button>
            </div>
        </div>

      </div>
    </div> 

    <!-- Toast Notification -->
    <!-- Removed local toast in favor of global toast -->
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useCountdown } from '@/utils/useCountdown'
import { useRouter } from 'vue-router'
import AuthInput from '../components/AuthInput.vue'
import AuthSelect from '../components/AuthSelect.vue'
import { usrSignupApi, sendEmailCode } from '@/utils/usr-api'
import type { UsrSignup } from '@/types/usr';
import { useToast } from '@/utils/toast';

import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

const router = useRouter()
const { showToast } = useToast()

const regionOptions = computed(() => {
  const countryObj = countries.getNames("en");
  
  return Object.entries(countryObj)
    .map(([code, name]) => {
      let displayName = name;
      if (code === 'CN' || name === "People's Republic of China") displayName = "China";
      if (code === 'US' || name === "United States of America") displayName = "United States";
      if (code === 'GB' || name === "United Kingdom of Great Britain and Northern Ireland") displayName = "United Kingdom";
      if (code === 'RU' || name === "Russian Federation") displayName = "Russia";
      if (code === 'KR' || name === "Korea, Republic of") displayName = "South Korea";
      if (code === 'KP' || name === "Korea, Democratic People's Republic of") displayName = "North Korea";
      return { code, name: displayName };
    })
    .filter((c) => c.name.length <= 28) 
    .sort((a, b) => a.name.localeCompare(b.name));
});

const positionOptions = [
  "Researcher",
  "Postdoctoral Researcher",
  "Research Assistant",
  "Research Engineer",
  "Senior Researcher",
  "Professor",
  "Associate Professor",
  "Lecture",
  "PhD Student",
  "Master's Student"
];

const researchFieldOptions = [
  "Chemistry",
  "Biology",
  "Medicine",
  "Pharmaceutical Science",
  "Biomedical Engineering",
  "Materials Science",
  "Analytical Chemistry",
  "Biotechnology",
  "Environmental Science",
  "Food Science",
  "Other"
];

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirm_password: '',
  verify_code: '',
  institution: '',
  position: '',
  research_field: '',
  region: '',
  orcid: '',
  homepage: ''
})

const isOtherResearchField = ref(false);
const customResearchField = ref('');

// Watch custom field to update form value when "Other" is active
watch(customResearchField, (newVal) => {
  if (isOtherResearchField.value) {
    form.research_field = newVal;
  }
});

const handleResearchFieldChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  if (target.value === 'Other') {
    isOtherResearchField.value = true;
    form.research_field = customResearchField.value; // Initialize with current custom input if any
  } else {
    isOtherResearchField.value = false;
    form.research_field = target.value;
  }
  validateField('research_field');
};

const errors = reactive({
  username: '',
  email: '',
  password: '',
  confirm_password: '',
  verify_code: '',
  institution: '',
  position: '',
  research_field: '',
  region: '',
  orcid: '',
  homepage: ''
})

const patterns = {
  username: '^[a-zA-Z0-9_-]{3,30}$',
  email: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  password: '^(?=.*[a-zA-Z])(?=.*\\d).{8,25}$',
  verify_code: '^[0-9]{6}$',
  url: '^(https?:\\/\\/)?' + 
       '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + 
       '((\\d{1,3}\\.){3}\\d{1,3}))' + 
       '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + 
       '(\\?[;&a-z\\d%_.~+=-]*)?' + 
       '(\\#[-a-z\\d_]*)?$',
  orcid: '^\\d{4}-\\d{4}-\\d{4}-\\d{3}[0-9X]$' 
}

const loading = reactive({ register: false, sendCode: false })
const { count: countdown, isActive: isCountdownActive, isExhausted, start: startCountdown, stop: stopCountdown } = useCountdown(60, 'register_code_attempts', 3)
const passwordScore = ref(0)
const progressBarClass = computed(() => {
  const classes = ['progress-error', 'progress-warning', 'progress-warning', 'progress-success', 'progress-success']
  return classes[passwordScore.value - 1] || 'progress-error'
})

const validatePasswordStrength = () => {
    const pwd = form.password
    if (!pwd) {
      passwordScore.value = 0
      return
    }
  
    let score = 0
    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^a-zA-Z0-9]/.test(pwd)) score++
  
    passwordScore.value = Math.min(score, 5)
}

const clearError = (field: keyof typeof errors) => { errors[field] = '' }

const validateField = (field: keyof typeof errors) => {
  const val = form[field];
  
  switch (field) {
    case 'username':
      errors.username = !val ? 'Username is required' :
        !new RegExp(patterns.username).test(val) ? 'Invalid username (3-30 chars, letters/numbers)' : ''
      break;
    case 'email':
      errors.email = !val ? 'Email is required' :
        !new RegExp(patterns.email).test(val) ? 'Invalid email address' : ''
      break;
    case 'password':
      errors.password = !val ? 'Password is required' :
        !new RegExp(patterns.password).test(val) ? 'Min 8 chars, letters & numbers required' : ''
      validatePasswordStrength()
      break;
    case 'confirm_password':
      errors.confirm_password = !val ? 'Confirm password is required' :
        val !== form.password ? 'Passwords do not match' : ''
      break;
    case 'verify_code':
      errors.verify_code = !val ? 'Code is required' :
        !new RegExp(patterns.verify_code).test(val) ? 'Must be 6 digits' : ''
      break;

    case 'institution':
      errors.institution = !val ? 'Institution is required' : '';
      break;
    case 'position':
      errors.position = !val ? 'Please select a position' : '';
      break;
    case 'research_field':
      errors.research_field = !val ? 'Research field is required' : '';
      break;
    case 'region':
      errors.region = !val ? 'Please select a region' : '';
      break;
    
    case 'orcid':
      if (val && !new RegExp(patterns.orcid).test(val)) {
        errors.orcid = 'Invalid ORCID format (e.g. 0000-0000-0000-0000)';
      } else {
        errors.orcid = '';
      }
      break;
    case 'homepage':
      if (val && !new RegExp(patterns.url, 'i').test(val)) {
        errors.homepage = 'Invalid URL format';
      } else {
        errors.homepage = '';
      }
      break;
  }
}

const sendVerificationCode = async () => {
    if (isExhausted.value) {
      showToast('Maximum verification code requests reached for this session. Please try again later.', 'error')
      return
    }

    validateField('email')
    if (errors.email) {
      showToast(errors.email, 'error')
      return
    }
  
    loading.sendCode = true
    try {
      await sendEmailCode(form.email)
      showToast('Verification code sent!', 'success')
      
      startCountdown()
      
    } catch (error: any) {
      console.error('Send code error:', error.message)
      showToast(error.message || 'Failed to send verification code', 'error')
    } finally {
      loading.sendCode = false
    }
}

const register = async () => {
  (Object.keys(form) as Array<keyof typeof errors>).forEach(key => {
    validateField(key)
  })

  const hasErrors = Object.values(errors).some(error => !!error)
  if (hasErrors) {
    showToast('Please fix errors in the form', 'error')
    return
  }

  if (!form.username || !form.email || !form.password || 
      !form.institution || !form.position || !form.region) {
     showToast('Please fill in all required fields', 'error');
     return;
  }

  loading.register = true

  try {
      const signupData: UsrSignup = {
        username: form.username,
        email: form.email,
        password: form.password,
        verify_code: form.verify_code,
        active: true,

        institution: form.institution,
        position: form.position,
        research_field: form.research_field,
        region: form.region,
        orcid: form.orcid || "", 
        homepage: form.homepage || "",
      };

      await usrSignupApi(signupData)

      showToast('Registration successful! Redirecting to login page...', 'success')
      setTimeout(() => {router.replace('/login')}, 2000)

  } catch (error: any) {
    console.error('Registration failed:', error.message);
    showToast(error.message || 'Registration failed', 'error');
  } finally {
    loading.register = false
  }
}

watch(() => form.password, () => {
  if (form.confirm_password) validateField('confirm_password')
})
</script>

<style scoped>
.progress { transition: all 0.3s ease; }
.toast { animation: slideIn 0.3s ease; }
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
</style>