<template>
  <div class="card max-w-lg w-full flex flex-col gap-4">
    <!-- === 1. 基础认证信息 === -->
    <h3 class="font-bold text-lg opacity-70 border-b pb-2">Account Info</h3>
    
    <!-- 用户名输入 -->
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

    <!-- 邮箱输入 -->
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

    <!-- 密码输入 -->
    <AuthInput
      v-model="form.password"
      icon-type="password"
      type="password"
      required placeholder="Password"
      :error="errors.password"
      @input="validatePasswordStrength"
      @focus="clearError('password')"
      @blur="validateField('password')"
    >
      <progress :value="passwordScore" class="flex progress" :class="progressBarClass" max="5" />
    </AuthInput>

    <!-- 确认密码 -->
    <AuthInput
      v-model="form.confirm_password"
      icon-type="password"
      type="password"
      required placeholder="Confirm Password"
      :error="errors.confirm_password"
      @blur="validateField('confirm_password')"
      @focus="clearError('confirm_password')"
    />

    <!-- 验证码 -->
    <div class="flex w-full gap-2">
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
        class="btn btn-secondary whitespace-nowrap min-w-[100px]"
        :disabled="isCountdownActive || loading.sendCode">
        <span v-if="loading.sendCode" class="loading loading-spinner loading-xs"></span>
        <span v-else-if="isCountdownActive">{{ countdown }}s</span>
        <span v-else>Send</span>
      </button>
    </div>

    <!-- === 2. 学术/个人资料信息 (新增) === -->
    <h3 class="font-bold text-lg opacity-70 border-b pb-2 mt-2">Profile Info</h3>

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

    <!-- Position (Dropdown) -->
    <div class="form-control w-full">
      <select 
        class="select select-bordered w-full" 
        :class="{'select-error': errors.position}"
        v-model="form.position"
        @change="validateField('position')"
        @focus="clearError('position')"
      >
        <option disabled value="">Select Position</option>
        <option v-for="pos in positionOptions" :key="pos" :value="pos">{{ pos }}</option>
      </select>
      <label class="label" v-if="errors.position">
        <span class="label-text-alt text-error">{{ errors.position }}</span>
      </label>
    </div>

    <!-- Research Field -->
    <AuthInput
      v-model="form.research_field"
      icon-type="research" 
      type="text"
      required placeholder="Research Field (e.g. Biology)"
      :error="errors.research_field"
      @blur="validateField('research_field')"
      @focus="clearError('research_field')"
    />

    <!-- Region (Dropdown from i18n-iso-countries) -->
    <div class="form-control w-full">
      <select 
        class="select select-bordered w-full" 
        :class="{'select-error': errors.region}"
        v-model="form.region"
        @change="validateField('region')"
        @focus="clearError('region')"
      >
        <option disabled value="">Select Region</option>
        <option v-for="country in regionOptions" :key="country.code" :value="country.name">
          {{ country.name }}
        </option>
      </select>
      <label class="label" v-if="errors.region">
        <span class="label-text-alt text-error">{{ errors.region }}</span>
      </label>
    </div>

    <!-- ORCID (Optional) -->
    <AuthInput
      v-model="form.orcid"
      icon-type="id-card" 
      type="text"
      placeholder="ORCID (Optional)"
      :error="errors.orcid"
      @blur="validateField('orcid')"
      @focus="clearError('orcid')"
    />

    <!-- Homepage (Optional) -->
    <AuthInput
      v-model="form.homepage"
      icon-type="link" 
      type="text"
      placeholder="Homepage URL (Optional)"
      :error="errors.homepage"
      @blur="validateField('homepage')"
      @focus="clearError('homepage')"
    />

    <!-- 注册按钮 -->
    <div class="form-control w-full mt-4">
      <button class="btn btn-primary w-full"
        @click="register"
        :disabled="loading.register">
        <span v-if="loading.register" class="loading loading-spinner loading-sm"></span>
        <span v-else>Sign Up</span>
      </button>
    </div>

    <!-- 跳转到登录 -->
    <div class="text-center mt-2 mb-4">
      <span class="text-sm opacity-75">Already have an account?</span>
      <router-link to="/login" class="link link-hover text-primary text-sm font-semibold ml-1">
        Sign in now
      </router-link>
    </div>
  </div> 

  <!-- Toast -->
  <div v-if="toast.show" class="toast toast-top toast-end z-50">
    <div :class="['alert', toast.type === 'success' ? 'alert-success' : 'alert-error']">
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import AuthInput from '../components/AuthInput.vue'
import { usrSignupApi, sendEmailCode } from '@/utils/usr-api'
import type { UsrSignup } from '@/types/usr';

import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

const router = useRouter()

const regionOptions = computed(() => {
  const countryObj = countries.getNames("en");
  
  return Object.entries(countryObj)
    .map(([code, name]) => {
      if (code === 'CN' || name === "People's Republic of China") {
        return { code, name: "China" };
      }
      return { code, name };
    })
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
const toast = reactive({ show: false, message: '', type: 'success' })
const isCountdownActive = ref(false)
const countdown = ref(60)
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

const showToast = (message: string, type = 'success') => {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => {
    toast.show = false
  }, 3000)
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
    validateField('email')
    if (errors.email) {
      showToast(errors.email, 'error')
      return
    }
  
    loading.sendCode = true
    try {
      await sendEmailCode(form.email)
      showToast('Verification code sent!', 'success')
      
      isCountdownActive.value = true
      const timer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
          clearInterval(timer)
          isCountdownActive.value = false
          countdown.value = 60
        }
      }, 1000)
      
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