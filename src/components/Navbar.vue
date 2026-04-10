<template>
  <!-- DaisyUI Drawer for left sidebar overlay -->
  <div class="drawer z-[9998]">
    <input id="nav-drawer" type="checkbox" class="drawer-toggle" v-model="sidebarOpen" />
    <!-- The actual drawer sidebar layer: overlay + menu content -->
    <div class="drawer-side fixed inset-0 h-screen">
      <!-- Clicking this dark backdrop overlay closes the menu -->
      <label for="nav-drawer" aria-label="close sidebar" class="drawer-overlay" @click.prevent="sidebarOpen = false"></label>
      <!-- Menu itself: Base bg, ideally 450px but never more than 85vw on small screens -->
      <ul class="menu p-8 w-[450px] max-w-[85vw] min-h-full bg-base-100 text-base-content flex flex-col gap-6 overflow-y-auto">
        <li class="menu-title mb-8 flex items-center gap-5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 text-blue-600"><line x1="12" y1="20" x2="12" y2="8" stroke-width="2.5"></line><circle cx="12" cy="6" r="2" fill="currentColor" stroke="none"></circle><line x1="6" y1="20" x2="6" y2="12" stroke-width="2.5"></line><circle cx="6" cy="10" r="2" fill="currentColor" stroke="none"></circle><line x1="18" y1="20" x2="18" y2="14" stroke-width="2.5"></line><circle cx="18" cy="12" r="2" fill="currentColor" stroke="none"></circle></svg>
          <span class="text-2xl md:text-3xl font-semibold">MassFlow</span>
        </li>
        <li>
          <router-link to="/" @click="sidebarOpen = false" class="flex items-center gap-6 py-4 px-3 text-xl">
            <span class="w-8 h-8 flex justify-center items-center shrink-0">
              <HomeIcon class="w-8 h-8 text-base-content" />
            </span>
            <span>Home</span>
          </router-link>
        </li>

        <li>
          <details>
            <summary class="flex items-center gap-6 py-4 px-3 text-xl">
              <span class="w-8 h-8 flex justify-center items-center shrink-0">
                <CircleStackIcon class="w-8 h-8 text-base-content" />
              </span>
              <span>Datahub</span>
            </summary>
            <ul class="p-2 mt-2 flex flex-col gap-3">
            <li>
              <router-link to="/datasets" @click="sidebarOpen = false" class="flex items-center gap-6 py-4 px-3 text-xl">
                <span class="w-8 h-8 flex justify-center items-center shrink-0">
                  <QueueListIcon class="w-8 h-8 text-base-content" />
                </span>
                <span>Public Datasets</span>
              </router-link>
            </li>
            <li v-if="user">
              <router-link to="/my-datasets" @click="sidebarOpen = false" class="flex items-center gap-6 py-4 px-3 text-xl">
                <span class="w-8 h-8 flex justify-center items-center shrink-0">
                  <FolderIcon class="w-8 h-8 text-base-content" />
                </span>
                <span>My Datasets</span>
              </router-link>
            </li>
          </ul>
          </details>
        </li>
        <li v-if="authStore.isAdmin">
          <router-link to="/users" @click="sidebarOpen = false" class="flex items-center gap-6 py-4 px-3 text-xl">
            <span class="w-8 h-8 flex justify-center items-center shrink-0">
              <UsersIcon class="w-8 h-8 text-base-content" />
            </span>
            <span>Users</span>
          </router-link>
        </li>
        <li>
          <a @click.prevent="openSupport" class="flex items-center gap-6 py-4 px-3 text-xl">
            <span class="w-8 h-8 flex justify-center items-center shrink-0">
              <QuestionMarkCircleIcon class="w-8 h-8 text-base-content" />
            </span>
            <span>Support</span>
          </a>
        </li>
        <li v-if="!user">
          <router-link to="/login" class="flex items-center gap-6 py-4 px-3 text-xl">
            <span class="w-8 h-8 flex justify-center items-center shrink-0">
              <ArrowRightEndOnRectangleIcon class="w-8 h-8 text-base-content" />
            </span>
            <span>Sign in</span>
          </router-link>
        </li>
        <li v-if="!user">
          <router-link to="/register" class="flex items-center gap-6 py-4 px-3 text-xl">
            <span class="w-8 h-8 flex justify-center items-center shrink-0">
              <UserPlusIcon class="w-8 h-8 text-base-content" />
            </span>
            <span>Create account</span>
          </router-link>
        </li>
      </ul>
    </div>
  </div>

  <!-- FAB: fixed bottom-right, always on top-->
  <div class="fixed bottom-4 right-4 z-[9999]">
    <div class="fab fab-flower" :class="{ 'fab-open': fabOpen }">
      <!-- Trigger (focusable) - default Home icon -->
      <div tabindex="0" role="button" class="btn btn-circle btn-lg" @click="toggleFab" aria-label="Open menu">
        <HomeIcon class="w-6 h-6 text-base-content" aria-label="Home" />
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
          <HeroUserIcon class="w-6 h-6" aria-label="Profile" />
        </template>
      </button>

          <!-- Child buttons: render differently when logged in vs not logged in -->
          <template v-if="user">
            <!-- logged-in: show four buttons around FAB -->
            <button class="btn btn-circle btn-lg child-btn" @click="toggleSidebar" title="Menu">
              <Bars3Icon class="w-5 h-5" />
            </button>

            <button class="btn btn-circle btn-lg child-btn" @click="toggleTheme" :title="isDark ? 'dark' : 'light'" :aria-label="isDark ? 'dark' : 'light'">
              <SunIcon v-if="!isDark" class="w-6 h-6 text-yellow-400" />
              <MoonIcon v-else class="w-6 h-6 text-indigo-300" />
            </button>

            <button class="btn btn-circle btn-lg child-btn" @click="goProfile" title="Profile">
              <UserCircleIcon class="w-5 h-5" />
            </button>

            <button class="btn btn-circle btn-lg child-btn btn-error" @click="logout" title="Sign out">
              <ArrowRightEndOnRectangleIcon class="w-5 h-5" />
            </button>
          </template>
          <template v-else>
            <!-- not logged-in: placed in the middle two arc positions -->
            <!-- Invisible button 1 (position 1) -->
            <button class="btn btn-circle btn-lg child-btn invisible pointer-events-none" aria-hidden="true"></button>

            <button class="btn btn-circle btn-lg child-btn" @click="toggleSidebar" title="Menu">
              <Bars3Icon class="w-6 h-6" />
            </button>

            <button class="btn btn-circle btn-lg child-btn" @click="toggleTheme" :title="isDark ? 'dark' : 'light'" :aria-label="isDark ? 'dark' : 'light'">
              <SunIcon v-if="!isDark" class="w-6 h-6 text-yellow-400" />
              <MoonIcon v-else class="w-6 h-6 text-indigo-300" />  
            </button>

            <!-- Invisible button 4 (position 4) -->
            <button class="btn btn-circle btn-lg child-btn invisible pointer-events-none" aria-hidden="true"></button>
          </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { storeToRefs } from 'pinia';
import {
  HomeIcon,
  CircleStackIcon,
  QueueListIcon,
  FolderIcon,
  UsersIcon,
  QuestionMarkCircleIcon,
  ArrowRightEndOnRectangleIcon,
  UserPlusIcon,
  Bars3Icon,
  SunIcon,
  MoonIcon,
  UserCircleIcon,
  UserIcon as HeroUserIcon
} from '@heroicons/vue/24/outline';

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

