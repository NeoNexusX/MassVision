<template>
  <NavDrawer v-model:open="sidebarOpen" :user="user" :is-admin="authStore.isAdmin" />
  <NavFab
    :user="user"
    :is-dark="isDark"
    @toggle-drawer="sidebarOpen = !sidebarOpen"
    @toggle-theme="toggleTheme"
    @toggle-ai="showAI = !showAI"
    @logout="logout"
  />
  <FloatingAIAssistant v-model:show="showAI" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/features/auth/stores/authStore'
import NavDrawer from './NavDrawer.vue'
import NavFab from './NavFab.vue'
import FloatingAIAssistant from '@/app/components/FloatingAIAssistant.vue'

const router = useRouter()
const authStore = useAuthStore()
const { user } = storeToRefs(authStore)

const sidebarOpen = ref(false)
const isDark = ref(false)
const showAI = ref(false)

const toggleTheme = () => {
  isDark.value = !isDark.value
  const theme = isDark.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

const logout = async () => {
  await authStore.logout()
  router.push('/login')
}

onMounted(() => {
  const savedTheme =
    localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  isDark.value = savedTheme === 'dark'
  document.documentElement.setAttribute('data-theme', savedTheme)

  if (!user.value) {
    authStore.fetchUser().catch(() => {})
  }
})
</script>
