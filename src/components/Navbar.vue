<template>
  <!-- DaisyUI Drawer for left sidebar overlay -->
  <div class="drawer z-[9998]">
    <input id="nav-drawer" type="checkbox" class="drawer-toggle" v-model="sidebarOpen" />
    <!-- The actual drawer sidebar layer: overlay + menu content -->
    <div class="drawer-side fixed inset-0 h-screen">
      <!-- Clicking this dark backdrop overlay closes the menu -->
      <label for="nav-drawer" aria-label="close sidebar" class="drawer-overlay" @click.prevent="sidebarOpen = false"></label>
      <!-- Menu itself: Base bg, fixed width (w-4/5 mobile sm:w-[450px] tablet/desktop) -->
      <ul class="menu p-8 w-4/5 sm:w-[450px] min-h-full bg-base-100 text-base-content space-y-6 overflow-y-auto">
        <li class="menu-title mb-8 flex items-center gap-5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 text-blue-600"><line x1="12" y1="20" x2="12" y2="8" stroke-width="2.5"></line><circle cx="12" cy="6" r="2" fill="currentColor" stroke="none"></circle><line x1="6" y1="20" x2="6" y2="12" stroke-width="2.5"></line><circle cx="6" cy="10" r="2" fill="currentColor" stroke="none"></circle><line x1="18" y1="20" x2="18" y2="14" stroke-width="2.5"></line><circle cx="18" cy="12" r="2" fill="currentColor" stroke="none"></circle></svg>
          <span class="text-2xl md:text-3xl font-semibold">MassFlow</span>
        </li>
        <li>
          <router-link to="/" @click="sidebarOpen = false" class="flex items-center gap-6 py-4 px-3 text-xl">
            <SvgIcon type="home" class="!w-8 !h-8 text-base-content" />
            <span class="align-middle">Home</span>
          </router-link>
        </li>

        <li tabindex="0">
          <a class="justify-between flex items-center gap-6">
            <span class="flex items-center gap-6">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-base-content" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              <span class="text-xl">Datahub</span>
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>
          </a>
          <ul class="p-2 space-y-3">
            <li>
              <router-link to="/datasets" @click="sidebarOpen = false" class="flex items-center gap-6 py-4 px-3 text-xl">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-base-content" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="4" rx="2"/><rect x="3" y="10" width="18" height="4" rx="2"/><rect x="3" y="16" width="18" height="4" rx="2"/></svg>
                <span>Public Datasets</span>
              </router-link>
            </li>
            <li v-if="user">
              <router-link to="/my-datasets" @click="sidebarOpen = false" class="flex items-center gap-6 py-4 px-3 text-xl">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-base-content" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 7l4-4h10l4 4"/></svg>
                <span>My Datasets</span>
              </router-link>
            </li>
          </ul>
        </li>
        <li>
          <a @click.prevent="openSupport" class="flex items-center gap-4 py-3 px-2 text-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-base-content" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.09 9a3 3 0 0 1 5.82 1c0 1.5-2 2-2 2" />
              <circle cx="12" cy="17" r="1" fill="currentColor" />
            </svg>
            <span>Support</span>
          </a>
        </li>
        <li v-if="!user">
          <router-link to="/login" class="flex items-center gap-4 py-3 px-2 text-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-base-content" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            <span>Sign in</span>
          </router-link>
        </li>
        <li v-if="!user">
          <router-link to="/register" class="flex items-center gap-4 py-3 px-2 text-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-base-content" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 11a4 4 0 0 0-8 0"/></svg>
            <span>Create account</span>
          </router-link>
        </li>
      </ul>
    </div>
  </div>

  <!-- FAB: fixed bottom-right, always on top -->
  <div class="fixed bottom-4 right-4 z-[9999]">
    <div class="fab fab-flower" :class="{ 'fab-open': fabOpen }">
      <!-- Trigger (focusable) - default Home icon -->
      <div tabindex="0" role="button" class="btn btn-circle btn-lg" @click="toggleFab" aria-label="Open menu">
        <SvgIcon type="home" class="!w-6 !h-6 text-base-content" aria-label="Home" />
      </div>

      <!-- Main Action button replaces the trigger when FAB is open -->
      <button class="fab-main-action btn btn-circle btn-lg btn-primary" aria-label="Main action">
        <template v-if="user">
          <div class="bg-indigo-100 text-indigo-700 rounded-full w-8 h-8 flex items-center justify-center">
            <span class="text-sm font-bold">{{ userInitial }}</span>
          </div>
        </template>
        <template v-else>
          <!-- personal silhouette icon when not logged in -->
          <svg xmlns="http://www.w3.org/2000/svg" aria-label="Profile" viewBox="0 0 16 16" fill="currentColor" class="size-6">
            <path d="M8 1a2 2 0 0 0-2 2v1a2 2 0 1 0 4 0V3a2 2 0 0 0-2-2Z"/>
            <path d="M4 13s1-1 4-1 4 1 4 1v1H4v-1Z"/>
          </svg>
        </template>
      </button>

          <!-- Child buttons: render differently when logged in vs not logged in -->
          <template v-if="user">
            <!-- logged-in: show four buttons around FAB -->
            <button class="btn btn-circle btn-lg child-btn" @click="toggleSidebar" title="Menu">
              <SvgIcon type="menu" class="!w-5 !h-5" />
            </button>

            <button class="btn btn-circle btn-lg child-btn" @click="toggleTheme" :title="isDark ? 'dark' : 'light'" :aria-label="isDark ? 'dark' : 'light'">
              <SvgIcon v-if="!isDark" type="sun" class="!w-6 !h-6 text-yellow-400" />
              <SvgIcon v-else type="moon" class="!w-6 !h-6 text-indigo-300" />
            </button>

            <button class="btn btn-circle btn-lg child-btn" @click="goProfile" title="Profile">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.24 21a9 9 0 1 0-16.48 0"/><circle cx="12" cy="7" r="4"/></svg>
            </button>

            <button class="btn btn-circle btn-lg child-btn btn-error" @click="logout" title="Sign out">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </template>
          <template v-else>
            <!-- not logged-in: placed in the middle two arc positions -->
            <!-- Invisible button 1 (position 1) -->
            <button class="btn btn-circle btn-lg child-btn invisible pointer-events-none" aria-hidden="true"></button>

            <button class="btn btn-circle btn-lg child-btn" @click="toggleSidebar" title="Menu">
              <SvgIcon type="menu" class="!w-6 !h-6" />
            </button>

            <button class="btn btn-circle btn-lg child-btn" @click="toggleTheme" :title="isDark ? 'dark' : 'light'" :aria-label="isDark ? 'dark' : 'light'">
              <SvgIcon v-if="!isDark" type="sun" class="!w-6 !h-6 text-yellow-400" />
              <SvgIcon v-else type="moon" class="!w-6 !h-6 text-indigo-300" />  
            </button>

            <!-- Invisible button 4 (position 4) -->
            <button class="btn btn-circle btn-lg child-btn invisible pointer-events-none" aria-hidden="true"></button>
          </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import SvgIcon from './SvgIcon.vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { storeToRefs } from 'pinia';

const router = useRouter();
const authStore = useAuthStore();
const { user } = storeToRefs(authStore);

const fabOpen = ref(false);
const sidebarOpen = ref(false);
const isDark = ref(false);

const toggleFab = () => {
  fabOpen.value = !fabOpen.value;
};

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
  // keep FAB opened so user sees menu context
  fabOpen.value = true;
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  const theme = isDark.value ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
};

const userInitial = computed(() => {
  return user.value?.username?.charAt(0).toUpperCase() || '';
});

const logout = async () => {
  await authStore.logout();
  router.push('/login');
};

const goProfile = () => {
  router.push('/profile');
};

const openSupport = () => {
  router.push('/support').catch(() => {});
};

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (savedTheme === 'dark') {
    isDark.value = true;
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    isDark.value = false;
    document.documentElement.setAttribute('data-theme', 'light');
  }

  if (!user.value) {
    authStore.fetchUser().catch(() => {});
  }
});
</script>

