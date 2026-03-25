
<template>
  <div class="navbar sticky top-0 z-50 bg-base-100/90 backdrop-blur transition-all duration-300 shadow-sm/5 border-b border-base-200/50">
    <!-- Navbar Start: Logo & Mobile Menu & Desktop Menu -->
    <div class="navbar-start w-auto lg:w-auto lg:flex-1">
      <!-- Mobile Hamburger -->
      <div class="dropdown lg:hidden">
        <div tabindex="0" role="button" class="btn btn-ghost btn-circle">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </div>
        <ul tabindex="0" class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow-lg border border-base-200">
           <!-- Mobile Items -->
           <!-- <li><a>Upload</a></li> -->
           <li>
             <details>
                <summary>Datahub</summary>
                <ul>
                  <li><router-link to="/datasets">Public Datasets</router-link></li>
                  <li v-if="user"><router-link to="/my-datasets">My Datasets</router-link></li>
                </ul>
             </details>
           </li>
           <li><a>Add-ons</a></li>
           <li><a>Support</a></li>
           <li><a>News <span class="badge badge-xs badge-error"></span></a></li>
           <div class="divider my-1"></div>
           <li v-if="!user"><router-link to="/login">Sign in</router-link></li>
           <li v-if="!user"><router-link to="/register">Create account</router-link></li>
           <li v-if="user"><router-link to="/profile">Profile</router-link></li>
           <li v-if="user"><a @click="logout" class="text-error">Logout</a></li>
        </ul>
      </div>

       <!-- Logo (Left) -->
       <router-link to="/" class="btn btn-ghost normal-case text-xl font-bold flex gap-2 hover:bg-transparent px-2">
          <!-- MassFlow Logo (Mass Spec Peaks) -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 text-indigo-600">
            <line x1="12" y1="20" x2="12" y2="8" stroke-width="2.5"></line>
            <circle cx="12" cy="6" r="2" fill="currentColor" stroke="none"></circle>
            
            <line x1="6" y1="20" x2="6" y2="12" stroke-width="2.5"></line>
            <circle cx="6" cy="10" r="2" fill="currentColor" stroke="none"></circle>
            
            <line x1="18" y1="20" x2="18" y2="14" stroke-width="2.5"></line>
            <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none"></circle>
          </svg>
          <span class="bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-white bg-clip-text text-transparent hidden sm:inline-block">MassFlow</span>
       </router-link>

       <!-- Desktop Menu (Moved to Start/Left) -->
       <div class="hidden lg:flex ml-4">
           <ul class="menu menu-horizontal px-1 gap-1 font-medium text-slate-600 dark:text-slate-300">
              <!-- Upload Removed -->
              <li>
                <details>
                  <summary class="hover:text-indigo-600 hover:bg-transparent hover:scale-105 transition-all duration-300 flex items-center gap-1.5">
                    <!-- Datasets Icon: Database -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                    Datahub
                  </summary>
                  <ul class="p-2 z-[100] bg-base-100 rounded-box shadow-md w-48">
                    <li><router-link to="/datasets">Public Datasets</router-link></li>
                    <template v-if="user">
                      <li><router-link to="/my-datasets">My Datasets</router-link></li>
                    </template>
                  </ul>
                </details>
              </li>
              <li><a class="hover:text-indigo-600 hover:bg-transparent hover:scale-105 transition-all duration-300 flex items-center gap-1.5">
                <!-- Support Icon: Help Circle -->
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                Support
              </a></li>
           </ul>
       </div>
    </div>

    <!-- Navbar End: Buttons -->
    <div class="navbar-end w-full lg:flex-1 gap-3 justify-end">
        
       <!-- Dark Mode Toggle -->
       <label class="swap swap-rotate hover:scale-110 transition-transform duration-300 btn btn-ghost btn-circle btn-sm">
        <input type="checkbox" :checked="isDark" @change="toggleTheme" />
        <svg class="swap-off fill-current w-5 h-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>
        <svg class="swap-on fill-current w-5 h-5 text-indigo-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/></svg>
      </label>

       <!-- Desktop Buttons -->
       <div class="hidden lg:flex items-center gap-2">
           <!-- Pro Button Removed -->

           <template v-if="!user">
               <router-link to="/register" class="btn btn-ghost btn-sm normal-case font-medium text-slate-600 hover:text-indigo-600 hover:bg-transparent transition-all duration-300 hover:-translate-y-0.5">
                   Create account
               </router-link>
               <router-link to="/login" class="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white border-0 normal-case px-5 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                   Sign in
               </router-link>
           </template>

           <div v-else class="dropdown dropdown-end">
             <div tabindex="0" role="button" class="btn btn-ghost rounded-btn flex items-center gap-2 px-1 hover:bg-base-200 dark:bg-slate-800 transition-all duration-300">
               <div class="avatar placeholder">
                 <div class="bg-indigo-100 text-indigo-700 rounded-full w-8 h-8 flex items-center justify-center">
                   <span class="text-sm font-bold">{{ userInitial }}</span>
                 </div>
               </div>
               <span class="font-medium text-sm text-slate-700 dark:text-slate-200 mr-1">{{ user.username }}</span>
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up w-3 h-3 opacity-50 dark:opacity-100 dark:text-slate-300"><path d="m6 9 6 6 6-6"/></svg>
             </div>
             <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-200">
               <li class="menu-title px-4 py-2 opacity-50 text-xs uppercase tracking-wider">Account</li>
               <li><router-link to="/profile" class="hover:text-indigo-600 my-0.5">Profile</router-link></li>
               <div class="divider my-0"></div>
               <li><a @click="logout" class="text-error hover:bg-error/10 my-0.5">Sign out</a></li>
             </ul>
           </div>
       </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { storeToRefs } from 'pinia';

const router = useRouter();
const authStore = useAuthStore();
const { user } = storeToRefs(authStore);

const isMobileLayout = ref(false);
const isDark = ref(false);

const toggleTheme = () => {
  isDark.value = !isDark.value;
  const theme = isDark.value ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
};

const userInitial = computed(() => {
  return user.value?.username?.charAt(0).toUpperCase();
});

const checkLayout = () => {
  const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  isMobileLayout.value = width < 768;
};

const logout = async () => {
  console.log("Starting secure logout process...");
  await authStore.logout();
  router.push('/login');
};

onMounted(() => {
  // Initialize Theme
  const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (savedTheme === 'dark') {
    isDark.value = true;
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    isDark.value = false;
    document.documentElement.setAttribute('data-theme', 'light');
  }

  if (!user.value) {
     authStore.fetchUser();
  }
  checkLayout();
  window.addEventListener('resize', checkLayout);
  if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', checkLayout);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', checkLayout);
  if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', checkLayout);
  }
});
</script>
