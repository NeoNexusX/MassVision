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
import FloatingAIAssistant from '@/features/assistant/components/FloatingAIAssistant.vue'
import { useTheme } from '@/shared/composables/useTheme'

const router = useRouter()
const authStore = useAuthStore()
const { user } = storeToRefs(authStore)

// 主题来自全站单例（已在 main.ts initTheme 初始化），切换即全局同步
const { isDark, toggleTheme } = useTheme()

const sidebarOpen = ref(false)
const showAI = ref(false)

const logout = async () => {
  await authStore.logout()
  router.push('/login')
}

onMounted(() => {
  if (!user.value) {
    authStore.fetchUser().catch(() => {})
  }
})
</script>
